import { USE_API, apiFetch } from './client'

export async function fetchPilotConfig() {
  return apiFetch('/config/pilot', { auth: false })
}

export async function fetchCurrentSchedule() {
  return apiFetch('/schedules/current')
}

export async function saveScheduleDraft(payload) {
  return apiFetch('/schedules/draft', { method: 'PUT', body: { payload } })
}

export async function validateScheduleDraft() {
  return apiFetch('/schedules/validate')
}

export async function fetchScheduleHistory() {
  return apiFetch('/schedules/history')
}

export async function fetchPublishedSchedule() {
  return apiFetch('/schedules/published/latest')
}

export async function fetchMembers(query) {
  const q = query ? `?q=${encodeURIComponent(query)}` : ''
  return apiFetch(`/members${q}`)
}

export async function createMember(body) {
  return apiFetch('/members', { method: 'POST', body })
}

export async function updateMember(id, body) {
  return apiFetch(`/members/${id}`, { method: 'PATCH', body })
}

export async function fetchRules() {
  return apiFetch('/settings/rules')
}

export async function saveRules(rules) {
  return apiFetch('/settings/rules', { method: 'PUT', body: { rules } })
}

export async function inviteUser(body) {
  return apiFetch('/users', { method: 'POST', body })
}

export async function patchUser(id, body) {
  return apiFetch(`/users/${id}`, { method: 'PATCH', body })
}

export async function startAttendanceSession(serviceId) {
  return apiFetch('/attendance/sessions', { method: 'POST', body: { serviceId } })
}

export async function saveAttendanceRecords(sessionId, records) {
  return apiFetch(`/attendance/sessions/${sessionId}/records`, {
    method: 'PUT',
    body: { records },
  })
}

export async function submitAttendanceSession(sessionId) {
  return apiFetch(`/attendance/sessions/${sessionId}/submit`, { method: 'POST' })
}

export async function fetchAttendanceSessions() {
  return apiFetch('/attendance/sessions')
}

export async function fetchMyAttendanceHistory() {
  return apiFetch('/attendance/me/history')
}

export async function fetchDashboardSummary() {
  return apiFetch('/dashboard/summary')
}

export async function fetchDashboardActivity(limit) {
  const q = limit != null ? `?limit=${encodeURIComponent(limit)}` : ''
  return apiFetch(`/dashboard/activity${q}`)
}

export async function fetchReportsAttendance() {
  return apiFetch('/reports/attendance')
}

export async function fetchReportsLeadership() {
  return apiFetch('/reports/leadership')
}

export async function fetchReportsSummary(params = {}) {
  const q = new URLSearchParams()
  if (params.service) q.set('service', params.service)
  if (params.start) q.set('start', params.start)
  if (params.end) q.set('end', params.end)
  const qs = q.toString()
  return apiFetch(`/reports/summary${qs ? `?${qs}` : ''}`)
}

export async function fetchNotifications() {
  return apiFetch('/notifications')
}

export async function markNotificationsRead(ids) {
  return apiFetch('/notifications/mark-read', { method: 'POST', body: { ids } })
}

export async function fetchMember(id) {
  return apiFetch(`/members/${id}`)
}

export { USE_API }
