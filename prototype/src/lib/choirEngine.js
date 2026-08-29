/** Choir auto-assignment helpers — used by UI generation and validation tests. */

/** Pairs that must never both appear on the same Sunday (SS1 + SS2 combined). */
export const MUTUAL_EXCLUSIVE_SUNDAY_PAIRS = [['Beulah Choir', 'Yerusalemu Choir']]

/** Each may appear on at most one service in the month. */
export const MONTHLY_ONCE_CHOIRS = ['Beulah Choir', 'Yerusalemu Choir']

export function parseChoirList(choirs) {
  return String(choirs ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinChoirList(list) {
  return list.join(', ')
}

export function shuffleCopy(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Partners of any choir in `names` that cannot share the same Sunday. */
export function exclusiveSundayPartners(names = []) {
  const set = new Set(names)
  const partners = new Set()
  for (const [a, b] of MUTUAL_EXCLUSIVE_SUNDAY_PAIRS) {
    if (set.has(a)) partners.add(b)
    if (set.has(b)) partners.add(a)
  }
  return [...partners]
}

/** Count monthly-once choir appearances across assignments (optional row index to skip). */
export function monthlyChoirCounts(assignments, { skipIndex } = {}) {
  const counts = Object.fromEntries(MONTHLY_ONCE_CHOIRS.map((c) => [c, 0]))
  ;(assignments ?? []).forEach((row, i) => {
    if (i === skipIndex) return
    for (const name of parseChoirList(row.choirs)) {
      if (counts[name] != null) counts[name] += 1
    }
  })
  return counts
}

/** Choirs already used this month on other services — exclude when auto-picking. */
export function monthlyOnceExclude(assignments, skipIndex) {
  const counts = monthlyChoirCounts(assignments, { skipIndex })
  return MONTHLY_ONCE_CHOIRS.filter((c) => counts[c] > 0)
}

/** True if adding `choirName` would exceed once-per-month for Beulah / Yerusalemu. */
export function monthlyOnceViolation(assignments, rowIndex, choirName) {
  if (!MONTHLY_ONCE_CHOIRS.includes(choirName)) return false
  const counts = monthlyChoirCounts(assignments, { skipIndex: rowIndex })
  return counts[choirName] > 0
}

function pickN(pool, n, exclude = []) {
  const blocked = new Set(exclude)
  const available = pool.filter((c) => !blocked.has(c))
  return shuffleCopy(available).slice(0, Math.min(n, available.length))
}

/** Like pickN, but never selects both sides of a mutual-exclusive Sunday pair. */
function pickNSunday(pool, n, exclude = []) {
  const blocked = new Set(exclude)
  const result = []
  for (const c of shuffleCopy(pool.filter((x) => !blocked.has(x)))) {
    if (result.length >= n) break
    if (exclusiveSundayPartners(result).includes(c)) continue
    result.push(c)
    for (const p of exclusiveSundayPartners([c])) blocked.add(p)
  }
  return result
}

/**
 * Auto-assign choirs for one service. Never picks from `exclude`
 * (used so SS1 and SS2 on the same day do not share choirs, and so
 * Beulah / Yerusalemu never share a Sunday).
 */
export function regenerateChoirsForService(service, choirsCatalog, { exclude = [] } = {}) {
  const { primary, secondary } = choirsCatalog
  const blocked = [...exclude, 'Hope Choir'].filter((c, i, a) => a.indexOf(c) === i)

  if (service === 'Sunday Service 1') {
    const pool = primary.filter((c) => c !== 'Hope Choir' && !exclude.includes(c))
    return joinChoirList(['Hope Choir', ...pickNSunday(pool, 2, [])])
  }
  if (service === 'Sunday Service 2') {
    return joinChoirList(pickNSunday([...primary, ...secondary], 3, blocked))
  }
  if (service === 'Igaburo Service') {
    return joinChoirList(pickN([...primary, ...secondary], 2, exclude))
  }
  if (service === 'Tuesday Service') {
    return joinChoirList(['Worship Team', ...pickN(primary, 1, exclude)])
  }
  if (service === 'Friday Service') {
    return joinChoirList(pickN([...primary, ...secondary], 1, exclude))
  }
  return joinChoirList(pickN(primary, 2, exclude))
}

export function allChoirOptions(choirsCatalog) {
  return [...choirsCatalog.special, ...choirsCatalog.primary, ...choirsCatalog.secondary]
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatChoirSlotDate(isoDate) {
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(isoDate)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTH_LABELS[d.getUTCMonth()]}`
}

export function choirSlotKey(row) {
  return String(row.serviceDate ?? row.date ?? '')
}

export function siblingSundayChoirs(assignments, row) {
  if (!row || !/^Sunday Service [12]$/.test(row.service ?? '')) return []
  const other = row.service === 'Sunday Service 1' ? 'Sunday Service 2' : 'Sunday Service 1'
  const key = choirSlotKey(row)
  const sibling = (assignments ?? []).find(
    (a) => a.service === other && (choirSlotKey(a) === key || a.date === row.date),
  )
  return sibling ? parseChoirList(sibling.choirs) : []
}

/** All choirs already on SS1 + SS2 for the same Sunday as `row`. */
export function sundayDayChoirs(assignments, row) {
  if (!row || !/^Sunday Service [12]$/.test(row.service ?? '')) return []
  const key = choirSlotKey(row)
  const names = []
  for (const a of assignments ?? []) {
    if (!/^Sunday Service [12]$/.test(a.service ?? '')) continue
    if (choirSlotKey(a) !== key && a.date !== row.date) continue
    names.push(...parseChoirList(a.choirs))
  }
  return names
}

/**
 * Build choir assignments for every service in the monthly calendar.
 * Same-day SS1/SS2 never share a choir via automatic generation.
 * Beulah and Yerusalemu never both appear on the same Sunday.
 * Beulah and Yerusalemu each sing at most once per month.
 */
export function buildMonthlyChoirAssignments(services, choirsCatalog) {
  const slots = [...(services ?? [])]
    .filter((s) => s?.name && s?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.name).localeCompare(String(b.name)))

  const byDate = new Map()
  for (const s of slots) {
    const key = String(s.date)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key).push(s)
  }

  const rows = []
  const usedMonthlyOnce = new Set()

  for (const [, daySlots] of byDate) {
    const ordered = [
      ...daySlots.filter((s) => s.name === 'Sunday Service 1'),
      ...daySlots.filter((s) => s.name === 'Sunday Service 2'),
      ...daySlots.filter((s) => s.name !== 'Sunday Service 1' && s.name !== 'Sunday Service 2'),
    ]
    let ss1Choirs = []

    for (const s of ordered) {
      let exclude = [...usedMonthlyOnce]
      if (s.name === 'Sunday Service 2') {
        exclude = [...exclude, ...ss1Choirs, ...exclusiveSundayPartners(ss1Choirs)]
      }
      const choirs = regenerateChoirsForService(s.name, choirsCatalog, { exclude })
      if (s.name === 'Sunday Service 1') ss1Choirs = parseChoirList(choirs)
      for (const c of parseChoirList(choirs)) {
        if (MONTHLY_ONCE_CHOIRS.includes(c)) usedMonthlyOnce.add(c)
      }
      rows.push({
        service: s.name,
        date: formatChoirSlotDate(s.date),
        serviceDate: s.date,
        choirs,
        status: 'Assigned',
      })
    }
  }

  return rows.sort(
    (a, b) =>
      String(a.serviceDate).localeCompare(String(b.serviceDate)) ||
      String(a.service).localeCompare(String(b.service)),
  )
}
