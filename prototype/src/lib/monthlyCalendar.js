const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

/**
 * Build ministry services for a month:
 * Sundays → Sunday Service 1 & 2, Tuesdays, Fridays, last Saturday → Igaburo.
 * @param {string} monthKey YYYY-MM
 */
export function buildMonthlyServices(monthKey) {
  const [y, m] = String(monthKey ?? '').split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return []

  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const days = []
  for (let d = 1; d <= lastDay; d += 1) {
    const date = new Date(Date.UTC(y, m - 1, d))
    days.push({
      date: `${monthKey}-${String(d).padStart(2, '0')}`,
      day: DAY_NAMES[date.getUTCDay()],
      dow: date.getUTCDay(),
    })
  }

  const services = []
  let n = 1
  const push = (name, { date, day }) => {
    services.push({
      id: `s-${monthKey}-${String(n).padStart(2, '0')}`,
      name,
      date,
      day,
      status: 'Scheduled',
    })
    n += 1
  }

  for (const d of days) {
    if (d.dow === 0) {
      push('Sunday Service 1', d)
      push('Sunday Service 2', d)
    } else if (d.dow === 2) {
      push('Tuesday Service', d)
    } else if (d.dow === 5) {
      push('Friday Service', d)
    }
  }

  const saturdays = days.filter((d) => d.dow === 6)
  if (saturdays.length) {
    push('Igaburo Service', saturdays[saturdays.length - 1])
  }

  const nameOrder = {
    'Sunday Service 1': 1,
    'Sunday Service 2': 2,
    'Tuesday Service': 3,
    'Friday Service': 4,
    'Igaburo Service': 5,
  }
  return services.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (nameOrder[a.name] ?? 9) - (nameOrder[b.name] ?? 9)
  })
}
