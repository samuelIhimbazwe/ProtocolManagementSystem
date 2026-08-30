/** Mirror server/src/lib/scheduleMonths.js — keep choir publish checks in sync. */

export function isChoirPublished(payload) {
  if (!payload) return false
  if (String(payload.choirStatus ?? '').toLowerCase() === 'published') return true
  if (payload.choirPublishedAt && (payload.choirAssignments?.length ?? 0) > 0) return true
  if (payload.choirStatus == null && (payload.choirAssignments?.length ?? 0) > 0) return true
  return false
}
