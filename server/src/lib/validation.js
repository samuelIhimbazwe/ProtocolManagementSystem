import { FULL_ROSTER_TEAM_SIZE, isFullRosterKind } from './teamEngine.js'
import { TEAM_LIMITS } from './teamUtils.js'
import { canServeTeamKind } from './memberAvailability.js'

function choirRowForService(choirAssignments, serviceName, dateLabel) {
  return choirAssignments.find((c) => c.service === serviceName && c.date === dateLabel)
}

function formatDateLabel(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]}`
}

export function validateSchedulePayload(payload, rules, { memberByName, serveDaysByName } = {}) {
  const rows = []
  const services = payload.services ?? []
  const teams = payload.teamAssignments ?? []
  const choirs = payload.choirAssignments ?? []
  const ruleMap = Object.fromEntries(rules.map((r) => [r.id, r]))

  if (ruleMap['hope-ss1']?.enabled) {
    const ss1 = services.filter((s) => s.name === 'Sunday Service 1')
    const checked = []
    let ok = true
    for (const s of ss1) {
      const label = formatDateLabel(s.date)
      const row = choirRowForService(choirs, 'Sunday Service 1', label)
      if (!row) continue
      checked.push(label)
      if (!String(row.choirs ?? '').includes('Hope Choir')) ok = false
    }
    const skipped = ss1.length - checked.length
    rows.push({
      rule: 'Hope Choir on Sunday Service 1',
      issue: ok
        ? skipped
          ? `Confirmed for scheduled SS1 dates (${skipped} without a choir row yet)`
          : 'Confirmed for all Sunday Service 1 dates'
        : 'Missing Hope Choir on one or more SS1 dates',
      severity: ok ? 'Passed' : 'Error',
      service: 'All SS1',
      status: ok ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['sunday-team-size']?.enabled) {
    const sundayTeams = teams.filter((t) => t.kind === 'sunday')
    const bad = sundayTeams.filter((t) => (t.members?.length ?? 0) !== FULL_ROSTER_TEAM_SIZE)
    rows.push({
      rule: 'Sunday team size',
      issue:
        bad.length === 0
          ? `All Sunday services filled with ${FULL_ROSTER_TEAM_SIZE} members (incl. TL/VTL)`
          : `${bad.length} Sunday team(s) not exactly ${FULL_ROSTER_TEAM_SIZE} members`,
      severity: bad.length === 0 ? 'Passed' : 'Error',
      service: 'August Sundays',
      status: bad.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['tuesday-team-size']?.enabled) {
    const tueTeams = teams.filter((t) => t.kind === 'tuesday')
    const bad = tueTeams.filter((t) => (t.members?.length ?? 0) !== FULL_ROSTER_TEAM_SIZE)
    rows.push({
      rule: 'Tuesday team size',
      issue:
        bad.length === 0
          ? `All Tuesday services filled with ${FULL_ROSTER_TEAM_SIZE} members (incl. TL/VTL)`
          : `${bad.length} Tuesday team(s) not exactly ${FULL_ROSTER_TEAM_SIZE} members`,
      severity: bad.length === 0 ? 'Passed' : 'Error',
      service: 'August Tuesdays',
      status: bad.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['no-friday-teams']?.enabled) {
    const fridayTeams = teams.filter(
      (t) =>
        t.kind === 'friday' ||
        /Friday/i.test(t.serviceName ?? '') ||
        /Friday Service/i.test(t.date ?? ''),
    )
    rows.push({
      rule: 'No Friday protocol teams',
      issue:
        fridayTeams.length === 0
          ? 'Protocol does not serve on Friday — no Friday teams present'
          : `${fridayTeams.length} Friday team(s) must be removed`,
      severity: fridayTeams.length === 0 ? 'Passed' : 'Error',
      service: 'Friday services',
      status: fridayTeams.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['igaburo-team-size']?.enabled) {
    const ig = teams.filter((t) => t.kind === 'igaburo')
    const bad = ig.filter((t) => (t.members?.length ?? 0) !== FULL_ROSTER_TEAM_SIZE)
    rows.push({
      rule: 'Igaburo team size',
      issue:
        bad.length === 0
          ? `Igaburo Service filled with ${FULL_ROSTER_TEAM_SIZE} members (incl. TL/VTL)`
          : 'Igaburo roster size incorrect',
      severity: bad.length === 0 ? 'Passed' : 'Error',
      service: 'Igaburo',
      status: bad.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['member-availability']?.enabled) {
    const bad = []
    for (const t of teams) {
      for (const name of t.members ?? []) {
        const m = memberByName?.[name]
        const avail = m?.availability ?? 'available'
        if (m && avail !== 'available') bad.push(`${name} (${avail})`)
      }
    }
    rows.push({
      rule: 'Member duty availability',
      issue:
        bad.length === 0
          ? 'No sick, pregnant, on leave, or otherwise unavailable members on teams'
          : `${bad.length} unavailable member(s) still assigned: ${bad.slice(0, 4).join(', ')}${bad.length > 4 ? '…' : ''}`,
      severity: bad.length === 0 ? 'Passed' : 'Error',
      service: 'All services',
      status: bad.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['serve-days-match']?.enabled) {
    const bad = []
    for (const t of teams) {
      const kind = t.kind ?? 'weekday'
      for (const name of t.members ?? []) {
        if (serveDaysByName && !canServeTeamKind(serveDaysByName[name], kind)) {
          bad.push(`${name} on ${kind}`)
        }
      }
    }
    rows.push({
      rule: 'Serve days match service type',
      issue:
        bad.length === 0
          ? 'Tuesday-only members appear on Tuesday teams only'
          : `${bad.length} serve-day mismatch(es): ${bad.slice(0, 4).join(', ')}${bad.length > 4 ? '…' : ''}`,
      severity: bad.length === 0 ? 'Passed' : 'Error',
      service: 'All services',
      status: bad.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['min-team-size']?.enabled) {
    const bad = teams.filter((t) => {
      const min = isFullRosterKind(t.kind) ? FULL_ROSTER_TEAM_SIZE : TEAM_LIMITS.min
      return (t.members?.length ?? 0) < min
    })
    rows.push({
      rule: 'Minimum team size',
      issue: bad.length === 0 ? 'All teams meet minimum size' : `${bad.length} team(s) below minimum`,
      severity: bad.length === 0 ? 'Passed' : 'Error',
      service: 'All services',
      status: bad.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['max-team-size']?.enabled) {
    const bad = teams.filter((t) => {
      const max = isFullRosterKind(t.kind) ? FULL_ROSTER_TEAM_SIZE : TEAM_LIMITS.max
      return (t.members?.length ?? 0) > max
    })
    rows.push({
      rule: 'Maximum team size',
      issue: bad.length === 0 ? 'All teams within maximum size' : `${bad.length} team(s) exceed maximum`,
      severity: bad.length === 0 ? 'Passed' : 'Error',
      service: 'All services',
      status: bad.length === 0 ? 'Resolved' : 'Open',
    })
  }

  const errors = rows.filter((r) => r.severity === 'Error').length
  const warnings = rows.filter((r) => r.severity === 'Warning').length
  const passed = rows.filter((r) => r.severity === 'Passed').length

  return {
    rows,
    summary: {
      passed,
      warnings,
      errors,
      status: errors > 0 ? 'FAIL' : warnings > 0 ? 'WARN' : 'PASS',
    },
  }
}

export function publishBlocked(validationSummary, rules) {
  const blockRule = rules.find((r) => r.id === 'publish-block-errors')
  if (blockRule?.enabled && (validationSummary?.errors ?? 0) > 0) return true
  return false
}
