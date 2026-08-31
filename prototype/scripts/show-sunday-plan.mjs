import {
  buildMonthlyChoirAssignments,
  slotPrimaryChoirs,
  parseChoirList,
} from '../src/lib/choirEngine.js'
import { buildMonthlyServices } from '../src/lib/monthlyCalendar.js'

const CHOIRS = {
  primary: ['El Bethel Choir', "Ijwi ry'Umwami Yesu Choir", 'Elim Choir', 'Integuza Choir'],
  secondary: ['Beulah Choir', 'Yerusalemu Choir'],
  special: ['Hope Choir', 'Worship Team'],
}

const monthKey = process.argv[2] ?? '2026-08'
const rows = buildMonthlyChoirAssignments(buildMonthlyServices(monthKey), CHOIRS)

const byDate = new Map()
for (const r of rows.filter((x) => /Sunday Service [12]/.test(x.service))) {
  const d = r.serviceDate
  if (!byDate.has(d)) byDate.set(d, {})
  byDate.get(d)[r.service] = r
}

console.log(`\n${monthKey} — ${byDate.size} Sundays (engine)\n`)
for (const [date, pair] of [...byDate.entries()].sort()) {
  const ss1 = parseChoirList(pair['Sunday Service 1']?.choirs)
  const ss2 = parseChoirList(pair['Sunday Service 2']?.choirs)
  const p1 = slotPrimaryChoirs(ss1, CHOIRS)
  const p2 = slotPrimaryChoirs(ss2, CHOIRS)
  console.log(`${date}`)
  console.log(`  SS1: ${ss1.join(' · ')}  → primaries: ${p1.join(', ')}`)
  console.log(`  SS2: ${ss2.join(' · ')}  → primaries: ${p2.join(', ')}`)
}

const primaries = CHOIRS.primary
const ss1Counts = Object.fromEntries(primaries.map((p) => [p, 0]))
const ss2Counts = Object.fromEntries(primaries.map((p) => [p, 0]))
for (const r of rows.filter((x) => /Sunday Service [12]/.test(x.service))) {
  const slot = r.service === 'Sunday Service 1' ? ss1Counts : ss2Counts
  for (const p of slotPrimaryChoirs(r.choirs, CHOIRS)) slot[p]++
}
console.log('\nMonthly primary totals:')
for (const p of primaries) {
  console.log(`  ${p.replace(' Choir', '')}: SS1=${ss1Counts[p]}, SS2=${ss2Counts[p]}, total=${ss1Counts[p] + ss2Counts[p]}`)
}
