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

function canRecord(req, serviceDate) {
  if (LEADERSHIP.has(req.auth.role)) return true
  if (req.auth.role !== 'member') return false
  const payload = getPublishedPayload() ?? getDraftPayload()
  if (!payload?.teamAssignments) return false
  const user = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(req.auth.sub)
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

router.get('/sessions', authMiddleware, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM attendance_sessions ORDER BY service_date DESC LIMIT 50`)
    .all()
  return res.json({ sessions: rows.map(mapSession) })
})

router.get('/sessions/:serviceId', authMiddleware, (req, res) => {
  const session = db
    .prepare(`SELECT * FROM attendance_sessions WHERE service_id = ?`)
    .get(req.params.serviceId)
  if (!session) return res.json({ session: null, records: [] })

  const records = db
    .prepare(`SELECT member_id, status FROM attendance_records WHERE session_id = ?`)
    .all(session.id)

  return res.json({
    session: mapSession(session),
    records: records.map((r) => ({ memberId: r.member_id, status: r.status })),
  })
})

router.post('/sessions', authMiddleware, (req, res) => {
  const { serviceId } = req.body ?? {}
  if (!serviceId) return res.status(400).json({ error: 'serviceId required' })

  const payload = getPublishedPayload() ?? getDraftPayload()
  const service = payload?.services?.find((s) => s.id === serviceId)
  if (!service) return res.status(404).json({ error: 'Service not found in schedule' })

  if (!canRecord(req, service.date)) {
    return res.status(403).json({ error: 'Not allowed to record attendance for this service' })
  }

  let session = db.prepare(`SELECT * FROM attendance_sessions WHERE service_id = ?`).get(serviceId)
  if (!session) {
    const id = uuid()
    db.prepare(
      `INSERT INTO attendance_sessions (id, service_id, service_name, service_date, status)
       VALUES (?, ?, ?, ?, 'draft')`,
    ).run(id, serviceId, service.name, service.date)
    session = db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(id)

    const team = payload.teamAssignments?.find((t) => t.serviceId === serviceId)
    const insert = db.prepare(
      `INSERT INTO attendance_records (session_id, member_id, status) VALUES (?, ?, 'Present')`,
    )
    if (team?.members) {
      for (const name of team.members) {
        const member = db.prepare(`SELECT id FROM members WHERE name = ?`).get(name)
        if (member) insert.run(session.id, member.id)
      }
    }
    audit('attendance.session_create', req.auth.sub, { serviceId })
  }

  const records = db
    .prepare(`SELECT member_id, status FROM attendance_records WHERE session_id = ?`)
    .all(session.id)

  return res.json({
    session: mapSession(session),
    records: records.map((r) => ({ memberId: r.member_id, status: r.status })),
  })
})

router.put('/sessions/:sessionId/records', authMiddleware, (req, res) => {
  const session = db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  if (session.status === 'submitted') return res.status(400).json({ error: 'Session already submitted' })

  if (!canRecord(req, session.service_date)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { records } = req.body ?? {}
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records array required' })

  const upsert = db.prepare(
    `INSERT INTO attendance_records (session_id, member_id, status) VALUES (?, ?, ?)
     ON CONFLICT(session_id, member_id) DO UPDATE SET status = excluded.status`,
  )
  for (const r of records) {
    if (r.memberId && r.status) upsert.run(session.id, String(r.memberId), r.status)
  }

  return res.json({ ok: true })
})

router.post('/sessions/:sessionId/submit', authMiddleware, (req, res) => {
  const session = db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  if (session.status === 'submitted') return res.status(400).json({ error: 'Already submitted' })

  if (!canRecord(req, session.service_date)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  db.prepare(
    `UPDATE attendance_sessions SET status = 'submitted', submitted_at = datetime('now'), submitted_by_user_id = ? WHERE id = ?`,
  ).run(req.auth.sub, session.id)
  audit('attendance.submit', req.auth.sub, { sessionId: session.id, serviceId: session.service_id })

  return res.json({ ok: true, session: mapSession(db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(session.id)) })
})

router.get('/me/history', authMiddleware, (req, res) => {
  const memberId = req.auth.memberId
  if (!memberId) return res.json({ history: [] })

  const rows = db
    .prepare(
      `SELECT s.service_name, s.service_date, s.status AS session_status, r.status, s.submitted_at
       FROM attendance_records r
       JOIN attendance_sessions s ON s.id = r.session_id
       WHERE r.member_id = ? AND s.status = 'submitted'
       ORDER BY s.service_date DESC`,
    )
    .all(String(memberId))

  const payload = getPublishedPayload() ?? getDraftPayload()
  const history = rows.map((row, i) => {
    const svc = payload?.services?.find((s) => s.date === row.service_date && s.name === row.service_name)
    const team = payload?.teamAssignments?.find((t) => t.serviceId === svc?.id)
    const member = db.prepare(`SELECT name FROM members WHERE id = ?`).get(String(memberId))
    let teamRole = 'Protocol team'
    if (team && member) {
      if (team.teamLeader === member.name) teamRole = 'Team Leader'
      else if (team.viceTeamLeader === member.name) teamRole = 'Vice Team Leader'
    }
    return {
      id: `${memberId}-${row.service_date}-${i}`,
      service: row.service_name,
      serviceDate: row.service_date,
      date: row.service_date,
      status: row.status,
      teamRole,
    }
  })

  return res.json({ history })
})

export default router
