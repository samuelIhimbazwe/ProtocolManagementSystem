import { apiFetch } from './client'

export function fetchMyServiceReports() {
  return apiFetch('/service-reports?mine=1')
}

export function fetchSubmittedServiceReports() {
  return apiFetch('/service-reports?status=submitted')
}

export function fetchServiceReportForService(serviceId) {
  return apiFetch(`/service-reports/by-service/${serviceId}`)
}

export function createServiceReport(body) {
  return apiFetch('/service-reports', { method: 'POST', body })
}

export function updateServiceReport(id, body) {
  return apiFetch(`/service-reports/${id}`, { method: 'PUT', body })
}

export function submitServiceReport(id, body) {
  return apiFetch(`/service-reports/${id}/submit`, { method: 'POST', body })
}
