import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { loadRulesFromDb } from '../lib/settingsStore.js'
import { validateSchedulePayload, publishBlocked, validateChoirPayload } from '../lib/validation.js'
import { sanitizeTeamAssignments } from '../lib/teamEngine.js'
import { serveDaysMapFromMembers } from '../lib/memberAvailability.js'
import { protocolNamePool } from '../pilotData.js'
import {
  ensureDraftForMonth,
  getDraftRow,
  getLatestPublishedForMonth,
  repairMismatchedDrafts,
} from '../lib/scheduleAccess.js'
import {
  emptyMonthPayload,
  getLiveMonthKey,
  monthLabelFromKey,
  nextMonthKey,
  isChoirPublished,
  repairChoirPublishMeta,
} from '../lib/scheduleMonths.js'

const router = Router()

/** Can open drafts / see private months */
const DRAFT_ACCESS_ROLES = new Set(['coordinator', 'secretary', 'choir_scheduler'])
/** Can edit calendar, teams, leadership, full publish */
const TEAM_EDIT_ROLES = new Set(['coordinator', 'secretary'])
/** Can edit choir assignments */
const CHOIR_EDIT_ROLES = new Set(['choir_scheduler'])
/** Can publish the choir schedule (choir scheduler only) */
const CHOIR_PUBLISH_ROLES = new Set(['choir_scheduler'])
/** Legacy alias used by months catalog */
const EDIT_ROLES = DRAFT_ACCESS_ROLES

function parsePayload(row) {
  return JSON.parse(row.payload_json)
}

function rowIsPublic(row) {
  return Boolean(row?.is_public)
}

function normalizeChoirMeta(payload) {
  return repairChoirPublishMeta({
    ...payload,
    choirStatus: isChoirPublished(payload) ? 'published' : 'draft',
    choirPublishedAt: payload.choirPublishedAt ?? null,
    choirPublishedBy: payload.choirPublishedBy ?? null,
  })
}

/** Client sent choir edits while aware of the current publish stamp — allow unpublish. */
function clientAcknowledgesChoirPublish(payload, previous) {
  if (!previous?.choirPublishedAt) return true
  return String(payload?.choirPublishedAt ?? '') === String(previous.choirPublishedAt)
}

async function attachValidation(payload) {
  const rules = await loadRulesFromDb()
  const memberRows = await db.prepare(`SELECT * FROM members`).all()
  const memberByName = Object.fromEntries(memberRows.map((m) => [m.name, m]))
  const serveDaysByName = serveDaysMapFromMembers(memberRows)
  const protocolPool = protocolNamePool(memberRows)
  const teamAssignments = sanitizeTeamAssignments(payload.teamAssignments ?? [], {
    protocolPool,
    serveDaysByName,
    teamEngineMeta: payload.teamEngineMeta,
  })
  const leadershipReview = teamAssignments
    .filter((t) => t.kind === 'sunday')
    .slice(0, 4)
    .map((t, i) => ({
      date: t.date,
      tl: t.teamLeader,
      vtl: t.viceTeamLeader,
      status: payload.leadershipReview?.[i]?.status ?? (i < 3 ? 'Approved' : 'Pending approval'),
    }))
  const sanitized = normalizeChoirMeta({ ...payload, teamAssignments, leadershipReview })
  const { rows, summary } = validateSchedulePayload(sanitized, rules, { memberByName, serveDaysByName })
  return { ...sanitized, validationRows: rows, validationSummary: summary }
}

function resolveMonthKey(req) {
  const fromQuery = req.query?.month
  const fromBody = req.body?.monthKey
  const raw = fromQuery || fromBody
  if (raw && /^\d{4}-\d{2}$/.test(String(raw))) return String(raw)
  return null
}

async function listMonthKeysFromDb() {
  const rows = await db
    .prepare(`SELECT DISTINCT month_key FROM schedule_versions ORDER BY month_key ASC`)
    .all()
  return rows.map((r) => r.month_key).filter(Boolean)
}

async function buildMonthsCatalog(canEdit) {
  const live = getLiveMonthKey()
  const next = nextMonthKey(live)
  const existing = await listMonthKeysFromDb()
  const keys = new Set(existing)
  keys.add(live)
  if (canEdit && next) keys.add(next)

  const months = []
  for (const monthKey of [...keys].sort()) {
    const draft = await getDraftRow(monthKey)
    const published = await getLatestPublishedForMonth(monthKey, { publicOnly: false })
    const draftPayload = draft ? normalizeChoirMeta(parsePayload(draft)) : null
    const isPublic = published ? rowIsPublic(published) : false
    const visible = Boolean(published && isPublic && !published.archived_at)
    if (!canEdit && !visible) continue

    months.push({
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      isLive: monthKey === live,
      isNext: monthKey === next,
      hasDraft: Boolean(draft),
      draftId: draft?.id ?? null,
      hasCalendar: (draftPayload?.services?.length ?? 0) > 0,
      choirStatus: draftPayload?.choirStatus ?? 'draft',
      choirPublished: isChoirPublished(draftPayload),
      published: published
        ? {
            id: published.id,
            versionLabel: published.version_label,
            publishedAt: published.published_at,
            isPublic,
            archived: Boolean(published.archived_at),
          }
        : null,
      visible,
      visibility: !published ? 'none' : isPublic ? 'public' : 'private',
    })
  }

  return {
    liveMonthKey: live,
    nextMonthKey: next,
    liveMonthLabel: monthLabelFromKey(live),
    nextMonthLabel: next ? monthLabelFromKey(next) : null,
    months,
  }
}

router.get('/months', authMiddleware, async (req, res) => {
  const canEdit = DRAFT_ACCESS_ROLES.has(req.auth.role)
  const catalog = await buildMonthsCatalog(canEdit)
  return res.json({
    ...catalog,
    canEdit,
    canEditChoir: CHOIR_EDIT_ROLES.has(req.auth.role),
    canEditTeams: TEAM_EDIT_ROLES.has(req.auth.role),
  })
})

router.get('/current', authMiddleware, async (req, res) => {
  const canEdit = DRAFT_ACCESS_ROLES.has(req.auth.role)
  const canEditChoir = CHOIR_EDIT_ROLES.has(req.auth.role)
  const canEditTeams = TEAM_EDIT_ROLES.has(req.auth.role)
  const live = getLiveMonthKey()
  const requested = resolveMonthKey(req) || live
  const catalog = await buildMonthsCatalog(canEdit)

  if (canEdit) {
    await repairMismatchedDrafts()
    let draft = await ensureDraftForMonth(requested)
    if (!draft) {
      const empty = emptyMonthPayload(requested)
      return res.json({
        source: 'empty',
        editable: true,
        editableChoir: canEditChoir,
        editableTeams: canEditTeams,
        id: null,
        monthKey: requested,
        versionLabel: null,
        visibility: 'none',
        isPublic: false,
        months: catalog.months,
        liveMonthKey: live,
        nextMonthKey: catalog.nextMonthKey,
        payload: empty,
      })
    }
    const payload = await attachValidation(parsePayload(draft))
    const published = await getLatestPublishedForMonth(draft.month_key)
    if (
      payload.choirPublishedAt &&
      isChoirPublished(payload) &&
      String(parsePayload(draft).choirStatus ?? '').toLowerCase() !== 'published'
    ) {
      await db
        .prepare(`UPDATE schedule_versions SET payload_json = ? WHERE id = ?`)
        .run(JSON.stringify(payload), draft.id)
    }
    return res.json({
      source: 'draft',
      editable: true,
      editableChoir: canEditChoir,
      editableTeams: canEditTeams,
      choirPublished: isChoirPublished(payload),
      id: draft.id,
      monthKey: draft.month_key,
      versionLabel: draft.version_label,
      visibility: published ? (rowIsPublic(published) ? 'public' : 'private') : 'draft',
      isPublic: published ? rowIsPublic(published) : false,
      published: published
        ? {
            id: published.id,
            versionLabel: published.version_label,
            publishedAt: published.published_at,
            isPublic: rowIsPublic(published),
          }
        : null,
      months: catalog.months,
      liveMonthKey: live,
      nextMonthKey: catalog.nextMonthKey,
      payload,
    })
  }

  // Non-editors: only public published months
  const published = await getLatestPublishedForMonth(requested, { publicOnly: true })
  if (published) {
    return res.json({
      source: 'published',
      editable: false,
      editableChoir: false,
      editableTeams: false,
      id: published.id,
      monthKey: published.month_key,
      versionLabel: published.version_label,
      publishedAt: published.published_at,
      visibility: 'public',
      isPublic: true,
      months: catalog.months,
      liveMonthKey: live,
      nextMonthKey: catalog.nextMonthKey,
      payload: parsePayload(published),
    })
  }

  // Fallback to live public if requested month not visible
  if (requested !== live) {
    const livePub = await getLatestPublishedForMonth(live, { publicOnly: true })
    if (livePub) {
      return res.json({
        source: 'published',
        editable: false,
        editableChoir: false,
        editableTeams: false,
        id: livePub.id,
        monthKey: livePub.month_key,
        versionLabel: livePub.version_label,
        publishedAt: livePub.published_at,
        visibility: 'public',
        isPublic: true,
        months: catalog.months,
        liveMonthKey: live,
        nextMonthKey: catalog.nextMonthKey,
        payload: parsePayload(livePub),
      })
    }
  }

  return res.status(404).json({ error: 'No public schedule for this month' })
})

router.get('/draft', authMiddleware, async (req, res) => {
  if (!DRAFT_ACCESS_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const monthKey = resolveMonthKey(req) || getLiveMonthKey()
  const draft = await getDraftRow(monthKey)
  if (!draft) {
    return res.status(404).json({ error: 'No draft schedule for this month' })
  }
  const payload = await attachValidation(parsePayload(draft))
  return res.json({
    id: draft.id,
    versionLabel: draft.version_label,
    monthKey: draft.month_key,
    payload,
  })
})

router.put('/draft', authMiddleware, async (req, res) => {
  if (!DRAFT_ACCESS_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const role = req.auth.role
  const choirOnly = role === 'choir_scheduler'
  const canTeams = TEAM_EDIT_ROLES.has(role)
  const canChoir = CHOIR_EDIT_ROLES.has(role)

  const { payload } = req.body ?? {}
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload object required' })
  }

  const monthKey = payload.monthKey || resolveMonthKey(req) || getLiveMonthKey()
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return res.status(400).json({ error: 'Valid monthKey (YYYY-MM) required' })
  }

  let draft = await getDraftRow(monthKey)
  const previous = draft ? normalizeChoirMeta(parsePayload(draft)) : emptyMonthPayload(monthKey)

  let merged
  if (choirOnly) {
    const servicesChanged =
      JSON.stringify(previous.services ?? []) !== JSON.stringify(payload.services ?? [])
    const choirChanged =
      JSON.stringify(previous.choirAssignments ?? []) !== JSON.stringify(payload.choirAssignments ?? [])
    merged = {
      ...previous,
      services: payload.services ?? previous.services,
      choirAssignments: canChoir
        ? (payload.choirAssignments ?? previous.choirAssignments)
        : previous.choirAssignments,
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      choirStatus: previous.choirStatus,
      choirPublishedAt: previous.choirPublishedAt,
      choirPublishedBy: previous.choirPublishedBy,
    }
    // Regenerating the month calendar resets choir + teams so the month stays ordered
    if (servicesChanged) {
      merged.choirAssignments = payload.choirAssignments ?? []
      merged.teamAssignments = []
      merged.leadershipReview = []
      merged.choirStatus = 'draft'
      merged.choirPublishedAt = null
      merged.choirPublishedBy = null
    } else if (choirChanged && isChoirPublished(previous)) {
      if (clientAcknowledgesChoirPublish(payload, previous)) {
        merged.choirStatus = 'draft'
        merged.choirPublishedAt = null
        merged.choirPublishedBy = null
      } else {
        merged.choirAssignments = previous.choirAssignments
        merged.choirStatus = previous.choirStatus
        merged.choirPublishedAt = previous.choirPublishedAt
        merged.choirPublishedBy = previous.choirPublishedBy
      }
    }
  } else {
    merged = {
      ...previous,
      ...payload,
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      choirStatus: previous.choirStatus,
      choirPublishedAt: previous.choirPublishedAt,
      choirPublishedBy: previous.choirPublishedBy,
    }
    if (!canChoir) {
      merged.choirAssignments = previous.choirAssignments
    } else if (
      JSON.stringify(previous.choirAssignments ?? []) !== JSON.stringify(payload.choirAssignments ?? []) &&
      isChoirPublished(previous)
    ) {
      if (clientAcknowledgesChoirPublish(payload, previous)) {
        merged.choirStatus = 'draft'
        merged.choirPublishedAt = null
        merged.choirPublishedBy = null
      } else {
        merged.choirAssignments = previous.choirAssignments
      }
    }
    if (!canTeams) {
      merged.teamAssignments = previous.teamAssignments
      merged.leadershipReview = previous.leadershipReview
      merged.services = previous.services
    }
  }

  const validated = await attachValidation(merged)

  if (!draft) {
    const id = uuid()
    await db
      .prepare(
        `INSERT INTO schedule_versions (id, version_label, status, month_key, payload_json, is_public)
         VALUES (?, 'Draft', 'draft', ?, ?, 0)`,
      )
      .run(id, monthKey, JSON.stringify(validated))
    draft = await getDraftRow(monthKey)
  } else {
    await db
      .prepare(`UPDATE schedule_versions SET payload_json = ?, month_key = ? WHERE id = ?`)
      .run(JSON.stringify(validated), monthKey, draft.id)
  }

  const monthLabel = validated.monthLabel || monthKey
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

  if (canTeams && !same(previous.teamAssignments, validated.teamAssignments)) {
    await audit('schedule.team_assignments', req.auth.sub, {
      monthKey,
      monthLabel,
      teams: validated.teamAssignments?.length ?? 0,
      summary: `Service teams updated for ${monthLabel}`,
    })
  }
  if (canChoir && !same(previous.choirAssignments, validated.choirAssignments)) {
    await audit('schedule.choir_assignments', req.auth.sub, {
      monthKey,
      monthLabel,
      choirs: validated.choirAssignments?.length ?? 0,
      summary: `Choir schedule updated for ${monthLabel}`,
    })
  }
  if (canTeams && !same(previous.leadershipReview, validated.leadershipReview)) {
    const nextLead = validated.leadershipReview ?? []
    const approved =
      nextLead.length > 0 && nextLead.every((r) => /approv/i.test(String(r.status ?? '')))
    await audit(approved ? 'schedule.leadership_approved' : 'schedule.leadership_updated', req.auth.sub, {
      monthKey,
      monthLabel,
      summary: approved
        ? `Leadership assignments approved for ${monthLabel}`
        : `Leadership assignments updated for ${monthLabel}`,
    })
  }

  await audit('schedule.draft_update', req.auth.sub, { draftId: draft.id, monthKey })

  return res.json({ ok: true, payload: validated, monthKey, id: draft.id })
})

router.get('/validate', authMiddleware, async (req, res) => {
  const monthKey = resolveMonthKey(req) || getLiveMonthKey()
  const draft = await getDraftRow(monthKey)
  if (!draft) return res.status(404).json({ error: 'No draft schedule' })
  const payload = parsePayload(draft)
  const validated = await attachValidation(payload)
  return res.json({ rows: validated.validationRows, summary: validated.validationSummary })
})

router.post('/publish-choir', authMiddleware, async (req, res) => {
  if (!CHOIR_PUBLISH_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Only the choir scheduler can publish the choir schedule' })
  }

  const monthKey = resolveMonthKey(req) || req.body?.monthKey || getLiveMonthKey()
  const draft = await getDraftRow(monthKey)
  if (!draft) {
    return res.status(404).json({ error: 'No draft schedule for this month' })
  }

  const rules = await loadRulesFromDb()
  const previous = normalizeChoirMeta(parsePayload(draft))
  const choirValidation = validateChoirPayload(previous, rules)
  if (choirValidation.summary.errors > 0) {
    return res.status(400).json({
      error: 'Choir publish blocked — fix choir validation errors first',
      validationSummary: choirValidation.summary,
      validationRows: choirValidation.rows,
    })
  }

  const publisher = await db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(req.auth.sub)
  const publishedPayload = {
    ...previous,
    choirStatus: 'published',
    choirPublishedAt: new Date().toISOString(),
    choirPublishedBy: publisher?.display_name ?? 'Choir Scheduler',
  }
  const validated = await attachValidation(publishedPayload)

  await db
    .prepare(`UPDATE schedule_versions SET payload_json = ? WHERE id = ?`)
    .run(JSON.stringify(validated), draft.id)

  await audit('schedule.choir_publish', req.auth.sub, {
    monthKey,
    monthLabel: validated.monthLabel || monthKey,
    choirs: validated.choirAssignments?.length ?? 0,
    summary: `Choir schedule published for ${validated.monthLabel || monthKey}`,
  })

  return res.json({
    ok: true,
    monthKey,
    payload: validated,
    choirStatus: 'published',
    choirPublishedAt: validated.choirPublishedAt,
    choirPublishedBy: validated.choirPublishedBy,
  })
})

router.post('/publish', authMiddleware, async (req, res) => {
  if (req.auth.role !== 'coordinator') {
    return res.status(403).json({ error: 'Only coordinator can publish' })
  }

  const live = getLiveMonthKey()
  const monthKey = resolveMonthKey(req) || req.body?.monthKey || live
  const draft = await getDraftRow(monthKey)
  if (!draft) {
    return res.status(404).json({ error: 'No draft schedule for this month' })
  }

  const rules = await loadRulesFromDb()
  const payload = normalizeChoirMeta(parsePayload(draft))
  if (!isChoirPublished(payload)) {
    return res.status(400).json({
      error: 'Publish blocked — choir schedule must be published first by the choir scheduler',
    })
  }
  const validated = await attachValidation(payload)
  const validation = { rows: validated.validationRows, summary: validated.validationSummary }
  if (publishBlocked(validation.summary, rules)) {
    return res.status(400).json({
      error: 'Publish blocked — fix validation errors first',
      validationSummary: validation.summary,
      validationRows: validation.rows,
    })
  }

  const publishedCount =
    (await db.prepare(`SELECT COUNT(*) AS c FROM schedule_versions WHERE status = 'published'`).get()).c + 1
  const versionLabel = `V${publishedCount}`

  // Live month publishes are public; future months stay private until Make public.
  const makePublic = monthKey <= live
  const publishId = uuid()
  const publishPayload = {
    ...validated,
    publishedAt: new Date().toISOString(),
    versionLabel,
    monthKey,
    monthLabel: validated.monthLabel || monthLabelFromKey(monthKey),
  }

  const publisher = await db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(req.auth.sub)

  await db
    .prepare(
      `INSERT INTO schedule_versions (id, version_label, status, month_key, payload_json, published_at, published_by_user_id, is_public)
       VALUES (?, ?, 'published', ?, ?, datetime('now'), ?, ?)`,
    )
    .run(publishId, versionLabel, monthKey, JSON.stringify(publishPayload), req.auth.sub, makePublic ? 1 : 0)

  await audit('schedule.publish', req.auth.sub, {
    versionLabel,
    monthKey,
    monthLabel: publishPayload.monthLabel || monthKey,
    isPublic: makePublic,
    summary: makePublic
      ? `Schedule ${versionLabel} published for ${publishPayload.monthLabel || monthKey}`
      : `Schedule ${versionLabel} published privately for ${publishPayload.monthLabel || monthKey}`,
  })

  return res.json({
    versionLabel,
    publishedId: publishId,
    publishedAt: publishPayload.publishedAt,
    publishedBy: publisher?.display_name ?? null,
    monthKey,
    isPublic: makePublic,
    visibility: makePublic ? 'public' : 'private',
  })
})

router.post('/months/:monthKey/make-public', authMiddleware, async (req, res) => {
  if (req.auth.role !== 'coordinator') {
    return res.status(403).json({ error: 'Only coordinator can make a month public' })
  }

  const monthKey = req.params.monthKey
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return res.status(400).json({ error: 'Invalid monthKey' })
  }

  const published = await getLatestPublishedForMonth(monthKey, { publicOnly: false })
  if (!published) {
    return res.status(404).json({
      error: 'Publish this month first, then make it public for other users',
    })
  }

  await db.prepare(`UPDATE schedule_versions SET is_public = 1, archived_at = NULL WHERE id = ?`).run(published.id)

  await audit('schedule.make_public', req.auth.sub, {
    monthKey,
    versionLabel: published.version_label,
    publishedId: published.id,
    summary: `${monthLabelFromKey(monthKey)} schedule is now public`,
  })

  return res.json({
    ok: true,
    monthKey,
    versionLabel: published.version_label,
    isPublic: true,
  })
})

router.post('/archive', authMiddleware, async (req, res) => {
  if (req.auth.role !== 'coordinator') {
    return res.status(403).json({ error: 'Only coordinator can archive' })
  }

  const monthKey = resolveMonthKey(req) || req.body?.monthKey || getLiveMonthKey()
  const latest = await getLatestPublishedForMonth(monthKey, { publicOnly: false })

  if (!latest || latest.archived_at) {
    return res.status(404).json({ error: 'No published schedule to archive for this month' })
  }

  await db.prepare(`UPDATE schedule_versions SET archived_at = datetime('now') WHERE id = ?`).run(latest.id)

  await audit('schedule.archive', req.auth.sub, {
    versionLabel: latest.version_label,
    monthKey: latest.month_key,
    publishedId: latest.id,
    summary: `Schedule ${latest.version_label} archived`,
  })

  return res.json({
    ok: true,
    archivedId: latest.id,
    versionLabel: latest.version_label,
    monthKey: latest.month_key,
  })
})

router.get('/published/latest', authMiddleware, async (req, res) => {
  const monthKey = resolveMonthKey(req) || getLiveMonthKey()
  const canEdit = EDIT_ROLES.has(req.auth.role)
  const row = await getLatestPublishedForMonth(monthKey, { publicOnly: !canEdit })
  if (!row || (!canEdit && !rowIsPublic(row))) {
    return res.json({ published: null })
  }
  return res.json({
    published: {
      id: row.id,
      versionLabel: row.version_label,
      monthKey: row.month_key,
      publishedAt: row.published_at,
      isPublic: rowIsPublic(row),
      payload: parsePayload(row),
    },
  })
})

router.get('/history', authMiddleware, async (req, res) => {
  const canEdit = EDIT_ROLES.has(req.auth.role)
  const rows = await db
    .prepare(
      `SELECT sv.id, sv.version_label, sv.month_key, sv.published_at, sv.archived_at, sv.is_public,
        sv.published_by_user_id, u.display_name
       FROM schedule_versions sv
       LEFT JOIN users u ON u.id = sv.published_by_user_id
       WHERE sv.status = 'published' ORDER BY sv.published_at DESC LIMIT 30`,
    )
    .all()

  const history = rows
    .filter((r) => canEdit || rowIsPublic(r))
    .map((r) => ({
      id: r.id,
      version: r.version_label,
      date: r.published_at,
      by: r.display_name ?? '—',
      monthKey: r.month_key,
      isPublic: rowIsPublic(r),
      changes: r.archived_at
        ? `Archived ${r.month_key} schedule`
        : rowIsPublic(r)
          ? `Published ${r.month_key} schedule (public)`
          : `Published ${r.month_key} schedule (private)`,
      archived: Boolean(r.archived_at),
    }))

  return res.json({ history })
})

export default router
