import {
  buildMonthlyChoirAssignments,
  parseChoirList,
  slotPrimaryChoirs,
  ss2ExpectedSlotCount,
  MONTHLY_ONCE_CHOIRS,
} from '../src/lib/choirEngine.js'
import { buildMonthlyServices } from '../src/lib/monthlyCalendar.js'

const CHOIRS = {
  primary: ['El Bethel Choir', "Ijwi ry'Umwami Yesu Choir", 'Elim Choir', 'Integuza Choir'],
  secondary: ['Beulah Choir', 'Yerusalemu Choir'],
  special: ['Hope Choir', 'Worship Team'],
}

const A = 'El Bethel Choir'
const B = "Ijwi ry'Umwami Yesu Choir"
const C = 'Elim Choir'
const D = 'Integuza Choir'

function pairKey(names) {
  return [...names].sort().join('|')
}

const rows = buildMonthlyChoirAssignments(buildMonthlyServices('2026-09'), CHOIRS)

function sundayPairs(list) {
  const byDate = new Map()
  for (const row of list.filter((r) => /Sunday Service [12]/.test(r.service))) {
    const key = String(row.serviceDate)
    if (!byDate.has(key)) byDate.set(key, {})
    byDate.get(key)[row.service] = row
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

let bad = 0

console.log('September Sunday primary rotation:')
for (const [date, pair] of sundayPairs(rows)) {
  const ss1 = slotPrimaryChoirs(pair['Sunday Service 1']?.choirs, CHOIRS)
  const ss2 = slotPrimaryChoirs(pair['Sunday Service 2']?.choirs, CHOIRS)
  console.log(`  ${date}  SS1: ${ss1.join(' + ')}  |  SS2: ${ss2.join(' + ')}`)
}

for (const [date, pair] of sundayPairs(rows)) {
  const ss1 = parseChoirList(pair['Sunday Service 1']?.choirs)
  const ss2 = parseChoirList(pair['Sunday Service 2']?.choirs)
  const expected = ss2ExpectedSlotCount(ss1, ss2)
  const overlap = ss1.filter((c) => ss2.includes(c))
  if (ss2.length !== expected || overlap.length) {
    bad += 1
    console.log('SUNDAY BAD', date, { ss1, ss2, expected, overlap })
  }
}

for (const serviceName of ['Sunday Service 1', 'Sunday Service 2']) {
  const slotRows = rows
    .filter((r) => r.service === serviceName)
    .sort((a, b) => String(a.serviceDate).localeCompare(String(b.serviceDate)))
  for (let i = 2; i < slotRows.length; i += 1) {
    for (const choir of CHOIRS.primary.filter((c) => c !== 'Hope Choir')) {
      const on = (row) => parseChoirList(row.choirs).includes(choir)
      if (on(slotRows[i - 2]) && on(slotRows[i - 1]) && on(slotRows[i])) {
        bad += 1
        console.log('3-IN-A-ROW', serviceName, choir)
      }
    }
  }
  for (let i = 1; i < slotRows.length; i += 1) {
    const prev = slotPrimaryChoirs(slotRows[i - 1].choirs, CHOIRS)
    const curr = slotPrimaryChoirs(slotRows[i].choirs, CHOIRS)
    if (serviceName === 'Sunday Service 1' && pairKey(prev) === pairKey(curr)) {
      bad += 1
      console.log('SAME PAIR SS1 twice', slotRows[i].serviceDate)
    }
    const prevSs1 = slotPrimaryChoirs(
      rows.find((r) => r.serviceDate === slotRows[i - 1].serviceDate && r.service === 'Sunday Service 1')?.choirs,
      CHOIRS,
    )
    const prevSs2 = slotPrimaryChoirs(
      rows.find((r) => r.serviceDate === slotRows[i - 1].serviceDate && r.service === 'Sunday Service 2')?.choirs,
      CHOIRS,
    )
    if (pairKey(prevSs1) === pairKey(curr) && serviceName === 'Sunday Service 2') {
      bad += 1
      console.log('PAIR SS1 then SS2 next week', slotRows[i].serviceDate, pairKey(prevSs1))
    }
    if (pairKey(prevSs2) === pairKey(curr) && serviceName === 'Sunday Service 1') {
      bad += 1
      console.log('PAIR SS2 then SS1 next week', slotRows[i].serviceDate)
    }
  }
}

const tuesdays = rows.filter((r) => r.service === 'Tuesday Service')
const fridays = rows.filter((r) => r.service === 'Friday Service')
console.log('\nTuesdays:', tuesdays.map((r) => `${r.serviceDate}: ${r.choirs}`).join('\n  '))
console.log('Fridays:', fridays.map((r) => `${r.serviceDate}: ${r.choirs}`).join('\n  '))

for (const fri of fridays) {
  const wk = fri.serviceDate.slice(0, 8)
  const tue = tuesdays.find((t) => t.serviceDate.startsWith(wk.slice(0, 8)) && t.serviceDate <= fri.serviceDate)
  const tueInWeek = tuesdays.filter((t) => {
    const fd = new Date(`${fri.serviceDate}T12:00:00Z`)
    const td = new Date(`${t.serviceDate}T12:00:00Z`)
    const fSun = new Date(fd)
    fSun.setUTCDate(fd.getUTCDate() - fd.getUTCDay())
    const tSun = new Date(td)
    tSun.setUTCDate(td.getUTCDate() - td.getUTCDay())
    return fSun.getTime() === tSun.getTime()
  })
  for (const t of tueInWeek) {
    const tp = slotPrimaryChoirs(t.choirs, CHOIRS)[0]
    const fp = slotPrimaryChoirs(fri.choirs, CHOIRS)[0]
    if (tp && fp && tp === fp) {
      bad += 1
      console.log('SAME TUE+FRI week', t.serviceDate, fri.serviceDate, tp)
    }
  }
}

console.log(bad === 0 ? '\nALL OK' : `\n${bad} issue(s)`)
