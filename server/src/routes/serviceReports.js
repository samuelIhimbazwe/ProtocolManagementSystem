import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { getDraftPayload, getPublishedPayload } from '../lib/scheduleAccess.js'
import { getTeamLeadershipAssignments } from '../lib/officeAccess.js'
import {
  ALL_SUBMIT_RECIPIENT_ROLES,
  ROLE_LABELS,
  SUBMIT_RECIPIENT_ROLE_OPTIONS,
} from '../lib/officeReportJurisdiction.js'

const router = Router()

const LEADERSHIP = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'coordinator',
])

const APP_ROLE_SUBMIT_KEYS = new Set([
  'coordinator',
  'secretary',
  'treasurer',
  'vice_president',
  'president',
])

function todayIso() {
  return (process.env.TMS_TODAY ?? process.env.PMSS_TODAY) ?? '2026-08-02'
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
    recipientUserId: row.recipient_user_id ?? null,
    recipientRole: row.recipient_role ?? null,
    recipientName: row.recipient_name ?? null,
    status: row.status,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function actorProfile(userId) {
  return await db
    .prepare(
      `SELECT u.id, u.display_name, u.member_id, u.app_role, m.name AS member_name
       FROM users u
       LEFT JOIN members m ON m.id = u.member_id
       WHERE u.id = ?`,
    )
    .get(userId)
}

async function schedulePayload() {
  return (await getPublishedPayload()) ?? (await getDraftPayload())
}

async function recipientsForRoleKey(roleKey, { excludeUserId } = {}) {
  const label = ROLE_LABELS[roleKey] ?? roleKey
  if (roleKey === 'tl' || roleKey === 'vtl') {
    const payload = await schedulePayload()
    const teams = payload?.teamAssignments ?? []
    const names = new Set()
    for (const t of teams) {
      const name = roleKey === 'tl' ? t.teamLeader : t.viceTeamLeader
      if (name) names.add(String(name).trim())
    }
    if (!names.size) return []
    const members = await db.prepare(`SELECT id, name FROM members`).all()
    const byName = new Map(members.map((m) => [String(m.name).trim(), m.id]))
    const out = []
    const seen = new Set()
    for (const name of names) {
      const memberId = byName.get(name)
      if (!memberId) continue
      const user = await db
        .prepare(
          `SELECT id, display_name, app_role FROM users
           WHERE member_id = ? AND status = 'Active'`,
        )
        .get(memberId)
      if (!user || (excludeUserId && user.id === excludeUserId) || seen.has(user.id)) continue
      seen.add(user.id)
      out.push({
        id: user.id,
        displayName: user.display_name || name,
        appRole: user.app_role,
        roleKey,
        roleLabel: label,
      })
    }
    return out.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  if (!APP_ROLE_SUBMIT_KEYS.has(roleKey)) return []
  const rows = await db
    .prepare(
      `SELECT id, display_name, app_role FROM users
       WHERE status = 'Active' AND app_role = ?
       ORDER BY display_name`,
    )
    .all(roleKey)
  return rows
    .filter((u) => !excludeUserId || u.id !== excludeUserId)
    .map((u) => ({
      id: u.id,
      displayName: u.display_name,
      appRole: u.app_role,
      roleKey,
      roleLabel: label,
    }))
}

async function buildSubmitRecipients(authorUserId) {
  const recipients = []
  for (const roleKey of ALL_SUBMIT_RECIPIENT_ROLES) {
    recipients.push(...(await recipientsForRoleKey(roleKey, { excludeUserId: authorUserId })))
  }
  const roleOptions = SUBMIT_RECIPIENT_ROLE_OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
    count: recipients.filter((r) => r.roleKey === o.id).length,
  }))
  return { recipients, roleOptions }
}

async function enrichReport(row) {
  if (!row) return null
  let recipientName = null
  if (row.recipient_user_id) {
    const ru = await db
      .prepare(`SELECT display_name FROM users WHERE id = ?`)
      .get(row.recipient_user_id)
    recipientName = ru?.display_name ?? null
  }
  return mapReport({ ...row, recipient_name: recipientName })
}

async function dutyForService(req, serviceId) {
  const user = await actorProfile(req.auth.sub)
  if (!user || req.auth.role !== 'member') return null
  const memberName = user.member_name || user.display_name
  const payload = await schedulePayload()
  const duties = getTeamLeadershipAssignments(
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

router.get('/', authMiddleware, async (req, res) => {
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
  const rows = await db.prepare(sql).all(...params)
  return res.json({ reports: rows.map(mapReport) })
})

router.get('/by-service/:serviceId', authMiddleware, async (req, res) => {
  const serviceId = req.params.serviceId
  if (LEADERSHIP.has(req.auth.role)) {
    const rows = await db
      .prepare(
        `SELECT * FROM service_reports WHERE service_id = ? ORDER BY duty_role, updated_at DESC`,
      )
      .all(serviceId)
    return res.json({ reports: await Promise.all(rows.map((r) => enrichReport(r))) })
  }
  if (req.auth.role !== 'member') return res.status(403).json({ error: 'Forbidden' })
  const row = await db
    .prepare(`SELECT * FROM service_reports WHERE service_id = ? AND author_user_id = ?`)
    .get(serviceId, req.auth.sub)
  const report = await enrichReport(row)
  return res.json({ report, reports: report ? [report] : [] })
})

router.get('/meta/recipients', authMiddleware, async (req, res) => {
  if (req.auth.role !== 'member' && !LEADERSHIP.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const data = await buildSubmitRecipients(req.auth.sub)
  return res.json(data)
})

router.get('/:id', authMiddleware, async (req, res) => {
  const row = await db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (!canViewReport(req, row)) return res.status(403).json({ error: 'Forbidden' })
  return res.json({ report: await enrichReport(row) })
})

router.post('/', authMiddleware, async (req, res) => {
  if (req.auth.role !== 'member') {
    return res.status(403).json({ error: 'Only TL/VTL members can create service reports' })
  }
  const b = req.body ?? {}
  const serviceId = b.serviceId
  if (!serviceId) return res.status(400).json({ error: 'serviceId required' })

  const duty = await dutyForService(req, serviceId)
  if (!duty) {
    return res.status(403).json({
      error: 'You can only write a report for a service where you are TL or VTL',
    })
  }

  const existing = await db
    .prepare(`SELECT * FROM service_reports WHERE service_id = ? AND author_user_id = ?`)
    .get(serviceId, req.auth.sub)
  if (existing) {
    return res.status(200).json({ report: mapReport(existing), created: false })
  }

  const user = await actorProfile(req.auth.sub)
  const id = uuid()
  await db.prepare(
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
  await audit('service_report.create', req.auth.sub, { id, serviceId, dutyRole: duty.dutyRole })
  const row = await db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(id)
  return res.status(201).json({ report: mapReport(row), created: true })
})

router.put('/:id', authMiddleware, async (req, res) => {
  const row = await db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.author_user_id !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' })
  if (row.status === 'submitted') {
    return res.status(400).json({ error: 'Submitted reports cannot be edited' })
  }

  const duty = await dutyForService(req, row.service_id)
  if (!duty) {
    return res.status(403).json({ error: 'Only the assigned TL/VTL can edit this draft' })
  }

  const b = req.body ?? {}
  await db.prepare(
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
  const updated = await db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(row.id)
  return res.json({ report: mapReport(updated) })
})

router.post('/:id/submit', authMiddleware, async (req, res) => {
  const row = await db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.author_user_id !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' })
  if (row.status === 'submitted') {
    return res.json({ report: mapReport(row) })
  }

  const duty = await dutyForService(req, row.service_id)
  if (!duty) {
    return res.status(403).json({ error: 'Only the assigned TL/VTL can submit this service report' })
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

  const recipientUserId = b.recipientUserId ?? b.recipient_user_id ?? null
  const recipientRole = String(b.recipientRole ?? b.recipient_role ?? '').trim()
  if (!recipientUserId || !recipientRole) {
    return res.status(400).json({
      error:
        'Select a role and recipient to send this report to (VTL, TL, Coordinator, Secretary, Treasurer, Vice President, or President)',
    })
  }
  const { recipients } = await buildSubmitRecipients(req.auth.sub)
  const match = recipients.find((p) => p.id === String(recipientUserId) && p.roleKey === recipientRole)
  if (!match) {
    return res.status(400).json({ error: 'Invalid recipient for the selected role' })
  }

  await db.prepare(
    `UPDATE service_reports SET
      how_it_went = ?,
      issues_challenges = ?,
      solutions = ?,
      recommendations = ?,
      recipient_user_id = ?,
      recipient_role = ?,
      status = 'submitted',
      submitted_at = datetime('now'),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(how, issues, solutions, recs, String(recipientUserId), recipientRole, row.id)

  await audit('service_report.submit', req.auth.sub, {
    id: row.id,
    serviceId: row.service_id,
    dutyRole: row.duty_role,
    recipientUserId: String(recipientUserId),
    recipientRole,
  })
  const updated = await db.prepare(`SELECT * FROM service_reports WHERE id = ?`).get(row.id)
  return res.json({ report: await enrichReport(updated) })
})

export default router
