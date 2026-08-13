import { v4 as uuid } from 'uuid'
import { db } from '../db.js'
import { emptyMonthPayload, getLiveMonthKey, monthLabelFromKey } from './scheduleMonths.js'

function parsePayload(row) {
  return row ? JSON.parse(row.payload_json) : null
}

function payloadMonthKey(payload) {
  return payload?.monthKey || String(payload?.services?.[0]?.date ?? '').slice(0, 7) || null
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

/** If a draft's JSON month does not match its row, restore that month from published (or empty). */
export async function repairMismatchedDrafts() {
  const drafts = await db.prepare(`SELECT * FROM schedule_versions WHERE status = 'draft'`).all()
  for (const draft of drafts) {
    let payload = parsePayload(draft)
    const jsonMonth = payloadMonthKey(payload)
    if (!jsonMonth || jsonMonth === draft.month_key) continue

    const published = await getLatestPublishedForMonth(draft.month_key, { publicOnly: false })
    const restored = published
      ? {
          ...parsePayload(published),
          monthKey: draft.month_key,
          monthLabel: monthLabelFromKey(draft.month_key),
        }
      : emptyMonthPayload(draft.month_key)

    await db
      .prepare(`UPDATE schedule_versions SET payload_json = ? WHERE id = ?`)
      .run(JSON.stringify(restored), draft.id)
  }
}

export async function ensureDraftForMonth(monthKey) {
  if (!monthKey) return null
  await repairMismatchedDrafts()
  let draft = await getDraftRow(monthKey)
  if (draft) {
    const payload = parsePayload(draft)
    if (payloadMonthKey(payload) === monthKey) return draft
  }

  const published = await getLatestPublishedForMonth(monthKey, { publicOnly: false })
  const payload = published
    ? {
        ...parsePayload(published),
        monthKey,
        monthLabel: monthLabelFromKey(monthKey),
      }
    : emptyMonthPayload(monthKey)

  if (draft) {
    await db
      .prepare(`UPDATE schedule_versions SET payload_json = ? WHERE id = ?`)
      .run(JSON.stringify(payload), draft.id)
    return await getDraftRow(monthKey)
  }

  await db
    .prepare(
      `INSERT INTO schedule_versions (id, version_label, status, month_key, payload_json, is_public)
       VALUES (?, 'Draft', 'draft', ?, ?, 0)`,
    )
    .run(uuid(), monthKey, JSON.stringify(payload))
  return await getDraftRow(monthKey)
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
