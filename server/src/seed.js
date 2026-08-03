import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { db, initSchema, audit } from './db.js'
import { buildMonthlyServiceTeams } from './lib/teamEngine.js'
import { validateSchedulePayload } from './lib/validation.js'
import { ensureDefaultRules, loadRulesFromDb } from './lib/settingsStore.js'
import {
  ADMIN_ROSTER,
  PILOT_CHOIR_ASSIGNMENTS,
  PILOT_SERVICES,
  buildMemberRows,
  protocolNamePool,
} from './pilotData.js'

export const SEED_PASSWORD = 'Password123!'

function usernameFromName(name) {
  const parts = name.toLowerCase().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}.${parts[parts.length - 1]}`.replace(/[^a-z.]/g, '')
  return parts[0]?.replace(/[^a-z]/g, '') ?? 'user'
}

export function buildDefaultSchedulePayload(members) {
  const pool = protocolNamePool(members)
  const teamAssignments = buildMonthlyServiceTeams(pool, PILOT_SERVICES, { shuffle: false })
  const leadershipReview = teamAssignments
    .filter((t) => t.kind === 'sunday')
    .slice(0, 4)
    .map((t, i) => ({
      date: t.date,
      tl: t.teamLeader,
      vtl: t.viceTeamLeader,
      status: i < 3 ? 'Approved' : 'Pending approval',
    }))

  const base = {
    monthKey: '2026-08',
    monthLabel: 'August 2026',
    services: PILOT_SERVICES,
    choirAssignments: PILOT_CHOIR_ASSIGNMENTS,
    teamAssignments,
    leadershipReview,
  }

  const rules = loadRulesFromDb()
  const { rows, summary } = validateSchedulePayload(base, rules)
  return { ...base, validationRows: rows, validationSummary: summary }
}

function seedMembers(force) {
  if (force) db.exec(`DELETE FROM members`)
  const count = db.prepare(`SELECT COUNT(*) AS c FROM members`).get().c
  if (count > 0 && !force) return

  const insert = db.prepare(`
    INSERT INTO members (id, name, phone, role, status, attendance_rate, choir)
    VALUES (@id, @name, @phone, @role, @status, @attendance_rate, @choir)
  `)
  for (const m of buildMemberRows()) {
    insert.run(m)
  }
}

export async function seedDatabase({ force = false } = {}) {
  initSchema()
  ensureDefaultRules()

  seedMembers(force)

  const userCount = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c
  if (userCount > 0 && !force) {
    console.log('Database already seeded (%d users). Use --force to reseed.', userCount)
    seedFinanceDemo()
    return
  }

  if (force) {
    db.exec(`
      DELETE FROM contribution_followup_notes;
      DELETE FROM contribution_followups;
      DELETE FROM contribution_submissions;
      DELETE FROM contribution_member_goals;
      DELETE FROM contribution_types;
      DELETE FROM payment_methods;
      DELETE FROM attendance_records;
      DELETE FROM attendance_sessions;
      DELETE FROM password_reset_tokens;
      DELETE FROM audit_log;
      DELETE FROM schedule_versions;
      DELETE FROM users;
    `)
    seedMembers(true)
  }

  const hash = await bcrypt.hash(SEED_PASSWORD, 10)
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, member_id, display_name, app_role, status)
    VALUES (@id, @username, @email, @password_hash, @member_id, @display_name, @app_role, @status)
  `)

  for (const lead of ADMIN_ROSTER) {
    const username = usernameFromName(lead.name)
    const roleMap = {
      President: 'president',
      'Vice President': 'vice_president',
      Secretary: 'secretary',
      Treasurer: 'treasurer',
      Coordinator: 'coordinator',
    }
    insertUser.run({
      id: uuid(),
      username,
      email: `${username}@church.internal`,
      password_hash: hash,
      member_id: lead.id,
      display_name: lead.name,
      app_role: roleMap[lead.role] ?? 'member',
      status: 'Active',
    })
  }

  insertUser.run({
    id: uuid(),
    username: 'j.ndayisaba',
    email: 'j.ndayisaba@church.internal',
    password_hash: hash,
    member_id: '6',
    display_name: 'Jean Bosco Ndayisaba',
    app_role: 'member',
    status: 'Active',
  })

  const marieMember = db
    .prepare(`SELECT id FROM members WHERE name = 'Marie Claire Uwamahoro' LIMIT 1`)
    .get()
  insertUser.run({
    id: uuid(),
    username: 'm.uwamahoro',
    email: 'm.uwamahoro@church.internal',
    password_hash: hash,
    member_id: marieMember?.id ?? '7',
    display_name: 'Marie Claire Uwamahoro',
    app_role: 'member',
    status: 'Active',
  })

  const members = buildMemberRows()
  const payload = buildDefaultSchedulePayload(members)
  const draftId = uuid()
  db.prepare(`
    INSERT INTO schedule_versions (id, version_label, status, month_key, payload_json)
    VALUES (?, 'Draft', 'draft', '2026-08', ?)
  `).run(draftId, JSON.stringify(payload))

  const coordinator = db
    .prepare(`SELECT id FROM users WHERE username = 'd.mugisha' COLLATE NOCASE LIMIT 1`)
    .get()
  const publishId = uuid()
  const publishedPayload = {
    ...payload,
    versionLabel: 'V1',
    publishedAt: new Date().toISOString(),
  }
  db.prepare(
    `INSERT INTO schedule_versions (id, version_label, status, month_key, payload_json, published_at, published_by_user_id)
     VALUES (?, 'V1', 'published', '2026-08', ?, datetime('now'), ?)`,
  ).run(publishId, JSON.stringify(publishedPayload), coordinator?.id ?? null)

  audit('system.seed', null, {
    users: ADMIN_ROSTER.length + 2,
    members: members.length,
    published: 'V1',
  })
  audit('schedule.publish', coordinator?.id ?? null, {
    versionLabel: 'V1',
    monthKey: '2026-08',
    monthLabel: 'August 2026',
    summary: 'Schedule V1 published for August 2026',
  })
  audit('schedule.team_assignments', coordinator?.id ?? null, {
    monthKey: '2026-08',
    monthLabel: 'August 2026',
    teams: payload.teamAssignments?.length ?? 0,
    summary: 'Service teams built for August 2026',
  })
  audit('schedule.choir_assignments', coordinator?.id ?? null, {
    monthKey: '2026-08',
    monthLabel: 'August 2026',
    summary: 'Choir schedule generated for August 2026',
  })
  audit('schedule.leadership_approved', coordinator?.id ?? null, {
    monthKey: '2026-08',
    monthLabel: 'August 2026',
    summary: 'Leadership assignments approved for August 2026',
  })
  audit('ministry.announcement', coordinator?.id ?? null, {
    title: 'Welcome to the protocol month',
    summary: 'August 2026 schedule is live. Check your team and choir assignments.',
  })
  console.log(
    'Seeded users (password: %s), %d members, schedule draft, and published V1.',
    SEED_PASSWORD,
    members.length,
  )

  seedFinanceDemo()
}

/** Idempotent finance pilot data (runs on every boot if empty). */
export function seedFinanceDemo() {
  const methodCount = db.prepare(`SELECT COUNT(*) AS c FROM payment_methods`).get().c
  if (methodCount > 0) return

  const momo = uuid()
  const airtel = uuid()
  const bank = uuid()
  const cash = uuid()
  db.prepare(
    `INSERT INTO payment_methods (id, kind, label, provider, account_name, account_number, instructions, sort_order)
     VALUES (?, 'mobile_money', 'MTN MoMo', 'MTN', 'Protocol Ministry Treasurer', '078XXXXXXX', 'Use merchant name Protocol Ministry', 1)`,
  ).run(momo)
  db.prepare(
    `INSERT INTO payment_methods (id, kind, label, provider, account_name, account_number, instructions, sort_order)
     VALUES (?, 'mobile_money', 'Airtel Money', 'Airtel', 'Protocol Ministry Treasurer', '073XXXXXXX', NULL, 2)`,
  ).run(airtel)
  db.prepare(
    `INSERT INTO payment_methods (id, kind, label, provider, account_name, account_number, instructions, sort_order)
     VALUES (?, 'bank', 'Bank of Kigali', 'Bank of Kigali', 'Protocol Ministry', '123456789', 'Account name: Protocol Ministry', 3)`,
  ).run(bank)
  db.prepare(
    `INSERT INTO payment_methods (id, kind, label, provider, account_name, account_number, instructions, sort_order)
     VALUES (?, 'cash', 'Cash', NULL, 'Protocol Ministry Treasurer', NULL, 'Hand to Treasurer during office hours', 4)`,
  ).run(cash)

  const monthly = uuid()
  const uniform = uuid()
  db.prepare(
    `INSERT INTO contribution_types
     (id, name, description, category, status, frequency, ministry_goal, member_goal,
      member_goal_mode, visibility, start_date, deadline)
     VALUES (?, 'Monthly Contribution', 'Recurring protocol support', 'Recurring', 'Active', 'monthly',
      500000, 5000, 'uniform', 'public', '2026-08-01', '2026-08-31')`,
  ).run(monthly)
  db.prepare(
    `INSERT INTO contribution_types
     (id, name, description, category, status, frequency, ministry_goal, member_goal,
      member_goal_mode, visibility, start_date, deadline)
     VALUES (?, 'Uniform Contribution', 'One-time uniform fund', 'One-Time', 'Active', 'one_time',
      200000, 10000, 'uniform', 'private', '2026-08-01', '2026-09-30')`,
  ).run(uniform)

  const members = db
    .prepare(`SELECT id FROM members WHERE role = 'Member' AND status = 'Active' LIMIT 5`)
    .all()
  if (members[0]) {
    const s1 = uuid()
    db.prepare(
      `INSERT INTO contribution_submissions
       (id, contribution_type_id, member_id, payment_date, claimed_amount, confirmed_amount,
        payment_method_id, evidence_note, status, confirmed_at, verified_by_user_id)
       VALUES (?, ?, ?, '2026-08-05', 5000, 5000, ?, 'MoMo receipt', 'confirmed', datetime('now'),
        (SELECT id FROM users WHERE username = 'j.uwimana' COLLATE NOCASE LIMIT 1))`,
    ).run(s1, monthly, members[0].id, momo)
  }
  if (members[1]) {
    const s2 = uuid()
    db.prepare(
      `INSERT INTO contribution_submissions
       (id, contribution_type_id, member_id, payment_date, claimed_amount, confirmed_amount,
        payment_method_id, evidence_note, status, confirmed_at, verification_note, verified_by_user_id)
       VALUES (?, ?, ?, '2026-08-10', 5000, 3000, ?, 'Partial MoMo', 'partial', datetime('now'),
        'Received 3,000 RWF. Remaining balance is 2,000 RWF.',
        (SELECT id FROM users WHERE username = 'j.uwimana' COLLATE NOCASE LIMIT 1))`,
    ).run(s2, monthly, members[1].id, momo)
    const fu = uuid()
    db.prepare(
      `INSERT INTO contribution_followups (id, submission_id, outstanding_amount, status)
       VALUES (?, ?, 2000, 'open')`,
    ).run(fu, s2)
    db.prepare(
      `INSERT INTO contribution_followup_notes (id, followup_id, author_user_id, body)
       VALUES (?, ?, (SELECT id FROM users WHERE username = 'j.uwimana' COLLATE NOCASE LIMIT 1),
        'Received 3,000 RWF. Remaining balance is 2,000 RWF. Please complete payment before deadline.')`,
    ).run(uuid(), fu)
  }
  if (members[2]) {
    db.prepare(
      `INSERT INTO contribution_submissions
       (id, contribution_type_id, member_id, payment_date, claimed_amount, payment_method_id,
        evidence_note, status)
       VALUES (?, ?, ?, '2026-08-12', 5000, ?, 'Awaiting verification', 'pending')`,
    ).run(uuid(), monthly, members[2].id, bank)
  }

  console.log('Seeded finance demo: payment methods, contribution types, sample submissions.')
}

if (process.argv[1]?.endsWith('seed.js')) {
  const force = process.argv.includes('--force')
  seedDatabase({ force }).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
