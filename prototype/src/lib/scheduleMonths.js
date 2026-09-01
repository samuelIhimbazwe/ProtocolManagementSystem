/** Mirror server/src/lib/scheduleMonths.js — keep choir publish checks in sync. */

/** @param {string} monthKey YYYY-MM */
export function previousMonthKey(monthKey) {
  const [y, m] = String(monthKey ?? '').split('-').map(Number)
  if (!y || !m) return null
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
  return `${prev.y}-${String(prev.m).padStart(2, '0')}`
}

export function isChoirPublished(payload) {
  if (!payload) return false
  if (String(payload.choirStatus ?? '').toLowerCase() === 'published') return true
  if (payload.choirPublishedAt && (payload.choirAssignments?.length ?? 0) > 0) return true
  if (payload.choirStatus == null && (payload.choirAssignments?.length ?? 0) > 0) return true
  return false
}
