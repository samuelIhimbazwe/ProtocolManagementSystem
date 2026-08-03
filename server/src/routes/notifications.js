import { Router } from 'express'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

const ACTION_LABELS = {
  'schedule.publish': 'Schedule published',
  'schedule.draft_update': 'Schedule draft updated',
  'attendance.submit': 'Attendance submitted',
  'members.create': 'Member added',
  'members.update': 'Member updated',
  'users.invite': 'User invited',
  'users.status': 'Account status changed',
  'auth.login': 'Sign-in',
}

router.get('/', authMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, action, meta_json, created_at FROM audit_log
       WHERE action NOT IN ('auth.login', 'auth.forgot_password')
       ORDER BY created_at DESC LIMIT 25`,
    )
    .all()

  const readKey = `notifications_read_${req.auth.sub}`
  const readRow = db.prepare(`SELECT value_json FROM app_settings WHERE key = ?`).get(readKey)
  let readIds = []
  try {
    readIds = JSON.parse(readRow?.value_json ?? '[]')
  } catch {
    readIds = []
  }
  const readSet = new Set(readIds.map(String))

  const items = rows.map((r) => {
    let meta = {}
    try {
      meta = JSON.parse(r.meta_json ?? '{}')
    } catch {
      /* ignore */
    }
    const title = ACTION_LABELS[r.action] ?? r.action
    const body =
      meta.versionLabel != null
        ? `Version ${meta.versionLabel}`
        : meta.memberId != null
          ? `Member ${meta.memberId}`
          : meta.serviceId != null
            ? `Service ${meta.serviceId}`
            : 'See activity log'
    const id = String(r.id)
    return {
      id,
      title,
      body,
      createdAt: r.created_at,
      unread: !readSet.has(id),
    }
  })

  return res.json({ notifications: items })
})

router.post('/mark-read', authMiddleware, (req, res) => {
  const { ids } = req.body ?? {}
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' })

  const readKey = `notifications_read_${req.auth.sub}`
  const readRow = db.prepare(`SELECT value_json FROM app_settings WHERE key = ?`).get(readKey)
  let readIds = []
  try {
    readIds = JSON.parse(readRow?.value_json ?? '[]')
  } catch {
    readIds = []
  }
  const merged = [...new Set([...readIds, ...ids.map(Number)])]
  db.prepare(
    `INSERT INTO app_settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
  ).run(readKey, JSON.stringify(merged))

  return res.json({ ok: true })
})

export default router
