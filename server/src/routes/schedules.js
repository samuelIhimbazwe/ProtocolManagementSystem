import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { loadRulesFromDb } from '../lib/settingsStore.js'
import { validateSchedulePayload, publishBlocked } from '../lib/validation.js'

const router = Router()

const EDIT_ROLES = new Set(['coordinator', 'secretary'])

function getDraft() {
  return db.prepare(`SELECT * FROM schedule_versions WHERE status = 'draft' LIMIT 1`).get()
}

function getLatestPublished() {
  return db
    .prepare(
      `SELECT * FROM schedule_versions WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`,
    )
    .get()
}

function parsePayload(row) {
  return JSON.parse(row.payload_json)
}

function attachValidation(payload) {
  const rules = loadRulesFromDb()
  const { rows, summary } = validateSchedulePayload(payload, rules)
  return { ...payload, validationRows: rows, validationSummary: summary }
}

router.get('/current', authMiddleware, (req, res) => {
  const canEdit = EDIT_ROLES.has(req.auth.role)
  if (canEdit) {
    const draft = getDraft()
    if (!draft) return res.status(404).json({ error: 'No draft schedule' })
    const payload = attachValidation(parsePayload(draft))
    return res.json({
      source: 'draft',
      editable: true,
      id: draft.id,
      monthKey: draft.month_key,
      versionLabel: draft.version_label,
      payload,
    })
  }

  const published = getLatestPublished()
  if (published) {
    return res.json({
      source: 'published',
      editable: false,
      id: published.id,
      monthKey: published.month_key,
      versionLabel: published.version_label,
      publishedAt: published.published_at,
      payload: parsePayload(published),
    })
  }

  const draft = getDraft()
  if (!draft) return res.status(404).json({ error: 'No schedule' })
  return res.json({
    source: 'draft',
    editable: false,
    id: draft.id,
    monthKey: draft.month_key,
    versionLabel: draft.version_label,
    payload: parsePayload(draft),
  })
})

router.get('/draft', authMiddleware, (req, res) => {
  const draft = getDraft()
  if (!draft) {
    return res.status(404).json({ error: 'No draft schedule' })
  }
  const payload = attachValidation(parsePayload(draft))
  return res.json({
    id: draft.id,
    versionLabel: draft.version_label,
    monthKey: draft.month_key,
    payload,
  })
})

router.put('/draft', authMiddleware, (req, res) => {
  if (!EDIT_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const draft = getDraft()
  if (!draft) {
    return res.status(404).json({ error: 'No draft schedule' })
  }

  const { payload } = req.body ?? {}
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload object required' })
  }

  const validated = attachValidation(payload)
  db.prepare(`UPDATE schedule_versions SET payload_json = ? WHERE id = ?`).run(JSON.stringify(validated), draft.id)
  audit('schedule.draft_update', req.auth.sub, { draftId: draft.id })

  return res.json({ ok: true, payload: validated })
})

router.get('/validate', authMiddleware, (req, res) => {
  const draft = getDraft()
  if (!draft) return res.status(404).json({ error: 'No draft schedule' })
  const payload = parsePayload(draft)
  const rules = loadRulesFromDb()
  const result = validateSchedulePayload(payload, rules)
  return res.json(result)
})

router.post('/publish', authMiddleware, (req, res) => {
  if (req.auth.role !== 'coordinator') {
    return res.status(403).json({ error: 'Only coordinator can publish' })
  }

  const draft = getDraft()
  if (!draft) {
    return res.status(404).json({ error: 'No draft schedule' })
  }

  const rules = loadRulesFromDb()
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
    db.prepare(`SELECT COUNT(*) AS c FROM schedule_versions WHERE status = 'published'`).get().c + 1
  const versionLabel = `V${publishedCount}`

  const publishId = uuid()
  payload.publishedAt = new Date().toISOString()
  payload.versionLabel = versionLabel
  payload.validationSummary = validation.summary
  payload.validationRows = validation.rows

  const publisher = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(req.auth.sub)

  db.prepare(
    `INSERT INTO schedule_versions (id, version_label, status, month_key, payload_json, published_at, published_by_user_id)
     VALUES (?, ?, 'published', ?, ?, datetime('now'), ?)`,
  ).run(publishId, versionLabel, draft.month_key, JSON.stringify(payload), req.auth.sub)

  audit('schedule.publish', req.auth.sub, { versionLabel, monthKey: draft.month_key })

  return res.json({
    versionLabel,
    publishedId: publishId,
    publishedAt: payload.publishedAt,
    publishedBy: publisher?.display_name ?? null,
  })
})

router.get('/published/latest', authMiddleware, (req, res) => {
  const row = getLatestPublished()
  if (!row) {
    return res.json({ published: null })
  }
  return res.json({
    published: {
      id: row.id,
      versionLabel: row.version_label,
      monthKey: row.month_key,
      publishedAt: row.published_at,
      payload: parsePayload(row),
    },
  })
})

router.get('/history', authMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT sv.id, sv.version_label, sv.month_key, sv.published_at, sv.published_by_user_id, u.display_name
       FROM schedule_versions sv
       LEFT JOIN users u ON u.id = sv.published_by_user_id
       WHERE sv.status = 'published' ORDER BY sv.published_at DESC LIMIT 20`,
    )
    .all()
  return res.json({
    history: rows.map((r) => ({
      id: r.id,
      version: r.version_label,
      date: r.published_at,
      by: r.display_name ?? '—',
      changes: `Published ${r.month_key} schedule`,
    })),
  })
})

export default router
