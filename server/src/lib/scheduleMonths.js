/** Month helpers for multi-month schedules. */

export function liveMonthKeyFromToday(todayIso) {
  const raw = String(todayIso || '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 7)
  if (/^\d{4}-\d{2}$/.test(raw)) return raw
  return new Date().toISOString().slice(0, 7)
}

export function getPilotTodayIso() {
  return (process.env.TMS_TODAY ?? process.env.PMSS_TODAY) ?? new Date().toISOString().slice(0, 10)
}

export function getLiveMonthKey() {
  return liveMonthKeyFromToday(getPilotTodayIso())
}

/** @param {string} monthKey YYYY-MM */
export function nextMonthKey(monthKey) {
  const [y, m] = String(monthKey ?? '').split('-').map(Number)
  if (!y || !m) return null
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  return `${next.y}-${String(next.m).padStart(2, '0')}`
}

/** @param {string} monthKey YYYY-MM */
export function monthLabelFromKey(monthKey) {
  try {
    const [y, m] = String(monthKey).split('-').map(Number)
    if (!y || !m) return monthKey
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return monthKey
  }
}

export function emptyMonthPayload(monthKey) {
  const key = String(monthKey)
  return {
    monthKey: key,
    monthLabel: monthLabelFromKey(key),
    services: [],
    choirAssignments: [],
    teamAssignments: [],
    leadershipReview: [],
    validationRows: [],
    validationSummary: { passed: 0, warnings: 0, errors: 0, status: 'PENDING' },
  }
}
