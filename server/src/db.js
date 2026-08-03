import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const databaseUrl = process.env.DATABASE_URL?.trim()
export const isPostgres = Boolean(databaseUrl)

/** ISO-ish UTC timestamp matching prior SQLite datetime('now') shape. */
const PG_NOW = `to_char((NOW() AT TIME ZONE 'utc'), 'YYYY-MM-DD HH24:MI:SS')`

function toPgPlaceholders(sql) {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

/** Adapt SQLite-oriented SQL for Postgres at query time. */
function adaptSqlForPg(sql) {
  let s = sql
  s = s.replace(
    /(\b\w+)\s*=\s*((?:\?|'[^']*'))\s*COLLATE\s+NOCASE/gi,
    'LOWER($1) = LOWER($2)',
  )
  s = s.replace(/\s+COLLATE\s+NOCASE/gi, '')
  s = s.replace(/datetime\('now'\)/gi, PG_NOW)
  s = s.replace(
    /INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi,
    (_m, table, cols, vals) => {
      const colList = cols.split(',').map((c) => c.trim())
      const updates = colList
        .filter((c) => !/^(contribution_type_id|member_id)$/i.test(c))
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(', ')
      const conflict =
        table === 'contribution_member_goals'
          ? 'contribution_type_id, member_id'
          : colList[0]
      return `INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT (${conflict}) DO UPDATE SET ${updates || `${colList[0]} = EXCLUDED.${colList[0]}`}`
    },
  )
  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
  s = s.replace(/\bexcluded\./gi, 'EXCLUDED.')
  return toPgPlaceholders(s)
}

function normalizeValue(v) {
  if (typeof v === 'bigint') return Number(v)
  return v
}

function normalizeRow(row) {
  if (!row) return row
  const out = {}
  for (const [k, v] of Object.entries(row)) out[k] = normalizeValue(v)
  return out
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
}

/** Expand @name binds (SQLite style) into positional ? for Postgres. */
function expandNamedParams(sql, params) {
  if (params.length === 1 && isPlainObject(params[0]) && /@\w+/.test(sql)) {
    const obj = params[0]
    const values = []
    const text = sql.replace(/@(\w+)/g, (_, name) => {
      values.push(Object.prototype.hasOwnProperty.call(obj, name) ? obj[name] : null)
      return '?'
    })
    return { sql: text, values }
  }
  return { sql, values: params }
}

function createPgDb(pool) {
  return {
    async exec(sql) {
      // Neon/pg: run statements one-by-one (multi-statement can be restricted).
      const parts = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      for (const part of parts) {
        await pool.query(part)
      }
    },
    prepare(sql) {
      return {
        async get(...params) {
          const expanded = expandNamedParams(sql, params)
          const text = adaptSqlForPg(expanded.sql)
          const r = await pool.query(text, expanded.values)
          return normalizeRow(r.rows[0])
        },
        async all(...params) {
          const expanded = expandNamedParams(sql, params)
          const text = adaptSqlForPg(expanded.sql)
          const r = await pool.query(text, expanded.values)
          return r.rows.map(normalizeRow)
        },
        async run(...params) {
          const expanded = expandNamedParams(sql, params)
          const text = adaptSqlForPg(expanded.sql)
          const r = await pool.query(text, expanded.values)
          return { changes: r.rowCount ?? 0, lastInsertRowid: undefined }
        },
      }
    },
  }
}

function createSqliteDb(syncDb) {
  return {
    async exec(sql) {
      syncDb.exec(sql)
    },
    prepare(sql) {
      const stmt = syncDb.prepare(sql)
      return {
        async get(...params) {
          return stmt.get(...params)
        },
        async all(...params) {
          return stmt.all(...params)
        },
        async run(...params) {
          return stmt.run(...params)
        },
      }
    },
  }
}

async function openDatabase() {
  if (isPostgres) {
    const { default: pg } = await import('pg')
    // COUNT(*) and other aggregates come back as int8 strings otherwise.
    pg.types.setTypeParser(20, (val) => Number(val))
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : undefined,
    })
    pool.on('error', (err) => {
      console.error('Unexpected Postgres pool error', err)
    })
    console.log('PMSS database: Postgres (DATABASE_URL)')
    return createPgDb(pool)
  }

  const { DatabaseSync } = await import('node:sqlite')
  const dbPath = process.env.PMSS_DB_PATH ?? path.join(__dirname, '..', 'data', 'pmss.sqlite')
  const dataDir = path.dirname(dbPath)
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const syncDb = new DatabaseSync(dbPath)
  syncDb.exec('PRAGMA journal_mode = WAL')
  syncDb.exec('PRAGMA foreign_keys = ON')
  console.log(`PMSS database: SQLite (${dbPath})`)
  return createSqliteDb(syncDb)
}

export const db = await openDatabase()

const SQLITE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      member_id TEXT,
      display_name TEXT NOT NULL,
      app_role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      last_login_at TEXT,
      invited_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor_user_id TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedule_versions (
      id TEXT PRIMARY KEY,
      version_label TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
      month_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      published_at TEXT,
      published_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_one_draft ON schedule_versions(status) WHERE status = 'draft';

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      attendance_rate INTEGER,
      choir TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      service_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
      submitted_at TEXT,
      submitted_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_one_per_service
      ON attendance_sessions(service_id);

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL,
      status TEXT NOT NULL,
      UNIQUE(session_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('mobile_money', 'bank', 'cash', 'other')),
      label TEXT NOT NULL,
      provider TEXT,
      account_name TEXT,
      account_number TEXT,
      instructions TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contribution_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'General',
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Closed', 'Draft')),
      frequency TEXT NOT NULL DEFAULT 'one_time'
        CHECK (frequency IN ('one_time', 'monthly', 'quarterly', 'yearly', 'continuous')),
      ministry_goal INTEGER NOT NULL DEFAULT 0,
      member_goal INTEGER NOT NULL DEFAULT 0,
      member_goal_mode TEXT NOT NULL DEFAULT 'uniform'
        CHECK (member_goal_mode IN ('uniform', 'custom')),
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
      start_date TEXT,
      deadline TEXT,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contribution_member_goals (
      contribution_type_id TEXT NOT NULL REFERENCES contribution_types(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL,
      goal_amount INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (contribution_type_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS contribution_submissions (
      id TEXT PRIMARY KEY,
      contribution_type_id TEXT NOT NULL REFERENCES contribution_types(id),
      member_id TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      claimed_amount INTEGER NOT NULL,
      confirmed_amount INTEGER,
      payment_method_id TEXT REFERENCES payment_methods(id),
      evidence_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'partial', 'declined')),
      verification_note TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT,
      verified_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contribution_followups (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE REFERENCES contribution_submissions(id) ON DELETE CASCADE,
      outstanding_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contribution_followup_notes (
      id TEXT PRIMARY KEY,
      followup_id TEXT NOT NULL REFERENCES contribution_followups(id) ON DELETE CASCADE,
      author_user_id TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS service_reports (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      service_date TEXT NOT NULL,
      author_user_id TEXT NOT NULL,
      author_member_id TEXT,
      author_name TEXT NOT NULL,
      duty_role TEXT NOT NULL CHECK (duty_role IN ('TL', 'VTL')),
      how_it_went TEXT NOT NULL DEFAULT '',
      issues_challenges TEXT NOT NULL DEFAULT '',
      solutions TEXT NOT NULL DEFAULT '',
      recommendations TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted')),
      submitted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (service_id, author_user_id)
    );

    CREATE TABLE IF NOT EXISTS office_reports (
      id TEXT PRIMARY KEY,
      author_user_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      include_json TEXT NOT NULL DEFAULT '{}',
      narrative_json TEXT NOT NULL DEFAULT '{}',
      snapshot_json TEXT,
      recipient_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted')),
      submitted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
`

const PG_SCHEMA = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      member_id TEXT,
      display_name TEXT NOT NULL,
      app_role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      last_login_at TEXT,
      invited_at TEXT,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      actor_user_id TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );

    CREATE TABLE IF NOT EXISTS schedule_versions (
      id TEXT PRIMARY KEY,
      version_label TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
      month_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      published_at TEXT,
      published_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_one_draft ON schedule_versions(status) WHERE status = 'draft';

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      attendance_rate INTEGER,
      choir TEXT,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW}),
      updated_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      service_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
      submitted_at TEXT,
      submitted_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_one_per_service
      ON attendance_sessions(service_id);

    CREATE TABLE IF NOT EXISTS attendance_records (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL,
      status TEXT NOT NULL,
      UNIQUE(session_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('mobile_money', 'bank', 'cash', 'other')),
      label TEXT NOT NULL,
      provider TEXT,
      account_name TEXT,
      account_number TEXT,
      instructions TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW}),
      updated_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );

    CREATE TABLE IF NOT EXISTS contribution_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'General',
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Closed', 'Draft')),
      frequency TEXT NOT NULL DEFAULT 'one_time'
        CHECK (frequency IN ('one_time', 'monthly', 'quarterly', 'yearly', 'continuous')),
      ministry_goal INTEGER NOT NULL DEFAULT 0,
      member_goal INTEGER NOT NULL DEFAULT 0,
      member_goal_mode TEXT NOT NULL DEFAULT 'uniform'
        CHECK (member_goal_mode IN ('uniform', 'custom')),
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
      start_date TEXT,
      deadline TEXT,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW}),
      updated_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );

    CREATE TABLE IF NOT EXISTS contribution_member_goals (
      contribution_type_id TEXT NOT NULL REFERENCES contribution_types(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL,
      goal_amount INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (contribution_type_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS contribution_submissions (
      id TEXT PRIMARY KEY,
      contribution_type_id TEXT NOT NULL REFERENCES contribution_types(id),
      member_id TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      claimed_amount INTEGER NOT NULL,
      confirmed_amount INTEGER,
      payment_method_id TEXT REFERENCES payment_methods(id),
      evidence_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'partial', 'declined')),
      verification_note TEXT,
      submitted_at TEXT NOT NULL DEFAULT (${PG_NOW}),
      confirmed_at TEXT,
      verified_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );

    CREATE TABLE IF NOT EXISTS contribution_followups (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE REFERENCES contribution_submissions(id) ON DELETE CASCADE,
      outstanding_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      created_at TEXT NOT NULL DEFAULT (${PG_NOW}),
      updated_at TEXT NOT NULL DEFAULT (${PG_NOW}),
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contribution_followup_notes (
      id TEXT PRIMARY KEY,
      followup_id TEXT NOT NULL REFERENCES contribution_followups(id) ON DELETE CASCADE,
      author_user_id TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );

    CREATE TABLE IF NOT EXISTS service_reports (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      service_date TEXT NOT NULL,
      author_user_id TEXT NOT NULL,
      author_member_id TEXT,
      author_name TEXT NOT NULL,
      duty_role TEXT NOT NULL CHECK (duty_role IN ('TL', 'VTL')),
      how_it_went TEXT NOT NULL DEFAULT '',
      issues_challenges TEXT NOT NULL DEFAULT '',
      solutions TEXT NOT NULL DEFAULT '',
      recommendations TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted')),
      submitted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW}),
      updated_at TEXT NOT NULL DEFAULT (${PG_NOW}),
      UNIQUE (service_id, author_user_id)
    );

    CREATE TABLE IF NOT EXISTS office_reports (
      id TEXT PRIMARY KEY,
      author_user_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      include_json TEXT NOT NULL DEFAULT '{}',
      narrative_json TEXT NOT NULL DEFAULT '{}',
      snapshot_json TEXT,
      recipient_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted')),
      submitted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (${PG_NOW}),
      updated_at TEXT NOT NULL DEFAULT (${PG_NOW})
    );
`

export async function initSchema() {
  await db.exec(isPostgres ? PG_SCHEMA : SQLITE_SCHEMA)
  await ensureColumn('contribution_submissions', 'evidence_file_name', 'TEXT')
  await ensureColumn('contribution_submissions', 'evidence_file_mime', 'TEXT')
  await ensureColumn('contribution_submissions', 'evidence_file_path', 'TEXT')
}

async function ensureColumn(table, column, typeSql) {
  if (isPostgres) {
    const row = await db
      .prepare(
        `SELECT 1 AS ok FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`,
      )
      .get(table, column)
    if (row) return
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`)
    return
  }
  const cols = await db.prepare(`PRAGMA table_info(${table})`).all()
  if (cols.some((c) => c.name === column)) return
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`)
}

export async function audit(action, actorUserId, meta = {}) {
  await db
    .prepare(`INSERT INTO audit_log (action, actor_user_id, meta_json) VALUES (?, ?, ?)`)
    .run(action, actorUserId ?? null, JSON.stringify(meta))
}
