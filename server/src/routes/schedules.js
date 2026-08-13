import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { loadRulesFromDb } from '../lib/settingsStore.js'
import { validateSchedulePayload, publishBlocked } from '../lib/validation.js'
import {
  getDraftRow,
  getLatestPublishedForMonth,
} from '../lib/scheduleAccess.js'
import {
  emptyMonthPayload,
  getLiveMonthKey,
  monthLabelFromKey,
  nextMonthKey,
} from '../lib/scheduleMonths.js'

const router = Router()

const EDIT_ROLES = new Set(['coordinator', 'secretary'])

function parsePayload(row) {
  return JSON.parse(row.payload_json)
}

function rowIsPublic(row) {
  return Boolean(row?.is_public)
}

async function attachValidation(payload) {
  const rules = await loadRulesFromDb()
  const { rows, summary } = validateSchedulePayload(payload, rules)
  return { ...payload, validationRows: rows, validationSummary: summary }
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
  const canEdit = EDIT_ROLES.has(req.auth.role)
  const catalog = await buildMonthsCatalog(canEdit)
  return res.json({ ...catalog, canEdit })
})

router.get('/current', authMiddleware, async (req, res) => {
  const canEdit = EDIT_ROLES.has(req.auth.role)
  const live = getLiveMonthKey()
  const requested = resolveMonthKey(req) || live
  const catalog = await buildMonthsCatalog(canEdit)

  if (canEdit) {
    let draft = await getDraftRow(requested)
    if (!draft && requested === live) {
      // Prefer any legacy draft if live month draft missing
      draft = await db.prepare(`SELECT * FROM schedule_versions WHERE status = 'draft' LIMIT 1`).get()
    }
    if (!draft) {
      const empty = emptyMonthPayload(requested)
      return res.json({
        source: 'empty',
        editable: true,
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
    return res.json({
      source: 'draft',
      editable: true,
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
  if (!EDIT_ROLES.has(req.auth.role)) {
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
  if (!EDIT_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { payload } = req.body ?? {}
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload object required' })
  }

  const monthKey = payload.monthKey || resolveMonthKey(req) || getLiveMonthKey()
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return res.status(400).json({ error: 'Valid monthKey (YYYY-MM) required' })
  }

  const validated = await attachValidation({
    ...payload,
    monthKey,
    monthLabel: payload.monthLabel || monthLabelFromKey(monthKey),
  })

  let draft = await getDraftRow(monthKey)
  const previous = draft ? parsePayload(draft) : emptyMonthPayload(monthKey)

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

  if (!same(previous.teamAssignments, validated.teamAssignments)) {
    await audit('schedule.team_assignments', req.auth.sub, {
      monthKey,
      monthLabel,
      teams: validated.teamAssignments?.length ?? 0,
      summary: `Service teams updated for ${monthLabel}`,
    })
  }
  if (!same(previous.choirAssignments, validated.choirAssignments)) {
    await audit('schedule.choir_assignments', req.auth.sub, {
      monthKey,
      monthLabel,
      choirs: validated.choirAssignments?.length ?? 0,
      summary: `Choir schedule updated for ${monthLabel}`,
    })
  }
  if (!same(previous.leadershipReview, validated.leadershipReview)) {
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
  const rules = await loadRulesFromDb()
  const result = validateSchedulePayload(payload, rules)
  return res.json(result)
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
  const payload = parsePayload(draft)
  const validation = validateSchedulePayload(payload, rules)
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
  payload.publishedAt = new Date().toISOString()
  payload.versionLabel = versionLabel
  payload.validationSummary = validation.summary
  payload.validationRows = validation.rows
  payload.monthKey = monthKey
  payload.monthLabel = payload.monthLabel || monthLabelFromKey(monthKey)

  const publisher = await db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(req.auth.sub)

  await db
    .prepare(
      `INSERT INTO schedule_versions (id, version_label, status, month_key, payload_json, published_at, published_by_user_id, is_public)
       VALUES (?, ?, 'published', ?, ?, datetime('now'), ?, ?)`,
    )
    .run(publishId, versionLabel, monthKey, JSON.stringify(payload), req.auth.sub, makePublic ? 1 : 0)

  await audit('schedule.publish', req.auth.sub, {
    versionLabel,
    monthKey,
    monthLabel: payload.monthLabel || monthKey,
    isPublic: makePublic,
    summary: makePublic
      ? `Schedule ${versionLabel} published for ${payload.monthLabel || monthKey}`
      : `Schedule ${versionLabel} published privately for ${payload.monthLabel || monthKey}`,
  })

  return res.json({
    versionLabel,
    publishedId: publishId,
    publishedAt: payload.publishedAt,
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
