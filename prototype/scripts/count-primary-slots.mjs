import {
  buildMonthlyChoirAssignments,
  slotPrimaryChoirs,
} from '../src/lib/choirEngine.js'
import { buildMonthlyServices } from '../src/lib/monthlyCalendar.js'

const CHOIRS = {
  primary: ['El Bethel Choir', "Ijwi ry'Umwami Yesu Choir", 'Elim Choir', 'Integuza Choir'],
  secondary: ['Yerusalemu Choir', 'Beulah Choir'],
  special: ['Hope Choir', 'Worship Team'],
}

function countMonth(monthKey) {
  const rows = buildMonthlyChoirAssignments(buildMonthlyServices(monthKey), CHOIRS)
  const primaries = CHOIRS.primary
  const ss1Counts = Object.fromEntries(primaries.map((p) => [p, 0]))
  const ss2Counts = Object.fromEntries(primaries.map((p) => [p, 0]))
  const sundays = rows.filter((r) => /Sunday Service [12]/.test(r.service))
  const nSun = new Set(sundays.map((r) => r.serviceDate)).size
  for (const r of sundays) {
    const slot = r.service === 'Sunday Service 1' ? ss1Counts : ss2Counts
    for (const p of slotPrimaryChoirs(r.choirs, CHOIRS)) slot[p]++
  }
  return { monthKey, sundays: nSun, ss1Counts, ss2Counts }
}

for (const m of ['2026-08', '2026-09', '2026-11', '2026-05']) {
  console.log(JSON.stringify(countMonth(m), null, 2))
}
