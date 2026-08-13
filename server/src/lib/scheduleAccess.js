import { db } from '../db.js'
import { getLiveMonthKey } from './scheduleMonths.js'

function parsePayload(row) {
  return row ? JSON.parse(row.payload_json) : null
}

function isPublicExpr() {
  // Works for SQLite/Postgres after column exists; COALESCE treats NULL as private then we backfill.
  return `COALESCE(is_public, 0) = 1`
}

export async function getDraftRow(monthKey) {
  const key = monthKey || getLiveMonthKey()
  return await db
    .prepare(`SELECT * FROM schedule_versions WHERE status = 'draft' AND month_key = ? LIMIT 1`)
    .get(key)
}

export async function getDraftPayload(monthKey) {
  const draft = await getDraftRow(monthKey)
  return parsePayload(draft)
}

/** Latest public (or any) published payload — prefers live month for operational APIs. */
export async function getPublishedPayload(preferredMonth) {
  const live = preferredMonth || getLiveMonthKey()

  let row = await db
    .prepare(
      `SELECT payload_json FROM schedule_versions
       WHERE status = 'published' AND month_key = ? AND ${isPublicExpr()}
         AND (archived_at IS NULL OR archived_at = '')
       ORDER BY published_at DESC LIMIT 1`,
    )
    .get(live)
  if (row) return parsePayload(row)

  row = await db
    .prepare(
      `SELECT payload_json FROM schedule_versions
       WHERE status = 'published' AND ${isPublicExpr()}
         AND (archived_at IS NULL OR archived_at = '')
       ORDER BY CASE WHEN month_key = ? THEN 0 ELSE 1 END, published_at DESC LIMIT 1`,
    )
    .get(live)
  if (row) return parsePayload(row)

  // Migration fallback before is_public backfill
  row = await db
    .prepare(
      `SELECT payload_json FROM schedule_versions
       WHERE status = 'published' AND month_key = ?
         AND (archived_at IS NULL OR archived_at = '')
       ORDER BY published_at DESC LIMIT 1`,
    )
    .get(live)
  if (row) return parsePayload(row)

  row = await db
    .prepare(
      `SELECT payload_json FROM schedule_versions WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`,
    )
    .get()
  return parsePayload(row)
}

export async function getLatestPublishedForMonth(monthKey, { publicOnly = false } = {}) {
  const publicClause = publicOnly ? `AND ${isPublicExpr()}` : ''
  let row = await db
    .prepare(
      `SELECT * FROM schedule_versions
       WHERE status = 'published' AND month_key = ? ${publicClause}
         AND (archived_at IS NULL OR archived_at = '')
       ORDER BY published_at DESC LIMIT 1`,
    )
    .get(monthKey)
  if (row) return row
  if (publicOnly) return null
  return await db
    .prepare(
      `SELECT * FROM schedule_versions
       WHERE status = 'published' AND month_key = ?
       ORDER BY published_at DESC LIMIT 1`,
    )
    .get(monthKey)
}
