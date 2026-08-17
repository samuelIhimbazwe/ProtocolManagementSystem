import { normalizeTeam, shuffleCopy, TEAM_LIMITS } from './teamUtils.js'
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

function pickForKind(pool, kind, size, startOffset, exclude, serveDaysByName, tuesdayIndex, tuesdaySlotCount) {
  const eligible = eligiblePool(pool, kind, serveDaysByName)
  if (eligible.length < size) {
    throw new Error(`Not enough protocol members for ${kind} teams`)
  }
  const guaranteed = []
  if (kind === 'tuesday' && serveDaysByName && tuesdaySlotCount > 0) {
    const tueOnly = eligible.filter((n) => (serveDaysByName[n] || 'all') === 'tuesday')
    tueOnly.forEach((name, idx) => {
      if (idx % tuesdaySlotCount === tuesdayIndex) guaranteed.push(name)
    })
  }
  const remaining = Math.max(0, size - guaranteed.length)
  const restPool = eligible.filter((n) => !guaranteed.includes(n))
  const rest = remaining > 0 ? pickMembers(restPool.length ? restPool : eligible, remaining, startOffset, exclude) : []
  return [...guaranteed, ...rest.filter((n) => !guaranteed.includes(n))].slice(0, size)
}

export function buildMonthlyServiceTeams(protocolPool, services, { shuffle = true, serveDaysByName } = {}) {
  const pool = shuffle ? shuffleCopy(protocolPool) : [...protocolPool].sort((a, b) => a.localeCompare(b))
  if (pool.length < FULL_ROSTER_TEAM_SIZE) {
    throw new Error('Not enough protocol members for a full roster team')
  }

  const slots = buildTeamSlotsFromServices(services)
  const tuesdaySlotCount = slots.filter((s) => s.kind === 'tuesday').length
  const usedOnDate = new Map()
  let sundayIndex = 0
  let tuesdayIndex = 0
  let igaburoIndex = 0
  let weekdayIndex = 0

  return slots.map((slot) => {
    const base = { ...slot, status: 'Assigned' }

    if (slot.kind === 'sunday') {
      const exclude = usedOnDate.get(slot.serviceDate) ?? new Set()
      const members = pickForKind(
        pool,
        'sunday',
        FULL_ROSTER_TEAM_SIZE,
        sundayIndex * 7,
        exclude,
        serveDaysByName,
      )
      members.forEach((m) => exclude.add(m))
      usedOnDate.set(slot.serviceDate, exclude)
      sundayIndex += 1
      return { ...base, ...teamFromMembers(members, 'sunday') }
    }

    if (slot.kind === 'tuesday') {
      const members = pickForKind(
        pool,
        'tuesday',
        FULL_ROSTER_TEAM_SIZE,
        tuesdayIndex * 7 + 2,
        new Set(),
        serveDaysByName,
        tuesdayIndex,
        tuesdaySlotCount,
      )
      tuesdayIndex += 1
      return { ...base, ...teamFromMembers(members, 'tuesday') }
    }

    if (slot.kind === 'igaburo') {
      const members = pickForKind(
        pool,
        'igaburo',
        FULL_ROSTER_TEAM_SIZE,
        igaburoIndex * 9 + 3,
        new Set(),
        serveDaysByName,
      )
      igaburoIndex += 1
      return { ...base, ...teamFromMembers(members, 'igaburo') }
    }

    const members = pickForKind(
      pool,
      'weekday',
      FULL_ROSTER_TEAM_SIZE,
      weekdayIndex * 5 + 11,
      new Set(),
      serveDaysByName,
    )
    weekdayIndex += 1
    return { ...base, ...teamFromMembers(members, 'weekday') }
  })
}

export function minTeamSizeForRow(team) {
  return isFullRosterKind(team.kind) ? FULL_ROSTER_TEAM_SIZE : TEAM_LIMITS.min
}

export function maxTeamSizeForRow(team) {
  return isFullRosterKind(team.kind) ? FULL_ROSTER_TEAM_SIZE : TEAM_LIMITS.max
}

/** Remove unavailable / wrong-day members and refill rosters from the duty pool. */
export function sanitizeTeamAssignments(teams, { protocolPool, serveDaysByName } = {}) {
  if (!teams?.length || !protocolPool?.length) return teams ?? []

  const pool = [...protocolPool]
  const allowed = new Set(pool)
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
    const refillPool = eligiblePool(pool, kind, serveDaysByName).filter(
      (n) => !members.includes(n) && !exclude.has(n),
    )

    if (members.length < targetSize) {
      const extra = pickMembers(refillPool, targetSize - members.length, slotIndex * 7, new Set(members))
      members = [...members, ...extra]
      if (kind === 'sunday') extra.forEach((m) => exclude.add(m))
    }

    if (kind === 'sunday') usedOnDate.set(team.serviceDate, exclude)
    slotIndex += 1

    return normalizeTeam({ ...team, members: members.slice(0, targetSize) })
  })
}
