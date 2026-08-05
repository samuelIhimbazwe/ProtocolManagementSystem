import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { getDraftPayload, getPublishedPayload } from '../lib/scheduleAccess.js'
import {
  getActiveTeamLeadershipDuties,
  isDutyWindowActive,
} from '../lib/officeAccess.js'

const router = Router()

const LEADERSHIP = new Set(['president', 'vice_president', 'secretary', 'treasurer', 'coordinator'])

async function canRecord(req, serviceDate) {
  if (LEADERSHIP.has(req.auth.role)) return true
  if (req.auth.role !== 'member') return false
  const payload = (await getPublishedPayload()) ?? (await getDraftPayload())
  if (!payload?.teamAssignments) return false
  const user = await db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(req.auth.sub)
  if (!user) return false
  const today = process.env.PMSS_TODAY ?? '2026-08-02'
  const duties = getActiveTeamLeadershipDuties(user.display_name, payload.teamAssignments, today)
  if (!duties.length) return false
  return duties.some((d) => isDutyWindowActive(d.serviceDate, today))
}

function mapSession(row) {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    serviceDate: row.service_date,
    status: row.status,
    submittedAt: row.submitted_at,
  }
}

async function recordsWithContacts(sessionId) {
  const rows = await db
    .prepare(
      `SELECT r.member_id, r.status, m.name, m.phone
       FROM attendance_records r
       JOIN members m ON m.id = r.member_id
       WHERE r.session_id = ?
       ORDER BY m.name COLLATE NOCASE`,
    )
    .all(sessionId)
  return rows.map((r) => ({
    memberId: r.member_id,
    name: r.name,
    phone: r.phone ?? '',
    status: r.status,
  }))
}

function summarizeStatuses(records) {
  const counts = { Present: 0, 'Half Present': 0, 'Quarter Present': 0, Absent: 0 }
  for (const r of records) {
    if (counts[r.status] != null) counts[r.status] += 1
    else counts.Absent += 1
  }
  const total = records.length
  const presentWeight =
    counts.Present + counts['Half Present'] * 0.5 + counts['Quarter Present'] * 0.25
  const rate = total ? `${Math.round((presentWeight / total) * 100)}%` : '—'
  return {
    present: counts.Present,
    halfPresent: counts['Half Present'],
    quarterPresent: counts['Quarter Present'],
    absent: counts.Absent,
    total,
    rate,
  }
}

router.get('/sessions', authMiddleware, async (req, res) => {
  const rows = await db
    .prepare(`SELECT * FROM attendance_sessions ORDER BY service_date DESC LIMIT 50`)
    .all()
  const sessions = []
  for (const row of rows) {
    const records = await recordsWithContacts(row.id)
    const summary = summarizeStatuses(records)
    sessions.push({
      ...mapSession(row),
      rate: summary.rate,
      recorded: summary.total,
      present: summary.present,
      absent: summary.absent,
    })
  }
  return res.json({ sessions })
})

/** Month overview for dashboard — role-aware lists. */
router.get('/overview', authMiddleware, async (req, res) => {
  const month = String(req.query.month ?? '2026-08').trim()
  const monthPrefix = month.length >= 7 ? month.slice(0, 7) : month

  const sessions = await db
    .prepare(
      `SELECT * FROM attendance_sessions
       WHERE service_date LIKE ?
       ORDER BY service_date DESC, service_name`,
    )
    .all(`${monthPrefix}%`)

  const serviceRows = []
  const allSubmittedRecords = []
  for (const row of sessions) {
    const records = await recordsWithContacts(row.id)
    const summary = summarizeStatuses(records)
    if (row.status === 'submitted') {
      allSubmittedRecords.push(...records)
    }
    serviceRows.push({
      id: row.id,
      serviceId: row.service_id,
      service: row.service_name,
      date: row.service_date,
      rate: summary.rate,
      status: row.status === 'submitted' ? 'Submitted' : 'Draft',
      recorded: summary.total,
      present: summary.present,
      absent: summary.absent,
      sessionStatus: row.status,
    })
  }

  const monthly = summarizeStatuses(allSubmittedRecords)
  if (!monthly.total) {
    monthly.rate = '—'
  }

  let personalHistory = []
  if (req.auth.memberId) {
    const hist = await db
      .prepare(
        `SELECT s.service_name, s.service_date, r.status, s.submitted_at
         FROM attendance_records r
         JOIN attendance_sessions s ON s.id = r.session_id
         WHERE r.member_id = ? AND s.status = 'submitted'
         ORDER BY s.service_date DESC`,
      )
      .all(String(req.auth.memberId))
    personalHistory = hist.map((row, i) => ({
      id: `${req.auth.memberId}-${row.service_date}-${i}`,
      service: row.service_name,
      serviceDate: row.service_date,
      date: row.service_date,
      status: row.status,
      teamRole: 'Protocol team',
    }))
  }

  const historySessions = serviceRows.filter((s) => s.sessionStatus === 'submitted')

  return res.json({
    month: monthPrefix,
    monthly: {
      rate: monthly.rate,
      present: monthly.present,
      halfPresent: monthly.halfPresent,
      quarterPresent: monthly.quarterPresent,
      absent: monthly.absent,
      total: monthly.total,
    },
    services: serviceRows,
    history: historySessions,
    personalHistory,
  })
})

router.get('/sessions/:serviceId', authMiddleware, async (req, res) => {
  const key = String(req.params.serviceId)
  let session = await db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(key)
  if (!session) {
    session = await db.prepare(`SELECT * FROM attendance_sessions WHERE service_id = ?`).get(key)
  }
  if (!session) return res.json({ session: null, records: [] })

  const records = await recordsWithContacts(session.id)
  const summary = summarizeStatuses(records)

  return res.json({
    session: mapSession(session),
    summary,
    records: records.map((r) => ({
      memberId: r.memberId,
      status: r.status,
      name: r.name,
      phone: r.phone,
    })),
  })
})

router.post('/sessions', authMiddleware, async (req, res) => {
  const { serviceId } = req.body ?? {}
  if (!serviceId) return res.status(400).json({ error: 'serviceId required' })

  const payload = (await getPublishedPayload()) ?? (await getDraftPayload())
  const service = payload?.services?.find((s) => s.id === serviceId)
  if (!service) return res.status(404).json({ error: 'Service not found in schedule' })

  if (!(await canRecord(req, service.date))) {
    return res.status(403).json({ error: 'Not allowed to record attendance for this service' })
  }

  let session = await db.prepare(`SELECT * FROM attendance_sessions WHERE service_id = ?`).get(serviceId)
  if (!session) {
    const id = uuid()
    await db.prepare(
      `INSERT INTO attendance_sessions (id, service_id, service_name, service_date, status)
       VALUES (?, ?, ?, ?, 'draft')`,
    ).run(id, serviceId, service.name, service.date)
    session = await db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(id)

    const team = payload.teamAssignments?.find((t) => t.serviceId === serviceId)
    const insert = db.prepare(
      `INSERT INTO attendance_records (session_id, member_id, status) VALUES (?, ?, 'Present')`,
    )
    if (team?.members) {
      for (const name of team.members) {
        const member = await db.prepare(`SELECT id FROM members WHERE name = ?`).get(name)
        if (member) await insert.run(session.id, member.id)
      }
    }
    await audit('attendance.session_create', req.auth.sub, { serviceId })
  }

  const records = await recordsWithContacts(session.id)

  return res.json({
    session: mapSession(session),
    records: records.map((r) => ({
      memberId: r.memberId,
      status: r.status,
      name: r.name,
      phone: r.phone,
    })),
  })
})

router.put('/sessions/:sessionId/records', authMiddleware, async (req, res) => {
  const session = await db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  if (!(await canRecord(req, session.service_date))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { records } = req.body ?? {}
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records array required' })

  const upsert = db.prepare(
    `INSERT INTO attendance_records (session_id, member_id, status) VALUES (?, ?, ?)
     ON CONFLICT(session_id, member_id) DO UPDATE SET status = excluded.status`,
  )
  for (const r of records) {
    if (r.memberId && r.status) await upsert.run(session.id, String(r.memberId), r.status)
  }

  const wasSubmitted = session.status === 'submitted'
  const actor = await db.prepare(`SELECT display_name, app_role FROM users WHERE id = ?`).get(req.auth.sub)
  const recipientRoles = ['coordinator', 'president', 'vice_president', 'secretary']

  if (wasSubmitted) {
    await audit('attendance.update', req.auth.sub, {
      sessionId: session.id,
      serviceId: session.service_id,
      serviceName: session.service_name,
      serviceDate: session.service_date,
      submittedByName: actor?.display_name ?? null,
      submittedByRole: actor?.app_role ?? req.auth.role,
      recipientRoles,
      href: '/attendance',
      summary: `${actor?.display_name ?? 'A recorder'} updated attendance for ${session.service_name}${
        session.service_date ? ` (${session.service_date})` : ''
      }`,
    })
  } else {
    await audit('attendance.save', req.auth.sub, {
      sessionId: session.id,
      serviceId: session.service_id,
      serviceName: session.service_name,
      serviceDate: session.service_date,
    })
  }

  const detailed = await recordsWithContacts(session.id)
  return res.json({
    ok: true,
    session: mapSession(session),
    records: detailed,
    updated: true,
    wasSubmitted,
    notified: wasSubmitted ? recipientRoles : [],
  })
})

router.post('/sessions/:sessionId/submit', authMiddleware, async (req, res) => {
  const session = await db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  if (session.status === 'submitted') return res.status(400).json({ error: 'Already submitted' })

  if (!(await canRecord(req, session.service_date))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  await db.prepare(
    `UPDATE attendance_sessions SET status = 'submitted', submitted_at = datetime('now'), submitted_by_user_id = ? WHERE id = ?`,
  ).run(req.auth.sub, session.id)

  const submitter = await db
    .prepare(`SELECT display_name, app_role FROM users WHERE id = ?`)
    .get(req.auth.sub)
  const recipientRoles = ['coordinator', 'president', 'vice_president', 'secretary']
  await audit('attendance.submit', req.auth.sub, {
    sessionId: session.id,
    serviceId: session.service_id,
    serviceName: session.service_name,
    serviceDate: session.service_date,
    submittedByName: submitter?.display_name ?? null,
    submittedByRole: submitter?.app_role ?? req.auth.role,
    recipientRoles,
    href: '/attendance',
    summary: `${submitter?.display_name ?? 'A recorder'} submitted attendance for ${session.service_name}${
      session.service_date ? ` (${session.service_date})` : ''
    }`,
  })

  const updated = await db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(session.id)
  const detailed = await recordsWithContacts(session.id)
  return res.json({
    ok: true,
    session: mapSession(updated),
    records: detailed,
    submittedTo: recipientRoles,
  })
})

router.get('/me/history', authMiddleware, async (req, res) => {
  const memberId = req.auth.memberId
  if (!memberId) return res.json({ history: [] })

  const rows = await db
    .prepare(
      `SELECT s.service_name, s.service_date, s.status AS session_status, r.status, s.submitted_at
       FROM attendance_records r
       JOIN attendance_sessions s ON s.id = r.session_id
       WHERE r.member_id = ? AND s.status = 'submitted'
       ORDER BY s.service_date DESC`,
    )
    .all(String(memberId))

  const payload = (await getPublishedPayload()) ?? (await getDraftPayload())
  const history = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const svc = payload?.services?.find((s) => s.date === row.service_date && s.name === row.service_name)
    const team = payload?.teamAssignments?.find((t) => t.serviceId === svc?.id)
    const member = await db.prepare(`SELECT name FROM members WHERE id = ?`).get(String(memberId))
    let teamRole = 'Protocol team'
    if (team && member) {
      if (team.teamLeader === member.name) teamRole = 'Team Leader'
      else if (team.viceTeamLeader === member.name) teamRole = 'Vice Team Leader'
    }
    history.push({
      id: `${memberId}-${row.service_date}-${i}`,
      service: row.service_name,
      serviceDate: row.service_date,
      date: row.service_date,
      status: row.status,
      teamRole,
    })
  }

  return res.json({ history })
})

export default router
