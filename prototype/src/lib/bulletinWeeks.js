const MONTH_PARSE = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

export function parseBulletinDateParts(input, defaultYear = 2026) {
  if (!input) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
    const d = new Date(`${input.slice(0, 10)}T12:00:00`)
    return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() }
  }
  const m = String(input).trim().match(/^(\d{1,2})\s+([A-Za-z]{3})/)
  if (!m) return null
  const mon = MONTH_PARSE[m[2]]
  if (mon == null) return null
  return { day: Number(m[1]), month: mon, year: defaultYear }
}

export function formatBulletinDateSlash(parts) {
  if (!parts) return ''
  const dd = String(parts.day).padStart(2, '0')
  const mm = String(parts.month + 1).padStart(2, '0')
  return `${dd}/${mm}/${parts.year}`
}

function partsToUtcDate(parts) {
  return new Date(Date.UTC(parts.year, parts.month, parts.day, 12, 0, 0))
}

function utcPartsFromDate(d) {
  return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() }
}

/** Monday-start calendar week (matches printed ADEPR bulletins). */
export function mondayWeekKey(parts) {
  if (!parts) return 'unknown'
  const d = partsToUtcDate(parts)
  const daysFromMonday = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - daysFromMonday)
  return d.toISOString().slice(0, 10)
}

export function weekRangeLabelFromItems(items) {
  let minT = null
  let maxT = null
  items.forEach(({ parts }) => {
    if (!parts) return
    const t = partsToUtcDate(parts).getTime()
    if (minT == null || t < minT) minT = t
    if (maxT == null || t > maxT) maxT = t
  })
  if (minT == null) return ''
  return `${formatBulletinDateSlash(utcPartsFromDate(new Date(minT)))} - ${formatBulletinDateSlash(utcPartsFromDate(new Date(maxT)))}`
}

/** @deprecated use mondayWeekKey — kept for tests */
export function weekOfMonth(parts) {
  if (!parts) return 1
  return Math.min(5, Math.ceil(parts.day / 7))
}

export function teamBulletinDate(team) {
  if (team.serviceDate) return parseBulletinDateParts(team.serviceDate)
  const chunk = String(team.date ?? '').split('—')[0]?.trim()
  return parseBulletinDateParts(chunk)
}

export function groupTeamsByWeek(teams) {
  const map = new Map()
  teams.forEach((team) => {
    const parts = teamBulletinDate(team)
    const key = mondayWeekKey(parts)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push({ team, parts })
  })
  map.forEach((list) => {
    list.sort((a, b) => {
      const ta = a.parts ? Date.UTC(a.parts.year, a.parts.month, a.parts.day) : 0
      const tb = b.parts ? Date.UTC(b.parts.year, b.parts.month, b.parts.day) : 0
      if (ta !== tb) return ta - tb
      return serviceSortKey(a.team) - serviceSortKey(b.team)
    })
  })
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function serviceSortKey(team) {
  const name = team.serviceName ?? team.date ?? ''
  if (/Tuesday/i.test(name)) return 1
  if (/Friday/i.test(name)) return 2
  if (/Sunday Service 1/i.test(name)) return 3
  if (/Sunday Service 2/i.test(name)) return 4
  if (/Igaburo/i.test(name)) return 5
  return 9
}

export function groupChoirByWeek(assignments, defaultYear = 2026) {
  const map = new Map()
  assignments.forEach((row) => {
    const parts = parseBulletinDateParts(row.date, defaultYear)
    const key = mondayWeekKey(parts)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push({ row, parts })
  })
  map.forEach((list) => {
    list.sort((a, b) => (a.parts?.day ?? 0) - (b.parts?.day ?? 0))
  })
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export function weekDateRangeLabel(weekNum, defaultYear = 2026, defaultMonth = 7) {
  const startDay = (weekNum - 1) * 7 + 1
  const endDay = Math.min(startDay + 6, 31)
  const mm = String(defaultMonth + 1).padStart(2, '0')
  const y = defaultYear
  return `${String(startDay).padStart(2, '0')}/${mm}/${y} - ${String(endDay).padStart(2, '0')}/${mm}/${y}`
}

export function choirServiceBucket(serviceName) {
  if (/Tuesday/i.test(serviceName)) return 'tuesday'
  if (/Friday/i.test(serviceName)) return 'friday'
  if (/Sunday Service 1/i.test(serviceName)) return 'sunday1'
  if (/Sunday Service 2/i.test(serviceName)) return 'sunday2'
  if (/Igaburo/i.test(serviceName)) return 'igaburo'
  return 'other'
}

export function shortChoirDisplayName(name) {
  return String(name)
    .replace(/\s+Choir$/i, '')
    .trim()
}

export const STANDARD_WEEK_CHOIR_BUCKETS = ['tuesday', 'friday', 'sunday1', 'sunday2']

export function assignmentHasChoirs(row, parseList) {
  return parseList(row.choirs).length > 0
}

/** Weekly choir grid only when Tue, Fri, and both Sunday services are assigned. */
export function weekChoirGridReady(weekItems, parseList) {
  return STANDARD_WEEK_CHOIR_BUCKETS.every((bucket) => {
    const hit = weekItems.find(({ row }) => choirServiceBucket(row.service) === bucket)
    return hit && assignmentHasChoirs(hit.row, parseList)
  })
}

export function protocolServiceTitle(team, parts) {
  const date = formatBulletinDateSlash(parts)
  const name = team.serviceName ?? ''
  if (/Tuesday/i.test(name)) return `Iteraniro ryo kuwa kabiri ${date}`
  if (/Friday/i.test(name)) return `Iteraniro ryo kuwa gatanu ${date}`
  if (/Sunday Service 1/i.test(name)) return `Iteraniro rya mbere ku cyumweru ${date}`
  if (/Sunday Service 2/i.test(name)) return `Iteraniro rya kabiri ku cyumweru ${date}`
  if (/Igaburo/i.test(name)) return `Igaburo ryera ${date}`
  return `${name} ${date}`
}
