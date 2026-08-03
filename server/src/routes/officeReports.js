import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  blocksForJurisdiction,
  recipientRolesFor,
  resolveJurisdiction,
  ROLE_LABELS,
} from '../lib/officeReportJurisdiction.js'
import { getDraftPayload, getPublishedPayload } from '../lib/scheduleAccess.js'
import { getActiveTeamLeadershipDuties, resolveOfficeAccess } from '../lib/officeAccess.js'

const router = Router()

const today = process.env.PMSS_TODAY ?? '2026-08-02'

const LEADERSHIP = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'coordinator',
])

function parseJson(raw, fallback) {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function mapReport(row) {
  if (!row) return null
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    jurisdiction: row.jurisdiction,
    title: row.title,
    subtitle: row.subtitle,
    include: parseJson(row.include_json, {}),
    narrative: parseJson(row.narrative_json, {
      howItWent: '',
      issuesChallenges: '',
      solutions: '',
      recommendations: '',
    }),
    snapshot: parseJson(row.snapshot_json, null),
    recipientUserId: row.recipient_user_id,
    recipientName: row.recipient_name ?? null,
    recipientRole: row.recipient_role ?? null,
    status: row.status,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const REPORT_SELECT = `
  SELECT r.*,
    ru.display_name AS recipient_name,
    ru.app_role AS recipient_role
  FROM office_reports r
  LEFT JOIN users ru ON ru.id = r.recipient_user_id
`

async function actorProfile(userId) {
  return await db
    .prepare(
      `SELECT u.id, u.display_name, u.email, u.member_id, u.app_role, m.name AS member_name
       FROM users u
       LEFT JOIN members m ON m.id = u.member_id
       WHERE u.id = ?`,
    )
    .get(userId)
}

async function schedulePayload() {
  return (await getPublishedPayload()) ?? (await getDraftPayload())
}

async function officeAccessForUser(user) {
  const payload = await schedulePayload()
  const memberName = user.member_name || user.display_name
  if (user.app_role === 'member') {
    return resolveOfficeAccess({
      roleId: 'member',
      memberName,
      teamAssignments: payload?.teamAssignments ?? [],
      today,
    })
  }
  return resolveOfficeAccess({
    roleId: user.app_role,
    memberName: null,
    teamAssignments: [],
    today,
  })
}

async function jurisdictionForRequest(req) {
  const user = await actorProfile(req.auth.sub)
  if (!user) return null
  const access = await officeAccessForUser(user)
  if (req.auth.role === 'member') {
    return resolveJurisdiction('member', access.kind)
  }
  return resolveJurisdiction(req.auth.role, access.kind)
}

function allowedBlockIds(jurisdiction) {
  return new Set(blocksForJurisdiction(jurisdiction).map((b) => b.id))
}

function validateIncludeObject(include, jurisdiction) {
  if (!include || typeof include !== 'object' || Array.isArray(include)) {
    return { ok: false, error: 'include must be an object' }
  }
  const allowed = allowedBlockIds(jurisdiction)
  for (const key of Object.keys(include)) {
    if (!allowed.has(key)) {
      return { ok: false, error: `Invalid include key: ${key}` }
    }
  }
  return { ok: true }
}

function canViewReport(req, row) {
  if (LEADERSHIP.has(req.auth.role)) return true
  if (row.author_user_id === req.auth.sub) return true
  if (row.recipient_user_id === req.auth.sub) return true
  return false
}

function authorRoleForCreate(req, jurisdiction) {
  if (jurisdiction === 'team_duty') return 'team_duty'
  return req.auth.role
}

async function attendanceBreakdown() {
  const rows = await db
    .prepare(
      `SELECT r.status, COUNT(*) AS c FROM attendance_records r
       JOIN attendance_sessions s ON s.id = r.session_id
       WHERE s.status = 'submitted'
       GROUP BY r.status`,
    )
    .all()
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

function parseChoirs(choirs) {
  return String(choirs ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function scheduleAnalyticsLight(payload) {
  const services = payload?.services ?? []
  const teams = payload?.teamAssignments ?? []
  const choirs = payload?.choirAssignments ?? []
  const validationRows = payload?.validationRows ?? []
  const validationSummary = payload?.validationSummary ?? null

  const teamFill = teams.map((t) => ({
    service: t.serviceName ?? t.date,
    date: t.date,
    kind: t.kind ?? '—',
    size: t.size ?? t.members?.length ?? 0,
    target: t.kind === 'sunday' || t.kind === 'igaburo' ? 10 : 6,
    teamLeader: t.teamLeader ?? '—',
    viceTeamLeader: t.viceTeamLeader ?? '—',
    status: t.status ?? 'Assigned',
    members: t.members ?? [],
  }))

  const teamsByKind = {}
  for (const t of teamFill) {
    const k = String(t.kind || 'other').toLowerCase()
    teamsByKind[k] = (teamsByKind[k] || 0) + 1
  }

  const choirByService = choirs.map((row) => {
    const list = parseChoirs(row.choirs)
    return {
      service: row.service,
      date: row.date,
      status: row.status ?? 'Assigned',
      choirCount: list.length,
      choirs: list.join('; '),
      choirList: list,
    }
  })

  const choirFreq = {}
  for (const row of choirByService) {
    for (const c of row.choirList) {
      choirFreq[c] = (choirFreq[c] || 0) + 1
    }
  }
  const choirFrequency = Object.entries(choirFreq)
    .map(([choir, count]) => ({ choir, count }))
    .sort((a, b) => b.count - a.count)

  const dutyLoadMap = {}
  const leadershipTallyMap = {}
  const bump = (map, name, key) => {
    if (!name || name === '—') return
    if (!map[name]) map[name] = { member: name, slots: 0, tl: 0, vtl: 0 }
    map[name][key] += 1
  }
  for (const t of teamFill) {
    for (const m of t.members ?? []) bump(dutyLoadMap, m, 'slots')
    bump(dutyLoadMap, t.teamLeader, 'slots')
    bump(dutyLoadMap, t.viceTeamLeader, 'slots')
    bump(leadershipTallyMap, t.teamLeader, 'tl')
    bump(leadershipTallyMap, t.viceTeamLeader, 'vtl')
    bump(dutyLoadMap, t.teamLeader, 'tl')
    bump(dutyLoadMap, t.viceTeamLeader, 'vtl')
  }

  const dutyLoad = Object.values(dutyLoadMap)
    .map((r) => ({
      member: r.member,
      slots: r.slots,
      leadership: r.tl + r.vtl,
    }))
    .sort((a, b) => b.slots - a.slots)
    .slice(0, 80)

  const leadershipTally = Object.values(leadershipTallyMap)
    .map((r) => ({ member: r.member, tl: r.tl, vtl: r.vtl, total: r.tl + r.vtl }))
    .sort((a, b) => b.total - a.total)

  const leadershipDetail = teamFill.map((t) => ({
    date: t.date,
    service: t.service,
    teamLeader: t.teamLeader,
    viceTeamLeader: t.viceTeamLeader,
  }))

  const validation = {
    summary: validationSummary,
    rows: validationRows.slice(0, 30).map((r) => ({
      rule: r.rule,
      issue: r.issue,
      severity: r.severity,
      service: r.service,
      status: r.status,
    })),
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
    teamFill,
    teamsByKind,
    choirAssignments: choirByService,
    choirFrequency,
    dutyLoad,
    leadershipTally,
    leadershipDetail,
    validation,
    monthLabel: payload?.monthLabel ?? payload?.monthKey ?? '—',
  }
}

async function financeOverviewSnapshot() {
  const pending = (
    await db
      .prepare(`SELECT COUNT(*) AS c FROM contribution_submissions WHERE status = 'pending'`)
      .get()
  ).c
  const collected = (
    await db
      .prepare(
        `SELECT COALESCE(SUM(
         CASE
           WHEN status = 'confirmed' THEN COALESCE(confirmed_amount, claimed_amount)
           WHEN status = 'partial' THEN COALESCE(confirmed_amount, 0)
           ELSE 0
         END
       ), 0) AS total FROM contribution_submissions`,
      )
      .get()
  ).total
  const outstanding = (
    await db
      .prepare(
        `SELECT COALESCE(SUM(outstanding_amount), 0) AS total
       FROM contribution_followups WHERE status IN ('open', 'in_progress')`,
      )
      .get()
  ).total
  const activeTypes = (
    await db
      .prepare(`SELECT COUNT(*) AS c FROM contribution_types WHERE status = 'Active'`)
      .get()
  ).c
  const goals = (
    await db
      .prepare(`SELECT COALESCE(SUM(ministry_goal), 0) AS total FROM contribution_types WHERE status = 'Active'`)
      .get()
  ).total
  return {
    collected,
    pending,
    outstanding,
    activeTypes,
    goalAchievement: goals > 0 ? Math.round((collected / goals) * 100) : null,
  }
}

async function collectionSnapshot() {
  return (await db
    .prepare(
      `SELECT t.id, t.name, t.ministry_goal,
        COALESCE(SUM(CASE WHEN s.status = 'confirmed' THEN COALESCE(s.confirmed_amount, s.claimed_amount)
                          WHEN s.status = 'partial' THEN COALESCE(s.confirmed_amount, 0) ELSE 0 END), 0) AS collected
       FROM contribution_types t
       LEFT JOIN contribution_submissions s ON s.contribution_type_id = t.id
       WHERE t.status = 'Active'
       GROUP BY t.id
       ORDER BY t.name`,
    )
    .all()).map((r) => ({
      id: r.id,
      name: r.name,
      ministryGoal: r.ministry_goal,
      collected: r.collected,
      progressPct:
        r.ministry_goal > 0 ? Math.min(100, Math.round((r.collected / r.ministry_goal) * 100)) : null,
    }))
}

async function outstandingSnapshot() {
  return await db
    .prepare(
      `SELECT f.outstanding_amount, f.status, m.name AS member_name, t.name AS contribution_name
       FROM contribution_followups f
       JOIN contribution_submissions s ON s.id = f.submission_id
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       WHERE f.status IN ('open', 'in_progress')
       ORDER BY f.outstanding_amount DESC
       LIMIT 50`,
    )
    .all()
}

async function exceptionsSnapshot() {
  const partials = await db
    .prepare(
      `SELECT s.id, s.claimed_amount, s.confirmed_amount, m.name AS member_name, t.name AS contribution_name,
        'partial' AS status
       FROM contribution_submissions s
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       WHERE s.status = 'partial'
       ORDER BY s.confirmed_at DESC
       LIMIT 25`,
    )
    .all()
  const declined = await db
    .prepare(
      `SELECT s.id, s.claimed_amount, m.name AS member_name, t.name AS contribution_name,
        'declined' AS status
       FROM contribution_submissions s
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       WHERE s.status = 'declined'
       ORDER BY s.confirmed_at DESC
       LIMIT 25`,
    )
    .all()
  return { partials, declined }
}

async function memberAttendanceSnapshot() {
  return (await db
    .prepare(
      `SELECT m.name AS member,
        COUNT(*) AS marks,
        SUM(CASE WHEN r.status = 'Present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN r.status = 'Half Present' THEN 1 ELSE 0 END) AS half,
        SUM(CASE WHEN r.status = 'Quarter Present' THEN 1 ELSE 0 END) AS quarter,
        SUM(CASE WHEN r.status = 'Absent' THEN 1 ELSE 0 END) AS absent
       FROM attendance_records r
       JOIN members m ON m.id = r.member_id
       JOIN attendance_sessions s ON s.id = r.session_id
       WHERE s.status = 'submitted'
       GROUP BY m.id
       ORDER BY m.name
       LIMIT 120`,
    )
    .all()).map((r) => {
      const weighted = r.present + r.half * 0.5 + r.quarter * 0.25
      const rate = r.marks > 0 ? `${Math.round((weighted / r.marks) * 100)}%` : '—'
      return {
        member: r.member,
        marks: r.marks,
        present: r.present,
        half: r.half,
        quarter: r.quarter,
        absent: r.absent,
        rate,
      }
    })
}

async function publicationSnapshot() {
  const pub = await db
    .prepare(
      `SELECT v.id, v.status, v.version_label, v.published_at, v.month_key, u.display_name AS published_by
       FROM schedule_versions v
       LEFT JOIN users u ON u.id = v.published_by_user_id
       WHERE v.status = 'published'
       ORDER BY v.published_at DESC
       LIMIT 1`,
    )
    .get()
  const draft = await db
    .prepare(
      `SELECT id, status, version_label, created_at, month_key FROM schedule_versions WHERE status = 'draft' LIMIT 1`,
    )
    .get()
  return {
    publishedId: pub?.id ?? null,
    versionLabel: pub?.version_label ?? draft?.version_label ?? null,
    monthKey: pub?.month_key ?? draft?.month_key ?? null,
    publishedAt: pub?.published_at ?? null,
    publishedBy: pub?.published_by ?? null,
    draftId: draft?.id ?? null,
    draftUpdated: draft?.created_at ?? null,
    status: pub ? 'Published' : draft ? 'Draft only' : 'None',
  }
}

async function historySnapshot() {
  return (await db
    .prepare(
      `SELECT v.id, v.version_label, v.status, v.month_key, v.published_at, v.created_at,
        u.display_name AS published_by
       FROM schedule_versions v
       LEFT JOIN users u ON u.id = v.published_by_user_id
       ORDER BY COALESCE(v.published_at, v.created_at) DESC
       LIMIT 15`,
    )
    .all()).map((r) => ({
      id: r.id,
      label: r.version_label,
      status: r.status,
      month: r.month_key,
      publishedAt: r.published_at,
      publishedBy: r.published_by,
      createdAt: r.created_at,
    }))
}

async function membersByChoirSnapshot() {
  return await db
    .prepare(
      `SELECT COALESCE(NULLIF(choir, ''), 'Unassigned') AS choir, COUNT(*) AS members
       FROM members
       WHERE status = 'Active' AND role = 'Member'
       GROUP BY COALESCE(NULLIF(choir, ''), 'Unassigned')
       ORDER BY members DESC`,
    )
    .all()
}

async function usersOverviewSnapshot() {
  const rows = await db.prepare(`SELECT status, COUNT(*) AS c FROM users GROUP BY status`).all()
  const by = Object.fromEntries(rows.map((r) => [r.status, r.c]))
  return {
    active: by.Active ?? 0,
    invited: by.Invited ?? 0,
    deactivated: by.Deactivated ?? by.Inactive ?? 0,
    total: rows.reduce((n, r) => n + r.c, 0),
  }
}

async function publicGoalsSnapshot() {
  return (await db
    .prepare(
      `SELECT t.id, t.name, t.ministry_goal, t.visibility,
        COALESCE(SUM(CASE WHEN s.status = 'confirmed' THEN COALESCE(s.confirmed_amount, s.claimed_amount)
                          WHEN s.status = 'partial' THEN COALESCE(s.confirmed_amount, 0) ELSE 0 END), 0) AS collected
       FROM contribution_types t
       LEFT JOIN contribution_submissions s ON s.contribution_type_id = t.id
       WHERE t.status = 'Active' AND (t.visibility = 'public' OR t.visibility IS NULL OR t.visibility = '')
       GROUP BY t.id
       ORDER BY t.name`,
    )
    .all()).map((r) => ({
      name: r.name,
      goal: r.ministry_goal,
      collected: r.collected,
      progressPct:
        r.ministry_goal > 0 ? Math.min(100, Math.round((r.collected / r.ministry_goal) * 100)) : null,
    }))
}

async function typesCatalogSnapshot() {
  return await db
    .prepare(
      `SELECT name, ministry_goal, frequency, status, visibility
       FROM contribution_types
       ORDER BY name`,
    )
    .all()
}

async function methodsCatalogSnapshot() {
  return await db
    .prepare(
      `SELECT label AS name, kind AS channel,
        CASE WHEN active = 1 THEN 'Active' ELSE 'Inactive' END AS status
       FROM payment_methods
       ORDER BY sort_order, label`,
    )
    .all()
}

async function memberFinanceSnapshot() {
  return await db
    .prepare(
      `SELECT m.name AS member,
        COALESCE(SUM(s.claimed_amount), 0) AS claimed,
        COALESCE(SUM(CASE WHEN s.status = 'confirmed' THEN COALESCE(s.confirmed_amount, s.claimed_amount)
                          WHEN s.status = 'partial' THEN COALESCE(s.confirmed_amount, 0) ELSE 0 END), 0) AS confirmed
       FROM members m
       LEFT JOIN contribution_submissions s ON s.member_id = m.id
       WHERE m.status = 'Active'
       GROUP BY m.id
       HAVING claimed > 0 OR confirmed > 0
       ORDER BY confirmed DESC
       LIMIT 80`,
    )
    .all()
}

async function followupsSnapshot() {
  return await db
    .prepare(
      `SELECT f.status, f.outstanding_amount, m.name AS member_name, t.name AS contribution_name
       FROM contribution_followups f
       JOIN contribution_submissions s ON s.id = f.submission_id
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       WHERE f.status IN ('open', 'in_progress')
       ORDER BY f.outstanding_amount DESC
       LIMIT 50`,
    )
    .all()
}

async function submissionsByStatus(status, limit = 40) {
  return await db
    .prepare(
      `SELECT s.id, s.claimed_amount, s.confirmed_amount, s.status, s.submitted_at,
        m.name AS member_name, t.name AS contribution_name
       FROM contribution_submissions s
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       WHERE s.status = ?
       ORDER BY COALESCE(s.confirmed_at, s.submitted_at) DESC
       LIMIT ?`,
    )
    .all(status, limit)
}

async function activitySnapshot() {
  return await db
    .prepare(
      `SELECT a.action, a.created_at, u.display_name AS actor
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ORDER BY a.created_at DESC
       LIMIT 40`,
    )
    .all()
}

async function buildBundleSnapshot(req, includeIds, jurisdiction) {
  const want = new Set(includeIds)
  const snapshot = {}
  const user = await actorProfile(req.auth.sub)
  const access = await officeAccessForUser(user)
  const payload = await schedulePayload()

  if (want.has('dutyMeta')) {
    snapshot.dutyMeta = {
      today: access.today ?? today,
      activeDuties: access.activeDuties ?? [],
    }
  }
  if (want.has('dutyTeam')) {
    snapshot.dutyTeam = {
      duties: (access.activeDuties ?? []).map((d) => ({
        serviceId: d.serviceId,
        serviceName: d.serviceName,
        serviceDate: d.serviceDate,
        dutyRole: d.dutyRole,
        teamLeader: d.teamLeader,
        viceTeamLeader: d.viceTeamLeader,
        members: d.members ?? [],
      })),
    }
  }

  const analytics = scheduleAnalyticsLight(payload)
  const monthly = await attendanceBreakdown()

  if (want.has('overview')) {
    snapshot.overview = {
      attendanceRate: monthly.rate,
      attendanceMarks: monthly.total,
      activeMembers: (await db.prepare(`SELECT COUNT(*) AS c FROM members WHERE status = 'Active'`).get()).c,
      protocolMembers: (
        await db
          .prepare(`SELECT COUNT(*) AS c FROM members WHERE role = 'Member' AND status = 'Active'`)
          .get()
      ).c,
      servicesScheduled: analytics.serviceCount,
      teamsBuilt: analytics.teamFill.length,
      monthLabel: analytics.monthLabel,
    }
  }
  if (want.has('publication')) {
    snapshot.publication = await publicationSnapshot()
  }
  if (want.has('attendance')) {
    snapshot.attendance = { monthly }
  }
  if (want.has('sessions')) {
    snapshot.sessions = (await db
      .prepare(
        `SELECT s.id, s.service_name, s.service_date, s.status, s.submitted_at,
          (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id) AS recorded,
          (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status = 'Present') AS present_n
         FROM attendance_sessions s
         ORDER BY s.service_date DESC
         LIMIT 10`,
      )
      .all())
      .map((s) => ({
        id: s.id,
        service: s.service_name,
        date: s.service_date,
        status: s.status,
        recorded: s.recorded ?? 0,
        present: s.present_n ?? 0,
        rate:
          s.recorded > 0 ? `${Math.round(((s.present_n ?? 0) / s.recorded) * 100)}%` : '—',
        submittedAt: s.submitted_at,
      }))
  }
  if (want.has('memberAttendance')) {
    snapshot.memberAttendance = await memberAttendanceSnapshot()
  }
  if (want.has('services')) {
    snapshot.services = analytics.services
  }
  if (want.has('teamsByKind')) {
    snapshot.teamsByKind = analytics.teamsByKind
  }
  if (want.has('teams')) {
    snapshot.teams = analytics.teamFill
  }
  if (want.has('choirFrequency')) {
    snapshot.choirFrequency = analytics.choirFrequency
  }
  if (want.has('choirs')) {
    snapshot.choirs = analytics.choirAssignments
  }
  if (want.has('dutyLoad')) {
    snapshot.dutyLoad = analytics.dutyLoad
  }
  if (want.has('leadershipTally')) {
    snapshot.leadershipTally = analytics.leadershipTally
  }
  if (want.has('leadershipDetail')) {
    snapshot.leadershipDetail = analytics.leadershipDetail
  }
  if (want.has('validation')) {
    snapshot.validation = analytics.validation
  }
  if (want.has('history')) {
    snapshot.history = await historySnapshot()
  }
  if (want.has('membersOverview')) {
    snapshot.membersOverview = {
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
    }
  }
  if (want.has('membersByChoir')) {
    snapshot.membersByChoir = await membersByChoirSnapshot()
  }
  if (want.has('usersOverview')) {
    snapshot.usersOverview = await usersOverviewSnapshot()
  }
  if (want.has('financeOverview')) {
    snapshot.financeOverview = await financeOverviewSnapshot()
  }
  if (want.has('publicGoals')) {
    snapshot.publicGoals = await publicGoalsSnapshot()
  }
  if (want.has('collection')) {
    snapshot.collection = await collectionSnapshot()
  }
  if (want.has('typesCatalog')) {
    snapshot.typesCatalog = await typesCatalogSnapshot()
  }
  if (want.has('methodsCatalog')) {
    snapshot.methodsCatalog = await methodsCatalogSnapshot()
  }
  if (want.has('memberFinance')) {
    snapshot.memberFinance = await memberFinanceSnapshot()
  }
  if (want.has('outstanding')) {
    snapshot.outstanding = await outstandingSnapshot()
  }
  if (want.has('followups')) {
    snapshot.followups = await followupsSnapshot()
  }
  if (want.has('pending')) {
    snapshot.pending = await submissionsByStatus('pending')
  }
  if (want.has('confirmed')) {
    snapshot.confirmed = await submissionsByStatus('confirmed')
  }
  if (want.has('exceptions')) {
    snapshot.exceptions = await exceptionsSnapshot()
  }
  if (want.has('activity')) {
    snapshot.activity = await activitySnapshot()
  }

  return snapshot
}

router.get('/catalog', authMiddleware, async (req, res) => {
  const jurisdiction = await jurisdictionForRequest(req)
  if (!jurisdiction) {
    return res.status(403).json({ error: 'No office report jurisdiction for this account' })
  }

  const user = await actorProfile(req.auth.sub)
  const blocks = blocksForJurisdiction(jurisdiction)
  const roles = recipientRolesFor(jurisdiction)
  const placeholders = roles.map(() => '?').join(', ')
  const recipients =
    roles.length === 0
      ? []
      : (await db
          .prepare(
            `SELECT id, display_name, app_role FROM users
             WHERE status = 'Active' AND app_role IN (${placeholders})
             ORDER BY display_name`,
          )
          .all(...roles))
          .map((u) => ({
            id: u.id,
            displayName: u.display_name,
            appRole: u.app_role,
            roleLabel: ROLE_LABELS[u.app_role] ?? u.app_role,
          }))

  return res.json({
    jurisdiction,
    blocks,
    recipientRoles: roles,
    recipients,
    authorName: user?.member_name || user?.display_name || null,
    authorRole: jurisdiction === 'team_duty' ? 'team_duty' : req.auth.role,
    authorEmail: user?.email ?? null,
  })
})

router.get('/bundle', authMiddleware, async (req, res) => {
  const jurisdiction = await jurisdictionForRequest(req)
  if (!jurisdiction) {
    return res.status(403).json({ error: 'No office report jurisdiction for this account' })
  }

  const rawInclude = String(req.query.include ?? '').trim()
  const includeIds = rawInclude
    ? rawInclude
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : blocksForJurisdiction(jurisdiction).map((b) => b.id)

  const allowed = allowedBlockIds(jurisdiction)
  for (const id of includeIds) {
    if (!allowed.has(id)) {
      return res.status(400).json({ error: `Section not allowed for jurisdiction: ${id}` })
    }
  }

  const snapshot = await buildBundleSnapshot(req, includeIds, jurisdiction)
  return res.json({
    jurisdiction,
    include: includeIds,
    snapshot,
    generatedAt: new Date().toISOString(),
  })
})

router.get('/', authMiddleware, async (req, res) => {
  const { mine, inbox } = req.query
  let sql = `${REPORT_SELECT} WHERE 1=1`
  const params = []

  if (LEADERSHIP.has(req.auth.role)) {
    if (mine === '1') {
      sql += ` AND r.author_user_id = ?`
      params.push(req.auth.sub)
    } else if (inbox === '1') {
      sql += ` AND r.recipient_user_id = ?`
      params.push(req.auth.sub)
    } else {
      sql += ` AND (r.author_user_id = ? OR r.recipient_user_id = ?)`
      params.push(req.auth.sub, req.auth.sub)
    }
  } else if (req.auth.role === 'member') {
    sql += ` AND r.author_user_id = ?`
    params.push(req.auth.sub)
  } else {
    return res.status(403).json({ error: 'Forbidden' })
  }

  sql += ` ORDER BY r.updated_at DESC LIMIT 50`
  const rows = await db.prepare(sql).all(...params)
  return res.json({ reports: rows.map(mapReport) })
})

router.get('/:id', authMiddleware, async (req, res) => {
  const row = await db.prepare(`${REPORT_SELECT} WHERE r.id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (!canViewReport(req, row)) return res.status(403).json({ error: 'Forbidden' })
  return res.json({ report: mapReport(row) })
})

router.post('/', authMiddleware, async (req, res) => {
  const jurisdiction = await jurisdictionForRequest(req)
  if (!jurisdiction) {
    return res.status(403).json({ error: 'No office report jurisdiction for this account' })
  }

  const b = req.body ?? {}
  const title = String(b.title ?? '').trim()
  if (!title) return res.status(400).json({ error: 'title required' })

  const include = b.include ?? {}
  const includeCheck = validateIncludeObject(include, jurisdiction)
  if (!includeCheck.ok) return res.status(400).json({ error: includeCheck.error })

  const narrativeIn = b.narrative ?? {}
  const narrative = {
    howItWent: String(narrativeIn.howItWent ?? ''),
    issuesChallenges: String(narrativeIn.issuesChallenges ?? ''),
    solutions: String(narrativeIn.solutions ?? ''),
    recommendations: String(narrativeIn.recommendations ?? ''),
  }

  const snapshot = b.snapshot != null ? b.snapshot : null
  const user = await actorProfile(req.auth.sub)
  const id = uuid()

  await db.prepare(
    `INSERT INTO office_reports (
      id, author_user_id, author_name, author_role, jurisdiction,
      title, subtitle, include_json, narrative_json, snapshot_json,
      recipient_user_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'draft')`,
  ).run(
    id,
    req.auth.sub,
    user?.member_name || user?.display_name || 'User',
    authorRoleForCreate(req, jurisdiction),
    jurisdiction,
    title,
    b.subtitle != null ? String(b.subtitle) : null,
    JSON.stringify(include),
    JSON.stringify(narrative),
    snapshot != null ? JSON.stringify(snapshot) : null,
  )

  await audit('office_report.create', req.auth.sub, { id, jurisdiction })
  const row = await db.prepare(`${REPORT_SELECT} WHERE r.id = ?`).get(id)
  return res.status(201).json({ report: mapReport(row), created: true })
})

router.put('/:id', authMiddleware, async (req, res) => {
  const row = await db.prepare(`SELECT * FROM office_reports WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.author_user_id !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' })
  if (row.status !== 'draft') {
    return res.status(400).json({ error: 'Only draft reports can be edited' })
  }

  const b = req.body ?? {}
  const jurisdiction = row.jurisdiction

  let includeJson = row.include_json
  if (b.include != null) {
    const includeCheck = validateIncludeObject(b.include, jurisdiction)
    if (!includeCheck.ok) return res.status(400).json({ error: includeCheck.error })
    includeJson = JSON.stringify(b.include)
  }

  let narrativeJson = row.narrative_json
  if (b.narrative != null) {
    const n = b.narrative
    narrativeJson = JSON.stringify({
      howItWent: n.howItWent != null ? String(n.howItWent) : parseJson(row.narrative_json, {}).howItWent ?? '',
      issuesChallenges:
        n.issuesChallenges != null
          ? String(n.issuesChallenges)
          : parseJson(row.narrative_json, {}).issuesChallenges ?? '',
      solutions: n.solutions != null ? String(n.solutions) : parseJson(row.narrative_json, {}).solutions ?? '',
      recommendations:
        n.recommendations != null
          ? String(n.recommendations)
          : parseJson(row.narrative_json, {}).recommendations ?? '',
    })
  }

  let snapshotJson = row.snapshot_json
  if (b.snapshot !== undefined) {
    snapshotJson = b.snapshot != null ? JSON.stringify(b.snapshot) : null
  }

  await db.prepare(
    `UPDATE office_reports SET
      title = ?,
      subtitle = ?,
      include_json = ?,
      narrative_json = ?,
      snapshot_json = ?,
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    b.title != null ? String(b.title).trim() : row.title,
    b.subtitle !== undefined ? (b.subtitle != null ? String(b.subtitle) : null) : row.subtitle,
    includeJson,
    narrativeJson,
    snapshotJson,
    row.id,
  )

  const updated = await db.prepare(`${REPORT_SELECT} WHERE r.id = ?`).get(row.id)
  return res.json({ report: mapReport(updated) })
})

router.post('/:id/submit', authMiddleware, async (req, res) => {
  const row = await db.prepare(`SELECT * FROM office_reports WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.author_user_id !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' })
  if (row.status === 'submitted') {
    const existing = await db.prepare(`${REPORT_SELECT} WHERE r.id = ?`).get(row.id)
    return res.json({ report: mapReport(existing) })
  }

  const jurisdiction = row.jurisdiction
  const allowedRecipients = recipientRolesFor(jurisdiction)
  const b = req.body ?? {}
  let recipientUserId = b.recipientUserId ?? b.recipient_user_id ?? null
  if (recipientUserId != null) recipientUserId = String(recipientUserId)

  if (allowedRecipients.length === 0) {
    recipientUserId = recipientUserId || null
  } else {
    if (!recipientUserId) {
      return res.status(400).json({ error: 'recipientUserId required' })
    }
    const recipient = await db.prepare(`SELECT id, app_role, status FROM users WHERE id = ?`).get(recipientUserId)
    if (!recipient || recipient.status !== 'Active') {
      return res.status(400).json({ error: 'Invalid recipient' })
    }
    if (!allowedRecipients.includes(recipient.app_role)) {
      return res.status(400).json({ error: 'Recipient role is not allowed for this report type' })
    }
  }

  await db.prepare(
    `UPDATE office_reports SET
      recipient_user_id = ?,
      status = 'submitted',
      submitted_at = datetime('now'),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(recipientUserId, row.id)

  await audit('office_report.submit', req.auth.sub, {
    id: row.id,
    jurisdiction,
    recipientUserId,
  })
  const updated = await db.prepare(`${REPORT_SELECT} WHERE r.id = ?`).get(row.id)
  return res.json({ report: mapReport(updated) })
})

export default router
