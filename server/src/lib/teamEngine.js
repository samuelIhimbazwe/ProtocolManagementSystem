import { normalizeTeam, shuffleCopy, TEAM_LIMITS } from './teamUtils.js'

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

export function buildMonthlyServiceTeams(protocolPool, services, { shuffle = true } = {}) {
  const pool = shuffle ? shuffleCopy(protocolPool) : [...protocolPool].sort((a, b) => a.localeCompare(b))
  if (pool.length < FULL_ROSTER_TEAM_SIZE) {
    throw new Error('Not enough protocol members for a full roster team')
  }

  const slots = buildTeamSlotsFromServices(services)
  const usedOnDate = new Map()
  let sundayIndex = 0
  let tuesdayIndex = 0
  let igaburoIndex = 0
  let weekdayIndex = 0

  return slots.map((slot) => {
    const base = { ...slot, status: 'Assigned' }

    if (slot.kind === 'sunday') {
      const exclude = usedOnDate.get(slot.serviceDate) ?? new Set()
      const members = pickMembers(pool, FULL_ROSTER_TEAM_SIZE, sundayIndex * 7, exclude)
      members.forEach((m) => exclude.add(m))
      usedOnDate.set(slot.serviceDate, exclude)
      sundayIndex += 1
      return { ...base, ...teamFromMembers(members, 'sunday') }
    }

    if (slot.kind === 'tuesday') {
      const members = pickMembers(pool, FULL_ROSTER_TEAM_SIZE, tuesdayIndex * 7 + 2)
      tuesdayIndex += 1
      return { ...base, ...teamFromMembers(members, 'tuesday') }
    }

    if (slot.kind === 'igaburo') {
      const members = pickMembers(pool, FULL_ROSTER_TEAM_SIZE, igaburoIndex * 9 + 3)
      igaburoIndex += 1
      return { ...base, ...teamFromMembers(members, 'igaburo') }
    }

    const members = pickMembers(pool, FULL_ROSTER_TEAM_SIZE, weekdayIndex * 5 + 11)
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
