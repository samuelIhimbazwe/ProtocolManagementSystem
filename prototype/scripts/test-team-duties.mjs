import {
  buildMonthlyServiceTeams,
  buildTeamSlotsFromServices,
  countMemberDuties,
  FULL_ROSTER_TEAM_SIZE,
} from '../../server/src/lib/teamEngine.js'

function buildMonthlyServices(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const services = []
  let id = 1
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthKey}-${String(day).padStart(2, '0')}`
    const dow = new Date(`${date}T12:00:00`).getUTCDay()
    if (dow === 0) {
      services.push({ id: `s${id++}`, name: 'Sunday Service 1', date, day: 'Sunday' })
      services.push({ id: `s${id++}`, name: 'Sunday Service 2', date, day: 'Sunday' })
    } else if (dow === 2) {
      services.push({ id: `s${id++}`, name: 'Tuesday Service', date, day: 'Tuesday' })
    } else if (dow === 5) {
      services.push({ id: `s${id++}`, name: 'Friday Service', date, day: 'Friday' })
    }
  }
  if (m === 9) {
    services.push({ id: `s${id++}`, name: 'Igaburo Service', date: `${monthKey}-05`, day: 'Saturday' })
  }
  return services.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
}

const pool = []
for (let i = 0; i < 49; i += 1) pool.push(`Protocol Member ${String(i + 1).padStart(2, '0')}`)

function auditMonth(monthKey, priorMeta = null) {
  const services = buildMonthlyServices(monthKey)
  const slots = buildTeamSlotsFromServices(services)
  const { teams, meta } = buildMonthlyServiceTeams(pool, services, { priorMeta })
  const duties = countMemberDuties(teams, pool)
  const counts = Object.values(duties)
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  const partial = teams.filter((t) => t.size < FULL_ROSTER_TEAM_SIZE).length
  const sundayIdx = slots.findIndex((s) => s.kind === 'sunday')
  const tueIdx = slots.findIndex((s) => s.kind === 'tuesday')
  const sundayFirst = tueIdx === -1 || sundayIdx < tueIdx

  console.log(`\n=== ${monthKey} ===`)
  console.log(`Pool: ${pool.length} · slots: ${slots.length} · teams: ${teams.length}`)
  console.log(`Duty range: ${min}–${max}`)
  console.log(`Partial rosters: ${partial} · Sundays first: ${sundayFirst}`)
  console.log(`Rotation index: ${meta.rotationIndex}`)

  const over4 = Object.entries(duties).filter(([, c]) => c > 4)
  const under2 = Object.entries(duties).filter(([, c]) => c < 2)
  if (over4.length) console.log('FAIL over 4:', over4.length)
  else console.log('OK — nobody over 4 duties')
  return meta
}

let prior = null
for (const mk of ['2026-08', '2026-09', '2026-10']) {
  prior = auditMonth(mk, prior)
}
