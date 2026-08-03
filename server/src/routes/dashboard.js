import { Router } from 'express'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { getDraftPayload, getPublishedPayload } from '../lib/scheduleAccess.js'

const router = Router()

function latestPublishedRow() {
  return db
    .prepare(
      `SELECT version_label, month_key, published_at FROM schedule_versions
       WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`,
    )
    .get()
}

function attendanceTotals() {
  const rows = db
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

router.get('/summary', authMiddleware, (req, res) => {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active
       FROM members`,
    )
    .get()

  const today = process.env.PMSS_TODAY ?? '2026-08-02'
  const payload = getPublishedPayload() ?? getDraftPayload()
  const services = payload?.services ?? []
  const upcomingServices = services.filter((s) => s.date >= today).length
  const published = latestPublishedRow()
  const attendance = attendanceTotals()

  let finance = null
  try {
    const collected = db
      .prepare(
        `SELECT COALESCE(SUM(
           CASE
             WHEN status = 'confirmed' THEN COALESCE(confirmed_amount, claimed_amount)
             WHEN status = 'partial' THEN COALESCE(confirmed_amount, 0)
             ELSE 0
           END
         ), 0) AS total FROM contribution_submissions`,
      )
      .get().total
    const pending = db
      .prepare(`SELECT COUNT(*) AS c FROM contribution_submissions WHERE status = 'pending'`)
      .get().c
    const outstanding = db
      .prepare(
        `SELECT COALESCE(SUM(outstanding_amount), 0) AS total
         FROM contribution_followups WHERE status IN ('open', 'in_progress')`,
      )
      .get().total
    finance = { collected, pending, outstanding }
  } catch {
    finance = null
  }

  const monthLabel = payload?.monthLabel ?? published?.month_key ?? '—'

  return res.json({
    stats: {
      totalMembers: counts.total ?? 0,
      activeMembers: counts.active ?? 0,
      upcomingServices,
      attendanceRate: attendance.rate,
      publishedSchedule: monthLabel,
      scheduleStatus: published ? 'Published' : 'Draft',
      versionLabel: published?.version_label ?? null,
      financeCollected: finance?.collected ?? null,
      financePending: finance?.pending ?? null,
      financeOutstanding: finance?.outstanding ?? null,
    },
    upcomingServices: services.filter((s) => s.date >= today).slice(0, 8),
    attendance,
    finance,
  })
})

router.get('/activity', authMiddleware, (req, res) => {
  const requested = Number(req.query.limit)
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 12
  const rows = db
    .prepare(
      `SELECT action, meta_json, created_at FROM audit_log ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit)

  const activity = rows.map((r) => {
    let meta = {}
    try {
      meta = JSON.parse(r.meta_json ?? '{}')
    } catch {
      /* ignore */
    }
    const label = r.action.replace(/\./g, ' · ')
    return {
      text: meta.summary ?? label,
      time: r.created_at,
      action: r.action,
    }
  })

  return res.json({ activity })
})

export default router
