import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { getDraftPayload, getPublishedPayload } from '../lib/scheduleAccess.js'
import { getActiveTeamLeadershipDuties } from '../lib/officeAccess.js'

const router = Router()

const LEADERSHIP = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'coordinator',
])

function todayIso() {
  return process.env.PMSS_TODAY ?? '2026-08-02'
}

function mapReport(row) {
  if (!row) return null
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    serviceDate: row.service_date,
    authorUserId: row.author_user_id,
    authorMemberId: row.author_member_id,
    authorName: row.author_name,
    dutyRole: row.duty_role,
    howItWent: row.how_it_went ?? '',
    issuesChallenges: row.issues_challenges ?? '',
    solutions: row.solutions ?? '',
    recommendations: row.recommendations ?? '',
    status: row.status,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function actorProfile(userId) {
  return db
    .prepare(
      `SELECT u.id, u.display_name, u.member_id, u.app_role, m.name AS member_name
       FROM users u
       LEFT JOIN members m ON m.id = u.member_id
       WHERE u.id = ?`,
    )
    .get(userId)
}

function schedulePayload() {
  return getPublishedPayload() ?? getDraftPayload()
}

function dutyForService(req, serviceId) {
  const user = actorProfile(req.auth.sub)
  if (!user || req.auth.role !== 'member') return null
  const memberName = user.member_name || user.display_name
  const payload = schedulePayload()
  const duties = getActiveTeamLeadershipDuties(
    memberName,
    payload?.teamAssignments ?? [],
    todayIso(),
  )
  return duties.find((d) => d.serviceId === serviceId) ?? null
}

function canViewReport(req, report) {
  if (LEADERSHIP.has(req.auth.role)) return true
  return report.author_user_id === req.auth.sub
}

router.get('/', authMiddleware, (req, res) => {
  const { serviceId, mine, status } = req.query
  if (req.auth.role === 'member' && !mine) {
    // Members only see their own unless querying a specific service they lead
  }

  let sql = `SELECT * FROM service_reports WHERE 1=1`
  const params = []

  if (serviceId) {
    sql += ` AND service_id = ?`
    params.push(String(serviceId))
  }
  if (status) {
    sql += ` AND status = ?`
    params.push(String(status))
  }

  if (LEADERSHIP.has(req.auth.role)) {
    if (mine === '1') {
      sql += ` AND author_user_id = ?`
      params.push(req.auth.sub)
    }
  } else if (req.auth.role === 'member') {
    sql += ` AND author_user_id = ?`
    params.push(req.auth.sub)
  } else {
    return res.status(403).json({ error: 'Forbidden' })
  }

  sql += ` ORDER BY service_date DESC, updated_at DESC LIMIT 100`
  const rows = db.prepare(sql).all(...params)
  return res.json({ reports: rows.map(mapReport) })
})

router.get('/by-service/:serviceId', authMiddleware, (req, res) => {
  const serviceId = req.params.serviceId
  if (LEADERSHIP.has(req.auth.role)) {
    const rows = db
      .prepare(
        `SELECT * FROM service_reports WHERE service_id = ? ORDER BY duty_role, updated_at DESC`,
      )
      .all(serviceId)
    return res.json({ reports: rows.map(mapReport) })
  }
  if (req.auth.role !== 'member') return res.status(403).json({ error: 'Forbidden' })
  const row = db
    .prepare(`SELECT * FROM service_reports WHERE service_id = ? AND author_user_id = ?`)
    .get(serviceId, req.auth.sub)
  return res.json({ report: mapReport(row), reports: row ? [mapReport(row)] : [] })
})

router.get('/:id', authMiddleware, (req, res) => {
  const row = db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (!canViewReport(req, row)) return res.status(403).json({ error: 'Forbidden' })
  return res.json({ report: mapReport(row) })
})

router.post('/', authMiddleware, (req, res) => {
  if (req.auth.role !== 'member') {
    return res.status(403).json({ error: 'Only TL/VTL members can create service reports' })
  }
  const b = req.body ?? {}
  const serviceId = b.serviceId
  if (!serviceId) return res.status(400).json({ error: 'serviceId required' })

  const duty = dutyForService(req, serviceId)
  if (!duty) {
    return res.status(403).json({
      error: 'You can only write a report for a service where you are TL or VTL during the duty window',
    })
  }

  const existing = db
    .prepare(`SELECT * FROM service_reports WHERE service_id = ? AND author_user_id = ?`)
    .get(serviceId, req.auth.sub)
  if (existing) {
    return res.status(200).json({ report: mapReport(existing), created: false })
  }

  const user = actorProfile(req.auth.sub)
  const id = uuid()
  db.prepare(
    `INSERT INTO service_reports (
      id, service_id, service_name, service_date, author_user_id, author_member_id,
      author_name, duty_role, how_it_went, issues_challenges, solutions, recommendations, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
  ).run(
    id,
    duty.serviceId,
    duty.serviceName,
    duty.serviceDate,
    req.auth.sub,
    user?.member_id ?? req.auth.memberId ?? null,
    user?.member_name || user?.display_name || 'Member',
    duty.dutyRole,
    String(b.howItWent ?? ''),
    String(b.issuesChallenges ?? ''),
    String(b.solutions ?? ''),
    String(b.recommendations ?? ''),
  )
  audit('service_report.create', req.auth.sub, { id, serviceId, dutyRole: duty.dutyRole })
  const row = db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(id)
  return res.status(201).json({ report: mapReport(row), created: true })
})

router.put('/:id', authMiddleware, (req, res) => {
  const row = db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.author_user_id !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' })
  if (row.status === 'submitted') {
    return res.status(400).json({ error: 'Submitted reports cannot be edited' })
  }

  const duty = dutyForService(req, row.service_id)
  if (!duty) {
    return res.status(403).json({ error: 'Duty window ended — you can no longer edit this draft' })
  }

  const b = req.body ?? {}
  db.prepare(
    `UPDATE service_reports SET
      how_it_went = ?,
      issues_challenges = ?,
      solutions = ?,
      recommendations = ?,
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    b.howItWent != null ? String(b.howItWent) : row.how_it_went,
    b.issuesChallenges != null ? String(b.issuesChallenges) : row.issues_challenges,
    b.solutions != null ? String(b.solutions) : row.solutions,
    b.recommendations != null ? String(b.recommendations) : row.recommendations,
    row.id,
  )
  const updated = db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(row.id)
  return res.json({ report: mapReport(updated) })
})

router.post('/:id/submit', authMiddleware, (req, res) => {
  const row = db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.author_user_id !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' })
  if (row.status === 'submitted') {
    return res.json({ report: mapReport(row) })
  }

  const duty = dutyForService(req, row.service_id)
  if (!duty) {
    return res.status(403).json({ error: 'Duty window ended — reports must be submitted while on duty' })
  }

  const b = req.body ?? {}
  const how = String(b.howItWent ?? row.how_it_went ?? '').trim()
  const issues = String(b.issuesChallenges ?? row.issues_challenges ?? '').trim()
  const solutions = String(b.solutions ?? row.solutions ?? '').trim()
  const recs = String(b.recommendations ?? row.recommendations ?? '').trim()

  if (!how || !issues || !solutions || !recs) {
    return res.status(400).json({
      error: 'All sections are required: how the service went, issues & challenges, solutions, and recommendations',
    })
  }

  db.prepare(
    `UPDATE service_reports SET
      how_it_went = ?,
      issues_challenges = ?,
      solutions = ?,
      recommendations = ?,
      status = 'submitted',
      submitted_at = datetime('now'),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(how, issues, solutions, recs, row.id)

  audit('service_report.submit', req.auth.sub, {
    id: row.id,
    serviceId: row.service_id,
    dutyRole: row.duty_role,
  })
  const updated = db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(row.id)
  return res.json({ report: mapReport(updated) })
})

export default router
