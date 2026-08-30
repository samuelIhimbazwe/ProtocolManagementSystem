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

function parseChoirNames(choirs) {
  return String(choirs ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function sundayPairKey(row) {
  return String(row.serviceDate ?? row.date ?? '')
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

  if (ruleMap['no-ss1-ss2-overlap']?.enabled) {
    const overlaps = []
    const byDay = new Map()
    for (const row of choirs) {
      if (row.service !== 'Sunday Service 1' && row.service !== 'Sunday Service 2') continue
      const key = sundayPairKey(row)
      if (!byDay.has(key)) byDay.set(key, {})
      byDay.get(key)[row.service] = parseChoirNames(row.choirs)
    }
    for (const [day, pair] of byDay) {
      const a = pair['Sunday Service 1'] ?? []
      const b = pair['Sunday Service 2'] ?? []
      if (!a.length || !b.length) continue
      const shared = a.filter((c) => b.includes(c))
      if (shared.length) overlaps.push(`${day}: ${shared.join(', ')}`)
    }
    rows.push({
      rule: 'No shared choir on SS1 and SS2',
      issue:
        overlaps.length === 0
          ? 'No choir appears on both Sunday Service 1 and 2 on the same day'
          : `Same choir on SS1 and SS2: ${overlaps.slice(0, 4).join('; ')}${overlaps.length > 4 ? '…' : ''}`,
      severity: overlaps.length === 0 ? 'Passed' : 'Error',
      service: 'Sunday pairs',
      status: overlaps.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['no-beulah-yerusalemu-sunday']?.enabled) {
    const conflicts = []
    const byDay = new Map()
    for (const row of choirs) {
      if (row.service !== 'Sunday Service 1' && row.service !== 'Sunday Service 2') continue
      const key = sundayPairKey(row)
      if (!byDay.has(key)) byDay.set(key, new Set())
      for (const name of parseChoirNames(row.choirs)) byDay.get(key).add(name)
    }
    for (const [day, names] of byDay) {
      if (names.has('Beulah Choir') && names.has('Yerusalemu Choir')) {
        conflicts.push(day)
      }
    }
    rows.push({
      rule: 'Beulah and Yerusalemu not same Sunday',
      issue:
        conflicts.length === 0
          ? 'Beulah and Yerusalemu never appear on the same Sunday'
          : `Both on Sunday: ${conflicts.slice(0, 4).join(', ')}${conflicts.length > 4 ? '…' : ''}`,
      severity: conflicts.length === 0 ? 'Passed' : 'Error',
      service: 'Sundays',
      status: conflicts.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['beulah-yerusalemu-monthly-once']?.enabled) {
    const MONTHLY_ONCE = ['Beulah Choir', 'Yerusalemu Choir']
    const slotsByChoir = Object.fromEntries(MONTHLY_ONCE.map((c) => [c, []]))
    for (const row of choirs) {
      if (row.service !== 'Sunday Service 1' && row.service !== 'Sunday Service 2') continue
      const label = `${row.service} ${row.date}`
      for (const name of parseChoirNames(row.choirs)) {
        if (slotsByChoir[name]) slotsByChoir[name].push(label)
      }
    }
    const violations = MONTHLY_ONCE.filter((c) => slotsByChoir[c].length > 1).map(
      (c) => `${c}: ${slotsByChoir[c].length}× (${slotsByChoir[c].slice(0, 3).join(', ')}${slotsByChoir[c].length > 3 ? '…' : ''})`,
    )
    rows.push({
      rule: 'Beulah and Yerusalemu once per month',
      issue:
        violations.length === 0
          ? 'Beulah and Yerusalemu each appear at most once on Sundays this month'
          : violations.join('; '),
      severity: violations.length === 0 ? 'Passed' : 'Error',
      service: 'Monthly choir',
      status: violations.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['no-duplicate-choir-service']?.enabled) {
    const duplicates = []
    for (const row of choirs) {
      const names = parseChoirNames(row.choirs)
      const seen = new Set()
      const rowDups = new Set()
      for (const name of names) {
        if (seen.has(name)) rowDups.add(name)
        seen.add(name)
      }
      if (rowDups.size) {
        duplicates.push(`${row.service} ${row.date}: ${[...rowDups].join(', ')}`)
      }
    }
    rows.push({
      rule: 'No duplicate choir on same service',
      issue:
        duplicates.length === 0
          ? 'No choir appears twice on the same service'
          : duplicates.slice(0, 4).join('; ') + (duplicates.length > 4 ? '…' : ''),
      severity: duplicates.length === 0 ? 'Passed' : 'Error',
      service: 'All services',
      status: duplicates.length === 0 ? 'Resolved' : 'Open',
    })
  }

  if (ruleMap['no-primary-consecutive-sundays']?.enabled) {
    const PRIMARY = [
      'El Bethel Choir',
      "Ijwi ry'Umwami Yesu Choir",
      'Elim Choir',
      'Integuza Choir',
    ]
    const violations = []

    for (const serviceName of ['Sunday Service 1', 'Sunday Service 2']) {
      const slotRows = choirs
        .filter((row) => row.service === serviceName)
        .sort((a, b) =>
          String(a.serviceDate ?? a.date ?? '').localeCompare(String(b.serviceDate ?? b.date ?? '')),
        )
      for (let i = 2; i < slotRows.length; i += 1) {
        for (const choir of PRIMARY) {
          const on = (row) =>
            parseChoirNames(row.choirs).includes(choir)
          if (on(slotRows[i - 2]) && on(slotRows[i - 1]) && on(slotRows[i])) {
            violations.push(
              `${choir}: 3× ${serviceName} ${slotRows[i - 2].date} → ${slotRows[i].date}`,
            )
          }
        }
      }
    }

    for (const serviceName of ['Tuesday Service', 'Friday Service']) {
      const slotRows = choirs
        .filter((row) => row.service === serviceName)
        .sort((a, b) =>
          String(a.serviceDate ?? a.date ?? '').localeCompare(String(b.serviceDate ?? b.date ?? '')),
        )
      const skip = serviceName === 'Tuesday Service' ? new Set(['Worship Team']) : new Set()
      for (let i = 1; i < slotRows.length; i += 1) {
        const prevNames = parseChoirNames(slotRows[i - 1].choirs).filter((c) => !skip.has(c))
        const currNames = parseChoirNames(slotRows[i].choirs).filter((c) => !skip.has(c))
        const repeat = prevNames.filter((c) => currNames.includes(c))
        if (repeat.length) {
          violations.push(
            `${repeat.join(', ')}: ${serviceName} ${slotRows[i - 1].date} → ${slotRows[i].date}`,
          )
        }
      }
    }

    rows.push({
      rule: 'No 3-in-a-row on Sunday slots (weekday back-to-back)',
      issue:
        violations.length === 0
          ? 'No primary choir 3 Sundays in a row on SS1/SS2; no weekday back-to-back repeats'
          : violations.slice(0, 4).join('; ') + (violations.length > 4 ? '…' : ''),
      severity: violations.length === 0 ? 'Passed' : 'Error',
      service: 'SS1, SS2, Tuesday, Friday',
      status: violations.length === 0 ? 'Resolved' : 'Open',
    })
  }

  {
    const ss2CountIssues = []
    const byDay = new Map()
    for (const row of choirs) {
      if (row.service !== 'Sunday Service 1' && row.service !== 'Sunday Service 2') continue
      const key = sundayPairKey(row)
      if (!byDay.has(key)) byDay.set(key, {})
      byDay.get(key)[row.service] = parseChoirNames(row.choirs)
    }
    for (const [day, pair] of byDay) {
      const ss1 = pair['Sunday Service 1'] ?? []
      const ss2 = pair['Sunday Service 2'] ?? []
      if (!ss2.length) continue
      const secondary = [...ss1, ...ss2].filter((c) => c === 'Beulah Choir' || c === 'Yerusalemu Choir')
      const expected = secondary.length > 0 ? 3 : 2
      if (ss2.length !== expected) {
        ss2CountIssues.push(`${day}: SS2 has ${ss2.length}, expected ${expected}`)
      }
    }
    if (ss2CountIssues.length) {
      rows.push({
        rule: 'Sunday Service 2 choir count',
        issue: ss2CountIssues.slice(0, 4).join('; ') + (ss2CountIssues.length > 4 ? '…' : ''),
        severity: 'Error',
        service: 'SS2',
        status: 'Open',
      })
    }
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

const CHOIR_RULE_IDS = new Set([
  'hope-ss1',
  'no-ss1-ss2-overlap',
  'no-beulah-yerusalemu-sunday',
  'beulah-yerusalemu-monthly-once',
  'no-primary-consecutive-sundays',
  'no-duplicate-choir-service',
])

/** Choir-only validation for choir scheduler publish. */
export function validateChoirPayload(payload, rules) {
  const full = validateSchedulePayload(payload, rules)
  const rows = full.rows.filter((r) => {
    const id = rules.find((rule) => rule.name === r.rule)?.id
    if (id && CHOIR_RULE_IDS.has(id)) return true
    return /hope choir|shared choir on ss1|beulah and yerusalemu|once per month|ss1 back-to-back|ss1 → ss2|duplicate choir/i.test(
      r.rule ?? '',
    )
  })
  const choirs = payload.choirAssignments ?? []
  const services = (payload.services ?? []).filter((s) => !/^Friday\b/i.test(s.name ?? ''))
  if (services.length > 0) {
    const missing = services.filter((s) => {
      const label = formatDateLabel(s.date)
      return !choirs.some((c) => c.service === s.name && c.date === label)
    })
    rows.push({
      rule: 'Choir coverage',
      issue:
        missing.length === 0
          ? `Choir assigned for all ${services.length} non-Friday services`
          : `${missing.length} service(s) still need a choir assignment`,
      severity: missing.length === 0 ? 'Passed' : 'Error',
      service: 'All services',
      status: missing.length === 0 ? 'Resolved' : 'Open',
    })
  } else {
    rows.push({
      rule: 'Choir coverage',
      issue: 'Generate the monthly calendar before assigning choirs',
      severity: 'Error',
      service: 'Calendar',
      status: 'Open',
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
