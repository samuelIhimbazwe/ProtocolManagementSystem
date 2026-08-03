import { db } from '../db.js'

function parsePayload(row) {
  return row ? JSON.parse(row.payload_json) : null
}

export async function getDraftPayload() {
  const draft = await db.prepare(`SELECT payload_json FROM schedule_versions WHERE status = 'draft' LIMIT 1`).get()
  return parsePayload(draft)
}

export async function getPublishedPayload() {
  const row = await db
    .prepare(
      `SELECT payload_json FROM schedule_versions WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`,
    )
    .get()
  return parsePayload(row)
}
