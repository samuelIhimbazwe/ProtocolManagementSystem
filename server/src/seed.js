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
  emailFromName,
  protocolNamePool,
  usernameFromName,
} from './pilotData.js'

export const SEED_PASSWORD = 'Password123!'

/** Plain protocol member — never TL/VTL in the default August 2026 schedule. */
export const REGULAR_MEMBER_DEMO = {
  memberName: 'Théogène Hakizimana',
  username: 't.hakizimana',
  email: 't.hakizimana@church.internal',
  displayName: 'Théogène Hakizimana',
}

export { usernameFromName }

export async function buildDefaultSchedulePayload(members) {
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

  const rules = await loadRulesFromDb()
  const { rows, summary } = validateSchedulePayload(base, rules)
  return { ...base, validationRows: rows, validationSummary: summary }
}

async function seedMembers(force) {
  if (force) await db.exec(`DELETE FROM members`)
  const count = (await db.prepare(`SELECT COUNT(*) AS c FROM members`).get()).c
  if (count > 0 && !force) return

  const insert = db.prepare(`
    INSERT INTO members (id, name, email, phone, role, status, attendance_rate, choir)
    VALUES (@id, @name, @email, @phone, @role, @status, @attendance_rate, @choir)
  `)
  for (const m of buildMemberRows()) {
    await insert.run(m)
  }
}

/** Fill missing roster emails so Create member accounts can select everyone. */
async function ensureMemberEmails() {
  const linkedEmails = await db
    .prepare(`SELECT member_id, email FROM users WHERE member_id IS NOT NULL AND email IS NOT NULL`)
    .all()
  const emailByMember = new Map(
    linkedEmails.map((r) => [String(r.member_id), String(r.email).trim().toLowerCase()]),
  )

  const members = await db.prepare(`SELECT id, name, email FROM members`).all()
  const used = new Set(
    members
      .map((m) => String(m.email ?? '').trim().toLowerCase())
      .filter(Boolean),
  )
  for (const e of emailByMember.values()) {
    if (e) used.add(e)
  }

  let updated = 0
  for (const m of members) {
    const current = String(m.email ?? '').trim()
    if (current) continue

    const fromUser = emailByMember.get(String(m.id))
    let email = fromUser || null
    if (!email) {
      const claim = new Set(used)
      email = emailFromName(m.name, claim)
    }
    used.add(email)
    await db.prepare(`UPDATE members SET email = ?, updated_at = datetime('now') WHERE id = ?`).run(email, m.id)
    updated += 1
  }
  if (updated > 0) {
    console.log('Backfilled email on %d roster member(s).', updated)
  }
}

export async function seedDatabase({ force = false } = {}) {
  await initSchema()
  await ensureDefaultRules()

  await seedMembers(force)
  await ensureMemberEmails()

  const userCount = (await db.prepare(`SELECT COUNT(*) AS c FROM users`).get()).c
  if (userCount > 0 && !force) {
    console.log('Database already seeded (%d users). Use --force to reseed.', userCount)
    await seedFinanceDemo()
    await ensureRegularMemberDemo()
    await ensureLeadershipDemos()
    await ensureDutyLeaderDemos()
    return
  }

  if (force) {
    await db.exec(`
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
    await seedMembers(true)
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
    await insertUser.run({
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

  await insertUser.run({
    id: uuid(),
    username: 'j.ndayisaba',
    email: 'j.ndayisaba@church.internal',
    password_hash: hash,
    member_id: '6',
    display_name: 'Jean Bosco Ndayisaba',
    app_role: 'member',
    status: 'Active',
  })

  const marieMember = await db
    .prepare(`SELECT id FROM members WHERE name = 'Marie Claire Uwamahoro' LIMIT 1`)
    .get()
  await insertUser.run({
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
  const payload = await buildDefaultSchedulePayload(members)
  const draftId = uuid()
  await db.prepare(`
    INSERT INTO schedule_versions (id, version_label, status, month_key, payload_json)
    VALUES (?, 'Draft', 'draft', '2026-08', ?)
  `).run(draftId, JSON.stringify(payload))

  const coordinator = await db
    .prepare(`SELECT id FROM users WHERE username = 'd.mugisha' COLLATE NOCASE LIMIT 1`)
    .get()
  const publishId = uuid()
  const publishedPayload = {
    ...payload,
    versionLabel: 'V1',
    publishedAt: new Date().toISOString(),
  }
  await db.prepare(
    `INSERT INTO schedule_versions (id, version_label, status, month_key, payload_json, published_at, published_by_user_id, is_public)
     VALUES (?, 'V1', 'published', '2026-08', ?, datetime('now'), ?, 1)`,
  ).run(publishId, JSON.stringify(publishedPayload), coordinator?.id ?? null)

  await audit('system.seed', null, {
    users: ADMIN_ROSTER.length + 2,
    members: members.length,
    published: 'V1',
  })
  await audit('schedule.publish', coordinator?.id ?? null, {
    versionLabel: 'V1',
    monthKey: '2026-08',
    monthLabel: 'August 2026',
    summary: 'Schedule V1 published for August 2026',
  })
  await audit('schedule.team_assignments', coordinator?.id ?? null, {
    monthKey: '2026-08',
    monthLabel: 'August 2026',
    teams: payload.teamAssignments?.length ?? 0,
    summary: 'Service teams built for August 2026',
  })
  await audit('schedule.choir_assignments', coordinator?.id ?? null, {
    monthKey: '2026-08',
    monthLabel: 'August 2026',
    summary: 'Choir schedule generated for August 2026',
  })
  await audit('schedule.leadership_approved', coordinator?.id ?? null, {
    monthKey: '2026-08',
    monthLabel: 'August 2026',
    summary: 'Leadership assignments approved for August 2026',
  })
  await audit('ministry.announcement', coordinator?.id ?? null, {
    title: 'Welcome to the protocol month',
    summary: 'August 2026 schedule is live. Check your team and choir assignments.',
  })
  console.log(
    'Seeded users (password: %s), %d members, schedule draft, and published V1.',
    SEED_PASSWORD,
    members.length,
  )

  await seedFinanceDemo()
  await ensureRegularMemberDemo()
  await ensureLeadershipDemos()
  await ensureDutyLeaderDemos()
}

/** Ensure president / VP / secretary / treasurer / coordinator logins exist and stay usable. */
export async function ensureLeadershipDemos() {
  const hash = await bcrypt.hash(SEED_PASSWORD, 10)
  const roleMap = {
    President: 'president',
    'Vice President': 'vice_president',
    Secretary: 'secretary',
    Treasurer: 'treasurer',
    Coordinator: 'coordinator',
  }
  let created = 0
  let repaired = 0
  for (const lead of ADMIN_ROSTER) {
    const username = usernameFromName(lead.name)
    const appRole = roleMap[lead.role] ?? 'member'
    const email = `${username}@church.internal`
    const member = await db
      .prepare(`SELECT id FROM members WHERE id = ? OR name = ? LIMIT 1`)
      .get(lead.id, lead.name)

    let user = await db
      .prepare(`SELECT * FROM users WHERE username = ? COLLATE NOCASE`)
      .get(username)
    if (!user && member?.id) {
      user = await db.prepare(`SELECT * FROM users WHERE member_id = ?`).get(member.id)
    }
    if (!user) {
      user = await db
        .prepare(`SELECT * FROM users WHERE app_role = ? AND status = 'Active' LIMIT 1`)
        .get(appRole)
      // Only reuse empty role slots — never steal another leadership username.
      if (user && user.username && String(user.username).toLowerCase() !== username) {
        user = null
      }
    }

    if (!user) {
      await db.prepare(`
        INSERT INTO users (id, username, email, password_hash, member_id, display_name, app_role, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
      `).run(uuid(), username, email, hash, member?.id ?? lead.id, lead.name, appRole)
      created += 1
      continue
    }

    const needsRepair =
      user.app_role !== appRole ||
      user.status !== 'Active' ||
      String(user.username).toLowerCase() !== username ||
      String(user.email ?? '').toLowerCase() !== email

    // Always keep demo leadership passwords in sync for local testing.
    await db.prepare(
      `UPDATE users SET
        username = ?, email = ?, password_hash = ?, member_id = ?,
        display_name = ?, app_role = ?, status = 'Active'
       WHERE id = ?`,
    ).run(username, email, hash, member?.id ?? user.member_id, lead.name, appRole, user.id)
    if (needsRepair) repaired += 1
  }
  if (created > 0 || repaired > 0) {
    console.log(
      'Leadership demos: created %d, repaired %d (password %s).',
      created,
      repaired,
      SEED_PASSWORD,
    )
  } else {
    console.log('Leadership demos: passwords refreshed for %d accounts.', ADMIN_ROSTER.length)
  }
}

/** Idempotent login for testing the member portal (no TL/VTL duties). */
export async function ensureRegularMemberDemo() {
  const existing = await db
    .prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`)
    .get(REGULAR_MEMBER_DEMO.username)
  if (existing) return

  const member = await db
    .prepare(`SELECT id FROM members WHERE name = ? LIMIT 1`)
    .get(REGULAR_MEMBER_DEMO.memberName)
  if (!member) {
    console.warn('Regular member demo: roster entry not found (%s).', REGULAR_MEMBER_DEMO.memberName)
    return
  }

  const hash = await bcrypt.hash(SEED_PASSWORD, 10)
  await db.prepare(`
    INSERT INTO users (id, username, email, password_hash, member_id, display_name, app_role, status)
    VALUES (?, ?, ?, ?, ?, ?, 'member', 'Active')
  `).run(
    uuid(),
    REGULAR_MEMBER_DEMO.username,
    REGULAR_MEMBER_DEMO.email,
    hash,
    member.id,
    REGULAR_MEMBER_DEMO.displayName,
  )
  console.log(
    'Seeded regular member demo: %s — password %s (never TL/VTL on default schedule)',
    REGULAR_MEMBER_DEMO.email,
    SEED_PASSWORD,
  )
}

/** Ensure TL/VTL people on the schedule have logins (for report submit targets). */
export async function ensureDutyLeaderDemos() {
  const published = await db
    .prepare(
      `SELECT payload_json FROM schedule_versions WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`,
    )
    .get()
  const draft = await db
    .prepare(`SELECT payload_json FROM schedule_versions WHERE status = 'draft' LIMIT 1`)
    .get()
  const payload = published
    ? JSON.parse(published.payload_json)
    : draft
      ? JSON.parse(draft.payload_json)
      : null
  const teams = payload?.teamAssignments ?? []
  const names = new Set()
  for (const t of teams) {
    if (t.teamLeader) names.add(String(t.teamLeader).trim())
    if (t.viceTeamLeader) names.add(String(t.viceTeamLeader).trim())
  }
  if (!names.size) return

  const hash = await bcrypt.hash(SEED_PASSWORD, 10)
  let created = 0
  for (const name of names) {
    const member = await db.prepare(`SELECT id, name, email FROM members WHERE name = ? LIMIT 1`).get(name)
    if (!member) continue
    const linked = await db
      .prepare(`SELECT id FROM users WHERE member_id = ? LIMIT 1`)
      .get(member.id)
    if (linked) continue
    let username = usernameFromName(name)
    let n = 2
    while (
      await db.prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`).get(username)
    ) {
      username = `${usernameFromName(name)}${n}`
      n += 1
    }
    const email = member.email || `${username}@church.internal`
    await db.prepare(`
      INSERT INTO users (id, username, email, password_hash, member_id, display_name, app_role, status)
      VALUES (?, ?, ?, ?, ?, ?, 'member', 'Active')
    `).run(uuid(), username, email, hash, member.id, name)
    created += 1
  }
  if (created > 0) {
    console.log('Seeded %d TL/VTL login(s) for report submit targets (password %s).', created, SEED_PASSWORD)
  }
}

/** Idempotent finance pilot data (runs on every boot if empty). */
export async function seedFinanceDemo() {
  const methodCount = (await db.prepare(`SELECT COUNT(*) AS c FROM payment_methods`).get()).c
  if (methodCount > 0) return

  const momo = uuid()
  const airtel = uuid()
  const bank = uuid()
  const cash = uuid()
  await db.prepare(
    `INSERT INTO payment_methods (id, kind, label, provider, account_name, account_number, instructions, sort_order)
     VALUES (?, 'mobile_money', 'MTN MoMo', 'MTN', 'TMS Treasurer', '078XXXXXXX', 'Use merchant name TMS Ministry', 1)`,
  ).run(momo)
  await db.prepare(
    `INSERT INTO payment_methods (id, kind, label, provider, account_name, account_number, instructions, sort_order)
     VALUES (?, 'mobile_money', 'Airtel Money', 'Airtel', 'TMS Treasurer', '073XXXXXXX', NULL, 2)`,
  ).run(airtel)
  await db.prepare(
    `INSERT INTO payment_methods (id, kind, label, provider, account_name, account_number, instructions, sort_order)
     VALUES (?, 'bank', 'Bank of Kigali', 'Bank of Kigali', 'TMS Ministry', '123456789', 'Account name: TMS Ministry', 3)`,
  ).run(bank)
  await db.prepare(
    `INSERT INTO payment_methods (id, kind, label, provider, account_name, account_number, instructions, sort_order)
     VALUES (?, 'cash', 'Cash', NULL, 'TMS Treasurer', NULL, 'Hand to Treasurer during office hours', 4)`,
  ).run(cash)

  const monthly = uuid()
  const uniform = uuid()
  await db.prepare(
    `INSERT INTO contribution_types
     (id, name, description, category, status, frequency, ministry_goal, member_goal,
      member_goal_mode, visibility, start_date, deadline)
     VALUES (?, 'Monthly Contribution', 'Recurring protocol support', 'Recurring', 'Active', 'monthly',
      500000, 5000, 'uniform', 'public', '2026-08-01', '2026-08-31')`,
  ).run(monthly)
  await db.prepare(
    `INSERT INTO contribution_types
     (id, name, description, category, status, frequency, ministry_goal, member_goal,
      member_goal_mode, visibility, start_date, deadline)
     VALUES (?, 'Uniform Contribution', 'One-time uniform fund', 'One-Time', 'Active', 'one_time',
      200000, 10000, 'uniform', 'private', '2026-08-01', '2026-09-30')`,
  ).run(uniform)

  const members = await db
    .prepare(`SELECT id FROM members WHERE role = 'Member' AND status = 'Active' LIMIT 5`)
    .all()
  if (members[0]) {
    const s1 = uuid()
    await db.prepare(
      `INSERT INTO contribution_submissions
       (id, contribution_type_id, member_id, payment_date, claimed_amount, confirmed_amount,
        payment_method_id, evidence_note, status, confirmed_at, verified_by_user_id)
       VALUES (?, ?, ?, '2026-08-05', 5000, 5000, ?, 'MoMo receipt', 'confirmed', datetime('now'),
        (SELECT id FROM users WHERE username = 'j.uwimana' COLLATE NOCASE LIMIT 1))`,
    ).run(s1, monthly, members[0].id, momo)
  }
  if (members[1]) {
    const s2 = uuid()
    await db.prepare(
      `INSERT INTO contribution_submissions
       (id, contribution_type_id, member_id, payment_date, claimed_amount, confirmed_amount,
        payment_method_id, evidence_note, status, confirmed_at, verification_note, verified_by_user_id)
       VALUES (?, ?, ?, '2026-08-10', 5000, 3000, ?, 'Partial MoMo', 'partial', datetime('now'),
        'Received 3,000 RWF. Remaining balance is 2,000 RWF.',
        (SELECT id FROM users WHERE username = 'j.uwimana' COLLATE NOCASE LIMIT 1))`,
    ).run(s2, monthly, members[1].id, momo)
    const fu = uuid()
    await db.prepare(
      `INSERT INTO contribution_followups (id, submission_id, outstanding_amount, status)
       VALUES (?, ?, 2000, 'open')`,
    ).run(fu, s2)
    await db.prepare(
      `INSERT INTO contribution_followup_notes (id, followup_id, author_user_id, body)
       VALUES (?, ?, (SELECT id FROM users WHERE username = 'j.uwimana' COLLATE NOCASE LIMIT 1),
        'Received 3,000 RWF. Remaining balance is 2,000 RWF. Please complete payment before deadline.')`,
    ).run(uuid(), fu)
  }
  if (members[2]) {
    await db.prepare(
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
  initSchema()
    .then(() => seedDatabase({ force }))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
