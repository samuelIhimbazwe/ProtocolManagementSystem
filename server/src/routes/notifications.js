import { Router } from 'express'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

/**
 * Ministry-facing notifications only (not the full audit log).
 * Announcements, schedule updates, team/choir/leadership assignments, etc.
 */
const NOTIFICATION_ACTIONS = new Set([
  'ministry.announcement',
  'schedule.publish',
  'schedule.team_assignments',
  'schedule.choir_assignments',
  'schedule.leadership_updated',
  'schedule.leadership_approved',
  'attendance.submit',
  'finance.submission.verify',
])

const ACTION_COPY = {
  'ministry.announcement': {
    title: 'Announcement',
    body: (meta) => meta.summary || meta.message || meta.title || 'New ministry announcement',
  },
  'schedule.publish': {
    title: 'Schedule published',
    body: (meta) =>
      meta.summary ||
      (meta.versionLabel
        ? `Schedule ${meta.versionLabel} published${meta.monthLabel ? ` for ${meta.monthLabel}` : ''}`
        : 'A new ministry schedule was published'),
  },
  'schedule.team_assignments': {
    title: 'Team assignments updated',
    body: (meta) =>
      meta.summary ||
      (meta.monthLabel
        ? `Service teams updated for ${meta.monthLabel}`
        : 'Protocol service teams were updated'),
  },
  'schedule.choir_assignments': {
    title: 'Choir schedule updated',
    body: (meta) =>
      meta.summary ||
      (meta.monthLabel ? `Choir assignments updated for ${meta.monthLabel}` : 'Choir schedule was updated'),
  },
  'schedule.leadership_updated': {
    title: 'Leadership assignments updated',
    body: (meta) =>
      meta.summary ||
      (meta.monthLabel
        ? `TL/VTL assignments updated for ${meta.monthLabel}`
        : 'Team leadership assignments were updated'),
  },
  'schedule.leadership_approved': {
    title: 'Leadership assignments approved',
    body: (meta) =>
      meta.summary ||
      (meta.monthLabel
        ? `Leadership approved for ${meta.monthLabel}`
        : 'Team leadership assignments were approved'),
  },
  'attendance.submit': {
    title: 'Attendance recorded',
    body: (meta) =>
      meta.summary ||
      (meta.serviceName
        ? `Attendance submitted for ${meta.serviceName}${meta.serviceDate ? ` (${meta.serviceDate})` : ''}`
        : 'Attendance was submitted for a service'),
  },
  'finance.submission.verify': {
    title: (meta) => {
      if (meta.action === 'confirm') return 'Contribution confirmed'
      if (meta.action === 'partial') return 'Partial contribution recorded'
      if (meta.action === 'decline') return 'Contribution declined'
      return 'Contribution update'
    },
    body: (meta) =>
      meta.summary ||
      (meta.memberName && meta.contributionName
        ? `${meta.memberName} · ${meta.contributionName}`
        : 'A contribution verification was completed'),
  },
}

function parseMeta(raw) {
  try {
    return JSON.parse(raw ?? '{}')
  } catch {
    return {}
  }
}

async function readIdsForUser(userId) {
  const readKey = `notifications_read_${userId}`
  const readRow = await db.prepare(`SELECT value_json FROM app_settings WHERE key = ?`).get(readKey)
  try {
    return JSON.parse(readRow?.value_json ?? '[]').map(String)
  } catch {
    return []
  }
}

function formatItem(row, readSet) {
  const meta = parseMeta(row.meta_json)
  const copy = ACTION_COPY[row.action]
  if (!copy) return null

  const title = typeof copy.title === 'function' ? copy.title(meta) : copy.title
  const body = typeof copy.body === 'function' ? copy.body(meta) : copy.body
  const id = String(row.id)

  return {
    id,
    action: row.action,
    category: row.action.startsWith('schedule.')
      ? 'schedule'
      : row.action === 'ministry.announcement'
        ? 'announcement'
        : row.action.startsWith('finance.')
          ? 'finance'
          : 'ministry',
    title,
    body,
    createdAt: row.created_at,
    unread: !readSet.has(id),
  }
}

router.get('/', authMiddleware, async (req, res) => {
  const placeholders = [...NOTIFICATION_ACTIONS].map(() => '?').join(', ')
  const rows = await db
    .prepare(
      `SELECT id, action, meta_json, created_at FROM audit_log
       WHERE action IN (${placeholders})
       ORDER BY created_at DESC
       LIMIT 40`,
    )
    .all(...NOTIFICATION_ACTIONS)

  const readSet = new Set(await readIdsForUser(req.auth.sub))
  let items = rows.map((r) => formatItem(r, readSet)).filter(Boolean)

  // If the log has no ministry-facing events yet, surface the latest published schedule.
  if (items.length === 0) {
    const pub = await db
      .prepare(
        `SELECT id, version_label, month_key, published_at, payload_json
         FROM schedule_versions
         WHERE status = 'published'
         ORDER BY published_at DESC
         LIMIT 1`,
      )
      .get()
    if (pub) {
      let monthLabel = pub.month_key
      try {
        monthLabel = JSON.parse(pub.payload_json ?? '{}').monthLabel || pub.month_key
      } catch {
        /* ignore */
      }
      const id = `schedule-published-${pub.id}`
      items = [
        {
          id,
          action: 'schedule.publish',
          category: 'schedule',
          title: 'Schedule published',
          body: `Schedule ${pub.version_label} published for ${monthLabel}`,
          createdAt: pub.published_at,
          unread: !readSet.has(id),
        },
      ]
    }
  }

  return res.json({ notifications: items })
})

router.post('/mark-read', authMiddleware, async (req, res) => {
  const { ids } = req.body ?? {}
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' })

  const readKey = `notifications_read_${req.auth.sub}`
  const prev = await readIdsForUser(req.auth.sub)
  const merged = [...new Set([...prev, ...ids.map(String)])]
  await db.prepare(
    `INSERT INTO app_settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
  ).run(readKey, JSON.stringify(merged))

  return res.json({ ok: true })
})

export default router
