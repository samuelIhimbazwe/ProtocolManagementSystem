import { Router } from 'express'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { getPublishedPayload, getDraftPayload } from '../lib/scheduleAccess.js'

const router = Router()

const REPORT_ROLES = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'coordinator',
])

function requireReports(req, res) {
  if (!REPORT_ROLES.has(req.auth.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}

function parseChoirs(choirs) {
  return String(choirs ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function attendanceBreakdown(extraWhere = '', params = []) {
  const rows = await db
    .prepare(
      `SELECT r.status, COUNT(*) AS c FROM attendance_records r
       JOIN attendance_sessions s ON s.id = r.session_id
       WHERE s.status = 'submitted' ${extraWhere}
       GROUP BY r.status`,
    )
    .all(...params)

  let present = 0
  let halfPresent = 0
  let quarterPresent = 0
  let absent = 0
  for (const row of rows) {
    if (row.status === 'Present') present = row.c
    else if (row.status === 'Half Present') halfPresent = row.c
    else if (row.status === 'Quarter Present') quarterPresent = row.c
    else if (row.status === 'Absent') absent = row.c
  }
  const total = present + halfPresent + quarterPresent + absent
  const weighted = present + halfPresent * 0.5 + quarterPresent * 0.25
  const rate = total > 0 ? `${Math.round((weighted / total) * 100)}%` : '—'
  return { present, halfPresent, quarterPresent, absent, total, rate }
}

function buildScheduleAnalytics(payload) {
  const services = payload?.services ?? []
  const teams = payload?.teamAssignments ?? []
  const choirs = payload?.choirAssignments ?? []
  const leadership = payload?.leadershipReview ?? []
  const validationRows = payload?.validationRows ?? []
  const validationSummary = payload?.validationSummary ?? null

  const byKind = { sunday: 0, weekday: 0, igaburo: 0, other: 0 }
  for (const t of teams) {
    const k = t.kind && byKind[t.kind] != null ? t.kind : 'other'
    byKind[k] += 1
  }

  const teamFill = teams.map((t) => ({
    service: t.serviceName ?? t.date,
    date: t.date,
    kind: t.kind ?? '—',
    size: t.size ?? t.members?.length ?? 0,
    target: t.kind === 'sunday' || t.kind === 'igaburo' ? 10 : 6,
    teamLeader: t.teamLeader ?? '—',
    viceTeamLeader: t.viceTeamLeader ?? '—',
    status: t.status ?? 'Assigned',
  }))

  const fullRoster = teamFill.filter((t) => t.size >= t.target).length
  const underfilled = teamFill.filter((t) => t.size < t.target).length

  const choirUsage = new Map()
  const choirByService = []
  for (const row of choirs) {
    const list = parseChoirs(row.choirs)
    choirByService.push({
      service: row.service,
      date: row.date,
      status: row.status ?? 'Assigned',
      choirCount: list.length,
      choirs: list.join('; '),
    })
    for (const name of list) {
      choirUsage.set(name, (choirUsage.get(name) ?? 0) + 1)
    }
  }
  const choirFrequency = [...choirUsage.entries()]
    .map(([choir, count]) => ({ choir, count }))
    .sort((a, b) => b.count - a.count)

  const leadTally = new Map()
  for (const t of teams) {
    if (t.teamLeader) {
      const cur = leadTally.get(t.teamLeader) ?? { member: t.teamLeader, teamLeader: 0, viceLeader: 0 }
      cur.teamLeader += 1
      leadTally.set(t.teamLeader, cur)
    }
    if (t.viceTeamLeader) {
      const cur = leadTally.get(t.viceTeamLeader) ?? {
        member: t.viceTeamLeader,
        teamLeader: 0,
        viceLeader: 0,
      }
      cur.viceLeader += 1
      leadTally.set(t.viceTeamLeader, cur)
    }
  }
  const leadershipTally = [...leadTally.values()].sort(
    (a, b) => b.teamLeader + b.viceLeader - (a.teamLeader + a.viceLeader),
  )

  const leadershipDetail = leadership.map((r) => ({
    date: r.date,
    teamLeader: r.tl ?? r.teamLeader ?? '—',
    viceLeader: r.vtl ?? r.viceLeader ?? '—',
    status: r.status ?? '—',
  }))

  const dutyLoad = new Map()
  for (const t of teams) {
    const members = Array.isArray(t.members) ? t.members : []
    for (const raw of members) {
      const name = typeof raw === 'string' ? raw : raw?.name
      if (!name) continue
      const cur = dutyLoad.get(name) ?? { member: name, assignments: 0, asLeader: 0 }
      cur.assignments += 1
      dutyLoad.set(name, cur)
    }
    if (t.teamLeader) {
      const cur = dutyLoad.get(t.teamLeader) ?? { member: t.teamLeader, assignments: 0, asLeader: 0 }
      cur.asLeader += 1
      dutyLoad.set(t.teamLeader, cur)
    }
    if (t.viceTeamLeader) {
      const cur = dutyLoad.get(t.viceTeamLeader) ?? {
        member: t.viceTeamLeader,
        assignments: 0,
        asLeader: 0,
      }
      cur.asLeader += 1
      dutyLoad.set(t.viceTeamLeader, cur)
    }
  }
  const memberDutyLoad = [...dutyLoad.values()].sort(
    (a, b) => b.assignments + b.asLeader - (a.assignments + a.asLeader),
  )

  const validation = {
    summary: validationSummary,
    rows: validationRows.map((r) => ({
      rule: r.rule,
      issue: r.issue,
      severity: r.severity,
      service: r.service,
      status: r.status,
    })),
    passed: validationRows.filter((r) => String(r.severity).toLowerCase() === 'passed').length,
    warnings: validationRows.filter((r) => String(r.severity).toLowerCase() === 'warning').length,
    errors: validationRows.filter((r) => String(r.severity).toLowerCase() === 'error').length,
  }

  return {
    serviceCount: services.length,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      date: s.date,
      day: s.day,
      status: s.status,
    })),
    teamCount: teams.length,
    teamsByKind: byKind,
    teamFill,
    fullRosterTeams: fullRoster,
    underfilledTeams: underfilled,
    choirAssignments: choirByService,
    choirFrequency,
    uniqueChoirs: choirFrequency.length,
    leadershipTally,
    leadershipDetail,
    memberDutyLoad,
    validation,
    monthLabel: payload?.monthLabel ?? payload?.monthKey ?? '—',
  }
}

router.get('/attendance', authMiddleware, async (req, res) => {
  if (!requireReports(req, res)) return

  const monthly = await attendanceBreakdown()
  const sessionsSubmitted = (
    await db
      .prepare(`SELECT COUNT(*) AS c FROM attendance_sessions WHERE status = 'submitted'`)
      .get()
  ).c

  return res.json({ monthly, sessionsSubmitted })
})

router.get('/leadership', authMiddleware, async (req, res) => {
  if (!requireReports(req, res)) return

  const payload = (await getPublishedPayload()) ?? (await getDraftPayload())
  const analytics = buildScheduleAnalytics(payload)
  const published = await db
    .prepare(
      `SELECT version_label, month_key, published_at, published_by_user_id
       FROM schedule_versions WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`,
    )
    .get()

  return res.json({
    rows: analytics.leadershipTally.slice(0, 50),
    schedule: published
      ? {
          version: published.version_label,
          month: published.month_key,
          publishedAt: published.published_at,
        }
      : null,
  })
})

/** Full ministry report pack for the Reports page. */
router.get('/summary', authMiddleware, async (req, res) => {
  if (!requireReports(req, res)) return

  const serviceFilter = String(req.query.service ?? '').trim()
  const start = String(req.query.start ?? '').trim()
  const end = String(req.query.end ?? '').trim()

  let attWhere = ''
  const attParams = []
  if (serviceFilter && serviceFilter !== 'All services') {
    attWhere += ' AND s.service_name = ?'
    attParams.push(serviceFilter)
  }
  if (start) {
    attWhere += ' AND s.service_date >= ?'
    attParams.push(start)
  }
  if (end) {
    attWhere += ' AND s.service_date <= ?'
    attParams.push(end)
  }

  const monthly = await attendanceBreakdown(attWhere, attParams)

  const sessions = (await db
    .prepare(
      `SELECT s.id, s.service_name, s.service_date, s.status, s.submitted_at,
        (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id) AS recorded,
        (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status = 'Present') AS present_n,
        (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status = 'Absent') AS absent_n
       FROM attendance_sessions s
       WHERE 1=1
         ${serviceFilter && serviceFilter !== 'All services' ? 'AND s.service_name = ?' : ''}
         ${start ? 'AND s.service_date >= ?' : ''}
         ${end ? 'AND s.service_date <= ?' : ''}
       ORDER BY s.service_date DESC, s.service_name
       LIMIT 100`,
    )
    .all(
      ...[
        ...(serviceFilter && serviceFilter !== 'All services' ? [serviceFilter] : []),
        ...(start ? [start] : []),
        ...(end ? [end] : []),
      ],
    ))
    .map((s) => {
      const recorded = s.recorded ?? 0
      const presentN = s.present_n ?? 0
      const rate =
        recorded > 0 ? `${Math.round((presentN / recorded) * 100)}%` : '—'
      return {
        id: s.id,
        service: s.service_name,
        date: s.service_date,
        status: s.status === 'submitted' ? 'Submitted' : 'Draft',
        recorded,
        present: presentN,
        absent: s.absent_n ?? 0,
        rate,
        submittedAt: s.submitted_at,
      }
    })

  let memberAttWhere = ` AND s.status = 'submitted'`
  const memberAttParams = []
  if (serviceFilter && serviceFilter !== 'All services') {
    memberAttWhere += ' AND s.service_name = ?'
    memberAttParams.push(serviceFilter)
  }
  if (start) {
    memberAttWhere += ' AND s.service_date >= ?'
    memberAttParams.push(start)
  }
  if (end) {
    memberAttWhere += ' AND s.service_date <= ?'
    memberAttParams.push(end)
  }

  const memberAttendance = (await db
    .prepare(
      `SELECT m.id, m.name, m.choir, m.attendance_rate AS stored_rate,
        COUNT(r.id) AS marks,
        SUM(CASE WHEN r.status = 'Present' THEN 1 ELSE 0 END) AS present_n,
        SUM(CASE WHEN r.status = 'Absent' THEN 1 ELSE 0 END) AS absent_n,
        SUM(CASE WHEN r.status = 'Half Present' THEN 1 ELSE 0 END) AS half_n,
        SUM(CASE WHEN r.status = 'Quarter Present' THEN 1 ELSE 0 END) AS quarter_n
       FROM members m
       LEFT JOIN attendance_records r ON r.member_id = m.id
       LEFT JOIN attendance_sessions s ON s.id = r.session_id
         ${memberAttWhere}
       WHERE m.role = 'Member' AND m.status = 'Active'
       GROUP BY m.id
       HAVING marks > 0
       ORDER BY absent_n DESC, present_n ASC
       LIMIT 100`,
    )
    .all(...memberAttParams))
    .map((m) => {
      const marks = m.marks ?? 0
      const weighted =
        (m.present_n ?? 0) + (m.half_n ?? 0) * 0.5 + (m.quarter_n ?? 0) * 0.25
      const computed = marks > 0 ? Math.round((weighted / marks) * 100) : null
      return {
        id: m.id,
        name: m.name,
        choir: m.choir,
        marks,
        present: m.present_n ?? 0,
        absent: m.absent_n ?? 0,
        halfPresent: m.half_n ?? 0,
        quarterPresent: m.quarter_n ?? 0,
        rate: computed != null ? `${computed}%` : m.stored_rate != null ? `${m.stored_rate}%` : '—',
      }
    })

  const members = {
    total: (await db.prepare(`SELECT COUNT(*) AS c FROM members`).get()).c,
    active: (await db.prepare(`SELECT COUNT(*) AS c FROM members WHERE status = 'Active'`).get()).c,
    protocol: (
      await db
        .prepare(`SELECT COUNT(*) AS c FROM members WHERE role = 'Member' AND status = 'Active'`)
        .get()
    ).c,
    leadership: (
      await db
        .prepare(`SELECT COUNT(*) AS c FROM members WHERE role != 'Member' AND status = 'Active'`)
        .get()
    ).c,
    withChoir: (
      await db
        .prepare(`SELECT COUNT(*) AS c FROM members WHERE choir IS NOT NULL AND TRIM(choir) != ''`)
        .get()
    ).c,
    byChoir: await db
      .prepare(
        `SELECT COALESCE(NULLIF(TRIM(choir), ''), 'Unassigned') AS choir, COUNT(*) AS count
         FROM members WHERE role = 'Member' AND status = 'Active'
         GROUP BY 1 ORDER BY count DESC`,
      )
      .all(),
  }

  const users = {
    total: (await db.prepare(`SELECT COUNT(*) AS c FROM users`).get()).c,
    active: (await db.prepare(`SELECT COUNT(*) AS c FROM users WHERE status = 'Active'`).get()).c,
    invited: (await db.prepare(`SELECT COUNT(*) AS c FROM users WHERE status = 'Invited'`).get()).c,
    deactivated: (
      await db
        .prepare(`SELECT COUNT(*) AS c FROM users WHERE status = 'Deactivated'`)
        .get()
    ).c,
  }

  const published = await db
    .prepare(
      `SELECT version_label, month_key, published_at, published_by_user_id, payload_json
       FROM schedule_versions WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`,
    )
    .get()
  const draft = await db
    .prepare(`SELECT version_label, month_key FROM schedule_versions WHERE status = 'draft' LIMIT 1`)
    .get()
  const versionHistory = await db
    .prepare(
      `SELECT version_label, status, month_key, published_at, created_at
       FROM schedule_versions ORDER BY created_at DESC LIMIT 12`,
    )
    .all()

  let payload = null
  try {
    payload = published ? JSON.parse(published.payload_json) : await getDraftPayload()
  } catch {
    payload = await getDraftPayload()
  }

  let schedule = buildScheduleAnalytics(payload)
  if (serviceFilter && serviceFilter !== 'All services') {
    const filteredServices = schedule.services.filter((s) => s.name === serviceFilter)
    const filteredTeams = schedule.teamFill.filter(
      (t) => String(t.service).includes(serviceFilter) || t.service === serviceFilter,
    )
    const filteredChoirs = schedule.choirAssignments.filter((c) => c.service === serviceFilter)
    schedule = {
      ...schedule,
      services: filteredServices,
      teamFill: filteredTeams,
      choirAssignments: filteredChoirs,
      serviceCount: filteredServices.length,
      teamCount: filteredTeams.length,
      fullRosterTeams: filteredTeams.filter((t) => t.size >= t.target).length,
      underfilledTeams: filteredTeams.filter((t) => t.size < t.target).length,
    }
  }

  const publisher = published?.published_by_user_id
    ? await db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(published.published_by_user_id)
    : null

  const activity = (await db
    .prepare(
      `SELECT action, meta_json, created_at, actor_user_id FROM audit_log
       WHERE action NOT LIKE 'auth.%'
       ORDER BY created_at DESC LIMIT 50`,
    )
    .all())
    .map((r) => {
      let meta = {}
      try {
        meta = JSON.parse(r.meta_json ?? '{}')
      } catch {
        /* ignore */
      }
      return {
        action: r.action,
        summary: meta.summary ?? r.action.replace(/\./g, ' · '),
        time: r.created_at,
        meta,
      }
    })

  const serviceOptions = [
    'All services',
    ...new Set((payload?.services ?? []).map((s) => s.name).filter(Boolean)),
  ]

  return res.json({
    generatedAt: new Date().toISOString(),
    filters: { service: serviceFilter || 'All services', start: start || null, end: end || null },
    serviceOptions,
    overview: {
      attendanceRate: monthly.rate,
      attendanceMarks: monthly.total,
      sessionsSubmitted: (
        await db
          .prepare(`SELECT COUNT(*) AS c FROM attendance_sessions WHERE status = 'submitted'`)
          .get()
      ).c,
      activeMembers: members.active,
      protocolMembers: members.protocol,
      servicesScheduled: schedule.serviceCount,
      teamsBuilt: schedule.teamCount,
      fullRosterTeams: schedule.fullRosterTeams,
      underfilledTeams: schedule.underfilledTeams,
      uniqueChoirs: schedule.uniqueChoirs,
      leadershipAssignments: schedule.leadershipTally.length,
      validationWarnings: schedule.validation.warnings,
      validationErrors: schedule.validation.errors,
      publishedVersion: published?.version_label ?? '—',
      draftVersion: draft?.version_label ?? null,
      monthLabel: schedule.monthLabel,
    },
    attendance: {
      monthly,
      sessions,
      members: memberAttendance,
    },
    members,
    users,
    schedule: {
      ...schedule,
      published: published
        ? {
            version: published.version_label,
            month: published.month_key,
            publishedAt: published.published_at,
            publishedBy: publisher?.display_name ?? null,
            status: 'Published',
          }
        : { version: '—', status: 'No published schedule', publishedAt: null, publishedBy: null },
      draft: draft ? { version: draft.version_label, month: draft.month_key } : null,
      history: versionHistory,
    },
    activity,
  })
})

export default router
