import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const db = new DatabaseSync(path.join(root, 'server', 'data', 'pmss.sqlite'))
const monthKey = process.argv[2] ?? '2026-09'
const row = db
  .prepare(
    "SELECT month_key, payload_json FROM schedule_versions WHERE status = 'draft' AND month_key = ? LIMIT 1",
  )
  .get(monthKey)
if (!row) {
  console.log('No draft for', monthKey)
  process.exit(0)
}
const payload = JSON.parse(row.payload_json)
const sundays = (payload.choirAssignments ?? []).filter((r) => /Sunday Service 1/.test(r.service))
console.log(`Draft ${monthKey}: ${payload.choirAssignments?.length ?? 0} choir rows`)
for (const r of sundays.sort((a, b) => String(a.serviceDate ?? a.date).localeCompare(String(b.serviceDate ?? b.date)))) {
  console.log(`  ${r.serviceDate ?? r.date}: ${r.choirs}`)
}
