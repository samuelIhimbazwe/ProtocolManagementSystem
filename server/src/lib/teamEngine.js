import { normalizeTeam, TEAM_LIMITS } from './teamUtils.js'
import { canServeTeamKind } from './memberAvailability.js'

export const FULL_ROSTER_TEAM_SIZE = 10

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatSlotDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`)
  const day = d.getUTCDate()
  const mon = MONTH_LABELS[d.getUTCMonth()]
  return `${String(day).padStart(2, '0')} ${mon}`
}

export function isSundayService(serviceName) {
  return serviceName === 'Sunday Service 1' || serviceName === 'Sunday Service 2'
}

export function isTuesdayService(serviceName) {
  return serviceName === 'Tuesday Service'
}

export function isFridayService(serviceName) {
  return serviceName === 'Friday Service' || /^Friday\b/i.test(String(serviceName ?? ''))
}

export function isIgaburoService(serviceName) {
  return serviceName === 'Igaburo Service'
}

/** Protocol teams are not assigned on Friday services. */
export function isProtocolTeamService(serviceName) {
  return !isFridayService(serviceName)
}

export function isFullRosterService(serviceName) {
  return isSundayService(serviceName) || isTuesdayService(serviceName) || isIgaburoService(serviceName)
}

export function isFullRosterKind(kind) {
  return kind === 'sunday' || kind === 'tuesday' || kind === 'igaburo'
}

export function fullRosterKindLabel(kind) {
  if (kind === 'igaburo') return 'Igaburo'
  if (kind === 'tuesday') return 'Tuesday'
  if (kind === 'sunday') return 'Sunday'
  return 'Full roster'
}

export function buildTeamSlotsFromServices(services) {
  const sorted = [...services]
    .filter((s) => isProtocolTeamService(s.name))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))

  const sunday = sorted.filter((s) => isSundayService(s.name))
  const tuesday = sorted.filter((s) => isTuesdayService(s.name))
  const igaburo = sorted.filter((s) => isIgaburoService(s.name))
  const other = sorted.filter((s) => !isFullRosterService(s.name))
  const ordered = [...sunday, ...tuesday, ...igaburo, ...other]

  return ordered.map((s) => {
    let kind = 'weekday'
    if (isSundayService(s.name)) kind = 'sunday'
    else if (isTuesdayService(s.name)) kind = 'tuesday'
    else if (isIgaburoService(s.name)) kind = 'igaburo'

    return {
      serviceId: s.id,
      serviceName: s.name,
      serviceDate: s.date,
      date: `${formatSlotDate(s.date)} — ${s.name}`,
      kind,
      targetSize: FULL_ROSTER_TEAM_SIZE,
    }
  })
}

function teamFromMembers(members, kind) {
  return normalizeTeam({
    members,
    size: members.length,
    teamLeader: members[0] ?? null,
    viceTeamLeader: members[1] ?? null,
    kind,
  })
}

function eligiblePool(pool, kind, serveDaysByName) {
  if (!serveDaysByName) return pool
  return pool.filter((name) => canServeTeamKind(serveDaysByName[name], kind))
}

function pickMembers(pool, size, startOffset, exclude = new Set()) {
  const members = []
  let i = 0
  while (members.length < size && i < pool.length * 3) {
    const name = pool[(startOffset + i) % pool.length]
    i += 1
    if (exclude.has(name) || members.includes(name)) continue
    members.push(name)
  }
  while (members.length < size) {
    const name = pool[(startOffset + members.length) % pool.length]
    if (!members.includes(name)) members.push(name)
    else members.push(pool[members.length % pool.length])
  }
  return members.slice(0, size)
}

/** Count service-team slots filled per member this month. */
export function countMemberDuties(teams, pool) {
  const counts = Object.fromEntries(pool.map((n) => [n, 0]))
  for (const team of teams ?? []) {
    for (const name of team.members ?? []) {
      if (counts[name] != null) counts[name] += 1
    }
  }
  return counts
}

/** Target monthly duties per member — prefer exactly 3 or 4 when the month allows. */
export function computeDutyTargets(pool, totalCapacity, priorMeta = null) {
  const prior = priorMeta?.dutyCounts ?? {}
  const n = pool.length
  const targets = new Map()
  if (!n) return targets

  const minAll3 = n * 3
  const maxAll4 = n * 4

  const rankForExtra = (a, b) => {
    const pa = prior[a] ?? 3
    const pb = prior[b] ?? 3
    if (pa !== pb) return pa - pb
    return a.localeCompare(b)
  }

  if (totalCapacity >= minAll3 && totalCapacity <= maxAll4) {
    const fourCount = totalCapacity - minAll3
    const ranked = [...pool].sort(rankForExtra)
    ranked.forEach((name, i) => targets.set(name, i < fourCount ? 4 : 3))
  } else if (totalCapacity > maxAll4) {
    pool.forEach((name) => targets.set(name, 4))
  } else {
    const base = Math.floor(totalCapacity / n)
    const rem = totalCapacity % n
    const ranked = [...pool].sort(rankForExtra)
    ranked.forEach((name, i) => {
      targets.set(name, Math.min(4, base + (i < rem ? 1 : 0)))
    })
  }

  return targets
}

function rotationOrder(pool, startIndex = 0) {
  const sorted = [...pool].sort((a, b) => a.localeCompare(b))
  if (!sorted.length) return []
  const idx = ((startIndex % sorted.length) + sorted.length) % sorted.length
  return [...sorted.slice(idx), ...sorted.slice(0, idx)]
}

function tuesdayGuaranteedForSlot(pool, serveDaysByName, tuesdayIndex, tuesdaySlotCount) {
  if (!serveDaysByName || tuesdaySlotCount <= 0) return []
  const eligible = eligiblePool(pool, 'tuesday', serveDaysByName)
  return eligible.filter((name) => (serveDaysByName[name] || 'all') === 'tuesday')
    .filter((_name, idx) => idx % tuesdaySlotCount === tuesdayIndex)
}

function pickNextMember(state, { kind, exclude, guaranteed = [] }) {
  const { order, dutyCounts, targets, serveDaysByName } = state
  const guaranteedSet = new Set(
    guaranteed.filter(
      (name) =>
        !exclude.has(name) &&
        (dutyCounts[name] ?? 0) < (targets.get(name) ?? 4) &&
        canServeTeamKind(serveDaysByName?.[name], kind),
    ),
  )

  const candidates = order.filter(
    (name) =>
      !exclude.has(name) &&
      canServeTeamKind(serveDaysByName?.[name], kind) &&
      (dutyCounts[name] ?? 0) < (targets.get(name) ?? 4),
  )

  candidates.sort((a, b) => {
    const ga = guaranteedSet.has(a) ? 0 : 1
    const gb = guaranteedSet.has(b) ? 0 : 1
    if (ga !== gb) return ga - gb
    const da = (dutyCounts[a] ?? 0) - (dutyCounts[b] ?? 0)
    if (da !== 0) return da
    return order.indexOf(a) - order.indexOf(b)
  })

  const pick = candidates[0] ?? null
  if (!pick) return null

  dutyCounts[pick] = (dutyCounts[pick] ?? 0) + 1
  const idx = order.indexOf(pick)
  if (idx >= 0) {
    state.order = [...order.slice(0, idx), ...order.slice(idx + 1), pick]
  }
  state.picks += 1
  return pick
}

export function buildTeamEngineMeta(pool, teams, rotationIndex, targets) {
  return {
    dutyCounts: countMemberDuties(teams, pool),
    rotationIndex,
    targets: Object.fromEntries([...targets.entries()]),
  }
}

export function buildMonthlyServiceTeams(protocolPool, services, options = {}) {
  const { serveDaysByName, priorMeta, rosterSize = FULL_ROSTER_TEAM_SIZE } = options
  const pool = [...new Set(protocolPool.filter(Boolean))]
  if (!pool.length) {
    throw new Error('No protocol members available')
  }

  const slots = buildTeamSlotsFromServices(services)
  const totalCapacity = slots.length * rosterSize
  const targets = computeDutyTargets(pool, totalCapacity, priorMeta)
  const dutyCounts = Object.fromEntries(pool.map((n) => [n, 0]))
  const state = {
    order: rotationOrder(pool, priorMeta?.rotationIndex ?? 0),
    dutyCounts,
    targets,
    serveDaysByName,
    picks: 0,
  }

  const usedOnDate = new Map()
  let tuesdayIndex = 0
  const tuesdaySlotCount = slots.filter((s) => s.kind === 'tuesday').length

  const teams = slots.map((slot) => {
    const base = { ...slot, status: 'Assigned' }
    const exclude = slot.kind === 'sunday' ? (usedOnDate.get(slot.serviceDate) ?? new Set()) : new Set()
    const guaranteed =
      slot.kind === 'tuesday'
        ? tuesdayGuaranteedForSlot(pool, serveDaysByName, tuesdayIndex, tuesdaySlotCount)
        : []

    const members = []
    for (let pos = 0; pos < rosterSize; pos += 1) {
      const pick = pickNextMember(state, { kind: slot.kind, exclude, guaranteed })
      if (!pick) break
      members.push(pick)
      if (slot.kind === 'sunday') exclude.add(pick)
    }

    if (slot.kind === 'sunday') usedOnDate.set(slot.serviceDate, exclude)
    if (slot.kind === 'tuesday') tuesdayIndex += 1

    const partial = members.length < rosterSize
    return {
      ...base,
      status: members.length ? (partial ? 'Partial' : 'Assigned') : 'Draft',
      ...teamFromMembers(members, slot.kind),
    }
  })

  const rotationIndex =
    pool.length > 0 ? (priorMeta?.rotationIndex ?? 0) + state.picks : 0
  const meta = buildTeamEngineMeta(pool, teams, rotationIndex % Math.max(pool.length, 1), targets)

  return { teams, meta }
}

export function minTeamSizeForRow(team) {
  return isFullRosterKind(team.kind) ? FULL_ROSTER_TEAM_SIZE : TEAM_LIMITS.min
}

export function maxTeamSizeForRow(team) {
  return isFullRosterKind(team.kind) ? FULL_ROSTER_TEAM_SIZE : TEAM_LIMITS.max
}

/** Remove unavailable / wrong-day members; refill empty slots without exceeding saved duty targets. */
export function sanitizeTeamAssignments(teams, { protocolPool, serveDaysByName, teamEngineMeta } = {}) {
  if (!teams?.length || !protocolPool?.length) return teams ?? []

  const pool = [...protocolPool]
  const allowed = new Set(pool)
  const targets = teamEngineMeta?.targets ?? {}
  const dutyCounts = countMemberDuties(teams, pool)
  const tuesdaySlotCount = teams.filter((t) => t.kind === 'tuesday').length
  const usedOnDate = new Map()
  let tuesdayIndex = 0
  let slotIndex = 0

  return teams.map((team) => {
    const kind = team.kind ?? 'weekday'
    const targetSize = isFullRosterKind(kind)
      ? FULL_ROSTER_TEAM_SIZE
      : Math.min(team.targetSize ?? TEAM_LIMITS.max, TEAM_LIMITS.max)

    let members = (team.members ?? []).filter(
      (n) => allowed.has(n) && canServeTeamKind(serveDaysByName?.[n], kind),
    )

    if (kind === 'tuesday' && serveDaysByName && tuesdaySlotCount > 0) {
      const eligible = eligiblePool(pool, kind, serveDaysByName)
      const tueOnly = eligible.filter((n) => (serveDaysByName[n] || 'all') === 'tuesday')
      tueOnly.forEach((name, idx) => {
        if (idx % tuesdaySlotCount === tuesdayIndex && !members.includes(name)) {
          members.push(name)
        }
      })
      tuesdayIndex += 1
    }

    members = [...new Set(members)]
    const exclude = kind === 'sunday' ? (usedOnDate.get(team.serviceDate) ?? new Set()) : new Set()
    const refillPool = eligiblePool(pool, kind, serveDaysByName).filter((n) => {
      if (members.includes(n) || exclude.has(n)) return false
      const cap = targets[n] ?? 4
      return (dutyCounts[n] ?? 0) < cap
    })

    if (members.length < targetSize) {
      const need = targetSize - members.length
      const extra = pickMembers(refillPool, need, slotIndex * 7, new Set(members))
      extra.forEach((n) => {
        dutyCounts[n] = (dutyCounts[n] ?? 0) + 1
      })
      members = [...members, ...extra]
      if (kind === 'sunday') extra.forEach((m) => exclude.add(m))
    }

    if (kind === 'sunday') usedOnDate.set(team.serviceDate, exclude)
    slotIndex += 1

    return normalizeTeam({ ...team, members: members.slice(0, targetSize) })
  })
}
