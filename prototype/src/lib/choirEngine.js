/** Choir auto-assignment — deterministic rotation engine. */

/** Pairs that must never both appear on the same Sunday (SS1 + SS2 combined). */
export const MUTUAL_EXCLUSIVE_SUNDAY_PAIRS = [['Beulah Choir', 'Yerusalemu Choir']]

/** Each sings on at most one Sunday per month. */
export const MONTHLY_ONCE_CHOIRS = ['Beulah Choir', 'Yerusalemu Choir']

export const WEEKDAY_BACK_TO_BACK_SERVICES = ['Tuesday Service', 'Friday Service']

export const FIXED_SLOT_CHOIRS = {
  'Sunday Service 1': ['Hope Choir'],
  'Tuesday Service': ['Worship Team'],
}

/** Canonical 4-choir Sunday rotation (indices into primary list). Repeats with offset. */
const SUNDAY_ROTATION_CYCLE = [
  { ss1: [0, 1], ss2: [2, 3] },
  { ss1: [0, 2], ss2: [1, 3] },
  { ss1: [3, 2], ss2: [0, 1] },
  { ss1: [1, 3], ss2: [0, 2] },
  { ss1: [2, 0], ss2: [3, 1] },
  { ss1: [3, 0], ss2: [1, 2] },
]

export function isSundayService(service) {
  return service === 'Sunday Service 1' || service === 'Sunday Service 2'
}

export function primaryChoirNames(catalog) {
  return (catalog?.primary ?? []).filter((c) => c !== 'Hope Choir')
}

export function isPrimaryChoir(name, catalog) {
  return primaryChoirNames(catalog).includes(name)
}

export function parseChoirList(choirs) {
  return String(choirs ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinChoirList(list) {
  const seen = new Set()
  const unique = []
  for (const c of list) {
    const name = String(c ?? '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    unique.push(name)
  }
  return unique.join(', ')
}

export function sundaySecondaryChoirs(ss1Choirs = [], ss2Choirs = []) {
  return [...ss1Choirs, ...ss2Choirs].filter((c) => MONTHLY_ONCE_CHOIRS.includes(c))
}

export function ss2ExpectedSlotCount(ss1Choirs = [], ss2Choirs = []) {
  if (sundaySecondaryChoirs(ss1Choirs, ss2Choirs).length === 0) return 2
  return 3
}

export function ss2UsesSecondary(choirs) {
  return parseChoirList(choirs).some((c) => MONTHLY_ONCE_CHOIRS.includes(c))
}

export function slotPrimaryChoirs(choirNames, catalog) {
  const primary = new Set(primaryChoirNames(catalog))
  return parseChoirList(choirNames).filter((c) => primary.has(c))
}

export function choirsOnService(assignments, serviceDate, serviceName) {
  const key = String(serviceDate ?? '').slice(0, 10)
  for (const row of assignments ?? []) {
    if (row.service !== serviceName) continue
    if (String(row.serviceDate ?? '').slice(0, 10) !== key) continue
    return parseChoirList(row.choirs)
  }
  return []
}

export function choirsOnSundayService(assignments, serviceDate, serviceName) {
  return choirsOnService(assignments, serviceDate, serviceName)
}

function serviceDatesFromAssignments(assignments, serviceName) {
  const dates = new Set()
  for (const row of assignments ?? []) {
    if (row.service !== serviceName) continue
    const d = String(row.serviceDate ?? '').slice(0, 10)
    if (d) dates.add(d)
  }
  return [...dates].sort()
}

export function previousServiceDate(assignments, serviceName, serviceDate) {
  const key = String(serviceDate ?? '').slice(0, 10)
  const dates = serviceDatesFromAssignments(assignments, serviceName)
  const idx = dates.indexOf(key)
  if (idx <= 0) return null
  return dates[idx - 1]
}

export function previousSundayDate(assignments, serviceDate) {
  return previousServiceDate(assignments, 'Sunday Service 1', serviceDate)
}

function fixedSlotSet(serviceName) {
  return new Set(FIXED_SLOT_CHOIRS[serviceName] ?? [])
}

export function sundayAssignmentsOnly(assignments) {
  return (assignments ?? []).filter((row) => isSundayService(row.service))
}

function pairKey(names) {
  return [...names].sort().join('|')
}

function splitFromIndices(primaries, spec) {
  const ss1 = spec.ss1.map((i) => primaries[i % primaries.length])
  const ss2 = spec.ss2.map((i) => primaries[i % primaries.length])
  return { ss1, ss2 }
}

function allSundaySplits(primaries) {
  const n = primaries.length
  if (n < 2) return [{ ss1: [...primaries], ss2: [] }]
  const splits = []
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const ss1 = [primaries[i], primaries[j]]
      const ss2 = primaries.filter((c) => !ss1.includes(c))
      if (ss2.length >= 2) {
        splits.push({ ss1: [...ss1], ss2: ss2.slice(0, 2) })
        splits.push({ ss1: ss2.slice(0, 2), ss2: [...ss1] })
      }
    }
  }
  return splits
}

function streakOnSlot(history, slot, choir) {
  let count = 0
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i][slot].includes(choir)) count += 1
    else break
  }
  return count
}

/** Score a Sunday split — lower is better; Infinity = forbidden. */
export function scoreSundaySplit(split, history) {
  const { ss1, ss2 } = split
  if (ss1.some((c) => ss2.includes(c))) return Infinity

  let score = 0
  if (history.length >= 1) {
    const prev = history[history.length - 1]
    if (pairKey(prev.ss1) === pairKey(ss2)) score += 10000
    if (pairKey(prev.ss2) === pairKey(ss1)) score += 10000
  }

  for (const choir of [...ss1, ...ss2]) {
    if (streakOnSlot(history, 'ss1', choir) >= 2 && ss1.includes(choir)) score += 10000
    if (streakOnSlot(history, 'ss2', choir) >= 2 && ss2.includes(choir)) score += 10000
  }

  if (history.length >= 2) {
    const prev2 = history[history.length - 2]
    if (pairKey(prev2.ss1) === pairKey(ss1) && pairKey(history[history.length - 1].ss1) === pairKey(ss1)) {
      score += 100
    }
  }

  return score
}

function pickSecondarySundays(sundayDates) {
  if (sundayDates.length === 0) return []
  if (sundayDates.length === 1) return [sundayDates[0]]
  const mid = Math.floor(sundayDates.length / 2)
  return [sundayDates[0], sundayDates[mid]]
}

function historyFromPrior(priorAssignments, catalog) {
  const dates = serviceDatesFromAssignments(priorAssignments, 'Sunday Service 1')
  return dates.map((date) => ({
    ss1: slotPrimaryChoirs(choirsOnService(priorAssignments, date, 'Sunday Service 1'), catalog),
    ss2: slotPrimaryChoirs(choirsOnService(priorAssignments, date, 'Sunday Service 2'), catalog),
  }))
}

function combinations(arr, k) {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  if (k === arr.length) return [[...arr]]
  const [head, ...tail] = arr
  return [
    ...combinations(tail, k - 1).map((c) => [head, ...c]),
    ...combinations(tail, k),
  ]
}

function adjustSplitForSecondaryOnSs1(split) {
  if (split.ss1.length < 2) return split
  const moved = split.ss1[1]
  return {
    ss1: [split.ss1[0]],
    ss2: [...split.ss2, moved],
  }
}

function passesSundayHardRules(split, history) {
  if (split.ss1.some((c) => split.ss2.includes(c))) return false
  if (history.length >= 1) {
    const prev = history[history.length - 1]
    if (pairKey(prev.ss1) === pairKey(split.ss2)) return false
    if (pairKey(prev.ss2) === pairKey(split.ss1)) return false
  }
  for (const c of split.ss1) {
    if (streakOnSlot(history, 'ss1', c) >= 2) return false
  }
  for (const c of split.ss2) {
    if (streakOnSlot(history, 'ss2', c) >= 2) return false
  }
  if (history.length >= 1 && pairKey(history[history.length - 1].ss1) === pairKey(split.ss1)) {
    return false
  }
  return true
}

function pickSundaySplitSized(primaries, history, weekIndex, ss1Count, ss2Count) {
  const order = []
  for (let o = 0; o < SUNDAY_ROTATION_CYCLE.length; o += 1) {
    order.push((weekIndex + o) % SUNDAY_ROTATION_CYCLE.length)
  }
  if (weekIndex === 1 && history[0]?.ss1?.length === 1) {
    order.unshift(3)
  }

  const attempts = order.map((idx) => splitFromIndices(primaries, SUNDAY_ROTATION_CYCLE[idx]))
  for (const ss1 of combinations(primaries, ss1Count)) {
    const ss2 = primaries.filter((c) => !ss1.includes(c))
    if (ss2.length === ss2Count) attempts.push({ ss1: [...ss1], ss2: [...ss2] })
  }

  for (const raw of attempts) {
    let split = raw
    if (ss1Count === 1 && ss2Count === 3) split = adjustSplitForSecondaryOnSs1(raw)
    if (passesSundayHardRules(split, history)) return split
  }

  for (const raw of attempts) {
    let split = raw
    if (ss1Count === 1 && ss2Count === 3) split = adjustSplitForSecondaryOnSs1(raw)
    const score = scoreSundaySplit(split, history)
    if (score < 10000) return split
  }

  for (const ss1 of combinations(primaries, ss1Count)) {
    const ss2 = primaries.filter((c) => !ss1.includes(c))
    if (ss2.length !== ss2Count) continue
    const split = { ss1: [...ss1], ss2: [...ss2] }
    if (!passesSundayHardRules(split, history)) continue
    return split
  }

  for (const ss1 of combinations(primaries, ss1Count)) {
    const ss2 = primaries.filter((c) => !ss1.includes(c))
    if (ss2.length !== ss2Count) continue
    const split = { ss1: [...ss1], ss2: [...ss2] }
    if (split.ss1.some((c) => split.ss2.includes(c))) continue
    let ok = true
    for (const c of split.ss1) if (streakOnSlot(history, 'ss1', c) >= 2) ok = false
    for (const c of split.ss2) if (streakOnSlot(history, 'ss2', c) >= 2) ok = false
    if (ok) return split
  }

  return splitFromIndices(primaries, SUNDAY_ROTATION_CYCLE[weekIndex % SUNDAY_ROTATION_CYCLE.length])
}

function buildSecondaryPlan(sundayDates, secondaryList) {
  const plan = new Map()
  const targets = pickSecondarySundays(sundayDates)
  targets.forEach((date, i) => {
    if (!secondaryList[i]) return
    plan.set(date, { secondary: secondaryList[i], onSs1: i === 0 })
  })
  return plan
}

function buildSundayPrimarySchedule(sundayDates, catalog, priorAssignments = [], secondaryPlan = new Map()) {
  const primaries = primaryChoirNames(catalog)
  const history = historyFromPrior(priorAssignments, catalog)
  const schedule = new Map()

  sundayDates.forEach((date, weekIndex) => {
    const sec = secondaryPlan.get(date)
    const ss1Count = sec?.onSs1 ? 1 : 2
    const ss2Count = sec?.onSs1 ? 3 : 2
    const split = pickSundaySplitSized(primaries, history, weekIndex, ss1Count, ss2Count)
    history.push({ ss1: [...split.ss1], ss2: [...split.ss2] })
    schedule.set(date, {
      ss1Primary: split.ss1,
      ss2Primary: split.ss2,
      secondary: sec?.secondary ?? null,
      secondaryOnSs1: sec?.onSs1 ?? false,
    })
  })

  return schedule
}

function composeSundayChoirs(entry) {
  const ss1Parts = ['Hope Choir']
  if (entry.secondaryOnSs1 && entry.secondary) {
    ss1Parts.push(entry.secondary, ...entry.ss1Primary.slice(0, 1))
  } else {
    ss1Parts.push(...entry.ss1Primary.slice(0, 2))
  }

  const ss2Parts = []
  if (entry.secondary && !entry.secondaryOnSs1) ss2Parts.push(entry.secondary)
  const ss2PrimarySlots = entry.secondary ? (entry.secondaryOnSs1 ? 3 : 2) : 2
  ss2Parts.push(...entry.ss2Primary.slice(0, ss2PrimarySlots))

  return {
    ss1: joinChoirList(ss1Parts),
    ss2: joinChoirList(ss2Parts),
  }
}

function weekKey(isoDate) {
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00Z`)
  const day = d.getUTCDay()
  const sunday = new Date(d)
  sunday.setUTCDate(d.getUTCDate() - day)
  return sunday.toISOString().slice(0, 10)
}

function buildWeekdayPrimaryRotation(dates, primaries, { priorLast = null, sameWeekAvoid = new Map() } = {}) {
  const map = new Map()
  let cursor = priorLast != null ? primaries.indexOf(priorLast) : 0
  if (cursor < 0) cursor = 0

  dates.forEach((date) => {
    const avoid = new Set(sameWeekAvoid.get(weekKey(date)) ?? [])
    let picked = null
    for (let step = 1; step <= primaries.length; step += 1) {
      cursor = (cursor + 1) % primaries.length
      const c = primaries[cursor]
      if (avoid.has(c)) continue
      const prevDate = [...map.keys()].sort().pop()
      if (prevDate && map.get(prevDate) === c) continue
      picked = c
      break
    }
    if (!picked) picked = primaries[cursor]
    map.set(date, picked)
  })

  return map
}

export function consecutiveSlotStreak(assignments, serviceName, serviceDate, choirName, catalog) {
  if (!isPrimaryChoir(choirName, catalog)) return 0
  let count = 0
  let date = String(serviceDate ?? '').slice(0, 10)
  let prev = previousServiceDate(assignments, serviceName, date)
  while (prev) {
    const names = slotPrimaryChoirs(choirsOnService(assignments, prev, serviceName), catalog)
    if (!names.includes(choirName)) break
    count += 1
    date = prev
    prev = previousServiceDate(assignments, serviceName, date)
  }
  return count
}

export function slotTripleStreakExclude(assignments, row, catalog, priorAssignments = []) {
  if (!row || !isSundayService(row.service)) return []
  const merged = [...sundayAssignmentsOnly(priorAssignments), ...sundayAssignmentsOnly(assignments)]
  const date = String(row.serviceDate ?? choirSlotKey(row)).slice(0, 10)
  return primaryChoirNames(catalog).filter(
    (c) => consecutiveSlotStreak(merged, row.service, date, c, catalog) >= 2,
  )
}

export function slotTripleStreakViolation(assignments, rowIndex, choirName, catalog, priorAssignments = []) {
  const row = assignments?.[rowIndex]
  if (!row || !choirName || !isPrimaryChoir(choirName, catalog)) return false
  const merged = [...sundayAssignmentsOnly(priorAssignments), ...sundayAssignmentsOnly(assignments)]
  return consecutiveSlotStreak(merged, row.service, row.serviceDate, choirName, catalog) >= 2
}

export function slotBackToBackExclude(assignments, row) {
  if (!row || !WEEKDAY_BACK_TO_BACK_SERVICES.includes(row.service)) return []
  const prev = previousServiceDate(assignments, row.service, row.serviceDate ?? choirSlotKey(row))
  if (!prev) return []
  const fixed = fixedSlotSet(row.service)
  return choirsOnService(assignments, prev, row.service).filter((c) => !fixed.has(c))
}

export function slotBackToBackViolation(assignments, rowIndex, choirName) {
  const row = assignments?.[rowIndex]
  if (!row || !choirName) return false
  if (!WEEKDAY_BACK_TO_BACK_SERVICES.includes(row.service)) return false
  if (fixedSlotSet(row.service).has(choirName)) return false
  const prev = previousServiceDate(assignments, row.service, row.serviceDate)
  if (!prev) return false
  return choirsOnService(assignments, prev, row.service).includes(choirName)
}

export function rotationExclude(assignments, row, catalog, priorAssignments = []) {
  if (!row) return []
  if (isSundayService(row.service)) return slotTripleStreakExclude(assignments, row, catalog, priorAssignments)
  return slotBackToBackExclude(assignments, row)
}

export function rotationViolation(assignments, rowIndex, choirName, catalog, priorAssignments = []) {
  const row = assignments?.[rowIndex]
  if (!row) return false
  if (isSundayService(row.service)) {
    return slotTripleStreakViolation(assignments, rowIndex, choirName, catalog, priorAssignments)
  }
  return slotBackToBackViolation(assignments, rowIndex, choirName)
}

export function ss1BackToBackExclude(assignments, row, catalog) {
  return slotTripleStreakExclude(assignments, row, catalog)
}

export function ss1RotationPrefer(assignments, row) {
  if (!row || row.service !== 'Sunday Service 2') return []
  const prev = previousSundayDate(assignments, row.serviceDate ?? choirSlotKey(row))
  if (!prev) return []
  return choirsOnSundayService(assignments, prev, 'Sunday Service 1').filter((c) => c !== 'Hope Choir')
}

export function ss1BackToBackViolation(assignments, rowIndex, choirName, catalog) {
  return slotTripleStreakViolation(assignments, rowIndex, choirName, catalog)
}

export function consecutiveSundayPrimaryExclude(assignments, row, catalog) {
  return slotTripleStreakExclude(assignments, row, catalog)
}

export function consecutiveSundayPrimaryViolation(assignments, rowIndex, choirName, catalog) {
  return slotTripleStreakViolation(assignments, rowIndex, choirName, catalog)
}

export function duplicateOnServiceViolation(assignments, rowIndex, choirName) {
  const row = assignments?.[rowIndex]
  if (!row || !choirName) return false
  return parseChoirList(row.choirs).includes(choirName)
}

export function shuffleCopy(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function exclusiveSundayPartners(names = []) {
  const set = new Set(names)
  const partners = new Set()
  for (const [a, b] of MUTUAL_EXCLUSIVE_SUNDAY_PAIRS) {
    if (set.has(a)) partners.add(b)
    if (set.has(b)) partners.add(a)
  }
  return [...partners]
}

export function monthlySundaySecondaryCounts(assignments, { skipIndex } = {}) {
  const counts = Object.fromEntries(MONTHLY_ONCE_CHOIRS.map((c) => [c, 0]))
  ;(assignments ?? []).forEach((row, i) => {
    if (i === skipIndex) return
    if (!isSundayService(row.service)) return
    for (const name of parseChoirList(row.choirs)) {
      if (counts[name] != null) counts[name] += 1
    }
  })
  return counts
}

export function monthlyChoirCounts(assignments, options) {
  return monthlySundaySecondaryCounts(assignments, options)
}

export function monthlyOnceExclude(assignments, skipIndex) {
  const counts = monthlySundaySecondaryCounts(assignments, { skipIndex })
  return MONTHLY_ONCE_CHOIRS.filter((c) => counts[c] > 0)
}

export function monthlyOnceViolation(assignments, rowIndex, choirName) {
  if (!MONTHLY_ONCE_CHOIRS.includes(choirName)) return false
  const row = assignments?.[rowIndex]
  if (row && !isSundayService(row.service)) return false
  const counts = monthlySundaySecondaryCounts(assignments, { skipIndex: rowIndex })
  return counts[choirName] > 0
}

export function streakAtDate(assignments, serviceName, serviceDate, choirName, catalog) {
  if (!isPrimaryChoir(choirName, catalog)) return 0
  let count = 0
  let date = String(serviceDate ?? '').slice(0, 10)
  while (date) {
    const names = slotPrimaryChoirs(choirsOnService(assignments, date, serviceName), catalog)
    if (!names.includes(choirName)) break
    count += 1
    date = previousServiceDate(assignments, serviceName, date)
  }
  return count
}

function pickNextPrimary(pool, exclude, prefer = []) {
  for (const c of prefer) {
    if (pool.includes(c) && !exclude.includes(c)) return c
  }
  for (const c of pool) {
    if (!exclude.includes(c)) return c
  }
  return pool[0] ?? null
}

export function regenerateChoirsForService(
  service,
  choirsCatalog,
  {
    exclude = [],
    prefer = [],
    ss1Secondary = null,
    ss2Secondary = null,
    ss2PrimaryCount = 2,
    ss1Primary = null,
    ss2Primary = null,
  } = {},
) {
  const primaryPool = primaryChoirNames(choirsCatalog)

  if (service === 'Sunday Service 1' && ss1Primary) {
    const parts = ['Hope Choir']
    if (ss1Secondary) parts.push(ss1Secondary)
    parts.push(...ss1Primary.slice(0, ss1Secondary ? 1 : 2))
    return joinChoirList(parts)
  }
  if (service === 'Sunday Service 2' && ss2Primary) {
    const parts = ss2Secondary ? [ss2Secondary] : []
    parts.push(...ss2Primary.slice(0, ss2Secondary ? 2 : ss2PrimaryCount))
    return joinChoirList(parts)
  }

  const blocked = new Set([...exclude, 'Hope Choir'])

  if (service === 'Sunday Service 1') {
    const n = ss1Secondary ? 1 : 2
    const picked = []
    for (let i = 0; i < n; i += 1) {
      const c = pickNextPrimary(primaryPool, [...blocked, ...picked], prefer)
      if (c) picked.push(c)
    }
    return joinChoirList(['Hope Choir', ...(ss1Secondary ? [ss1Secondary] : []), ...picked])
  }
  if (service === 'Sunday Service 2') {
    const parts = ss2Secondary ? [ss2Secondary] : []
    const n = ss2Secondary ? 2 : Math.max(2, Math.min(3, ss2PrimaryCount))
    const picked = []
    for (let i = 0; i < n; i += 1) {
      const c = pickNextPrimary(primaryPool, [...blocked, ...parts, ...picked], prefer)
      if (c) picked.push(c)
    }
    return joinChoirList([...parts, ...picked])
  }
  if (service === 'Igaburo Service') {
    const a = pickNextPrimary(primaryPool, [...blocked])
    const b = pickNextPrimary(primaryPool, [...blocked, a])
    return joinChoirList([a, b].filter(Boolean))
  }
  if (service === 'Tuesday Service') {
    const c = pickNextPrimary(primaryPool, [...blocked], prefer)
    return joinChoirList(['Worship Team', ...(c ? [c] : [])])
  }
  if (service === 'Friday Service') {
    const c = pickNextPrimary(primaryPool, [...blocked], prefer)
    return joinChoirList(c ? [c] : [])
  }
  return joinChoirList(primaryPool.slice(0, 2))
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
 * Build choir assignments — phased deterministic rotation:
 * 1. All Sunday primaries (round-robin SS1/SS2)
 * 2. Secondary choirs on two Sundays
 * 3. Tuesday (Worship + rotating primary)
 * 4. Friday (rotating primary, ≠ same week's Tuesday)
 */
export function buildMonthlyChoirAssignments(services, choirsCatalog, { priorAssignments = [] } = {}) {
  const slots = [...(services ?? [])]
    .filter((s) => s?.name && s?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.name).localeCompare(String(b.name)))

  const primaries = primaryChoirNames(choirsCatalog)
  const secondaryList = choirsCatalog.secondary ?? MONTHLY_ONCE_CHOIRS

  const sundayDates = slots.filter((s) => s.name === 'Sunday Service 1').map((s) => String(s.date)).sort()
  const tuesdayDates = slots.filter((s) => s.name === 'Tuesday Service').map((s) => String(s.date)).sort()
  const fridayDates = slots.filter((s) => s.name === 'Friday Service').map((s) => String(s.date)).sort()

  const secondaryPlan = buildSecondaryPlan(sundayDates, secondaryList)
  const sundaySchedule = buildSundayPrimarySchedule(sundayDates, choirsCatalog, priorAssignments, secondaryPlan)

  const sundayChoirs = new Map()
  for (const date of sundayDates) {
    const entry = sundaySchedule.get(date)
    if (!entry) continue
    const composed = composeSundayChoirs(entry)
    sundayChoirs.set(date, composed)
  }

  const priorTuesdayDates = serviceDatesFromAssignments(priorAssignments, 'Tuesday Service')
  const priorFridayDates = serviceDatesFromAssignments(priorAssignments, 'Friday Service')
  const lastPriorTuesday = priorTuesdayDates.length
    ? slotPrimaryChoirs(choirsOnService(priorAssignments, priorTuesdayDates.at(-1), 'Tuesday Service'), choirsCatalog)[0]
    : null
  const lastPriorFriday = priorFridayDates.length
    ? slotPrimaryChoirs(choirsOnService(priorAssignments, priorFridayDates.at(-1), 'Friday Service'), choirsCatalog)[0]
    : null

  const tuesdayMap = buildWeekdayPrimaryRotation(tuesdayDates, primaries, { priorLast: lastPriorTuesday })

  const fridaySameWeekAvoid = new Map()
  for (const fDate of fridayDates) {
    const wk = weekKey(fDate)
    const tInWeek = tuesdayDates.filter((t) => weekKey(t) === wk)
    const tChoir = tInWeek.length ? tuesdayMap.get(tInWeek[tInWeek.length - 1]) : null
    if (tChoir) fridaySameWeekAvoid.set(wk, [tChoir])
  }

  const fridayPrior = lastPriorFriday ?? (lastPriorTuesday ? primaries[(primaries.indexOf(lastPriorTuesday) + 1) % primaries.length] : null)
  const fridayMap = buildWeekdayPrimaryRotation(fridayDates, primaries, {
    priorLast: fridayPrior,
    sameWeekAvoid: fridaySameWeekAvoid,
  })

  const igaburoDates = slots.filter((s) => s.name === 'Igaburo Service').map((s) => String(s.date))
  const igaburoMap = new Map()
  igaburoDates.forEach((date, i) => {
    const a = primaries[i % primaries.length]
    const b = primaries[(i + 2) % primaries.length]
    igaburoMap.set(date, joinChoirList([a, b]))
  })

  const rows = []
  for (const s of slots) {
    let choirs
    const date = String(s.date)
    if (s.name === 'Sunday Service 1') {
      choirs = sundayChoirs.get(date)?.ss1 ?? joinChoirList(['Hope Choir', ...primaries.slice(0, 2)])
    } else if (s.name === 'Sunday Service 2') {
      choirs = sundayChoirs.get(date)?.ss2 ?? joinChoirList(primaries.slice(2, 4))
    } else if (s.name === 'Tuesday Service') {
      const p = tuesdayMap.get(date)
      choirs = joinChoirList(['Worship Team', ...(p ? [p] : [])])
    } else if (s.name === 'Friday Service') {
      const p = fridayMap.get(date)
      choirs = joinChoirList(p ? [p] : [])
    } else if (s.name === 'Igaburo Service') {
      choirs = igaburoMap.get(date) ?? joinChoirList(primaries.slice(0, 2))
    } else {
      choirs = joinChoirList(primaries.slice(0, 2))
    }

    rows.push({
      service: s.name,
      date: formatChoirSlotDate(s.date),
      serviceDate: s.date,
      choirs,
      status: 'Assigned',
    })
  }

  return rows.sort(
    (a, b) =>
      String(a.serviceDate).localeCompare(String(b.serviceDate)) ||
      String(a.service).localeCompare(String(b.service)),
  )
}
