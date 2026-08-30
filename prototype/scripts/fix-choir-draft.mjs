import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMonthlyChoirAssignments } from '../src/lib/choirEngine.js'
import { buildMonthlyServices } from '../src/lib/monthlyCalendar.js'

const CHOIRS = {
  primary: ['El Bethel Choir', "Ijwi ry'Umwami Yesu Choir", 'Elim Choir', 'Integuza Choir'],
  secondary: ['Yerusalemu Choir', 'Beulah Choir'],
  special: ['Hope Choir', 'Worship Team'],
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const db = new DatabaseSync(path.join(root, 'server', 'data', 'pmss.sqlite'))
const monthKey = process.argv[2] ?? '2026-09'

const row = db
  .prepare(
    "SELECT id, payload_json FROM schedule_versions WHERE status = 'draft' AND month_key = ? LIMIT 1",
  )
  .get(monthKey)

if (!row) {
  console.log('No draft for', monthKey)
  process.exit(1)
}

const payload = JSON.parse(row.payload_json)
const services = buildMonthlyServices(monthKey)
const choirAssignments = buildMonthlyChoirAssignments(services, CHOIRS)
const next = {
  ...payload,
  monthKey,
  services: services.length ? services : payload.services,
  choirAssignments,
  choirStatus: 'draft',
  choirPublishedAt: null,
  choirPublishedBy: null,
}

db.prepare('UPDATE schedule_versions SET payload_json = ? WHERE id = ?').run(
  JSON.stringify(next),
  row.id,
)

console.log(`Updated draft ${monthKey} with ${choirAssignments.length} choir rows`)
for (const r of choirAssignments.filter((x) => x.service === 'Sunday Service 1')) {
  console.log(`  SS1 ${r.serviceDate}: ${r.choirs}`)
}
