import { apiFetch } from './client'

export function fetchOfficeReportCatalog() {
  return apiFetch('/office-reports/catalog')
}

export function fetchOfficeReportBundle(includeMap) {
  const ids = Object.entries(includeMap || {})
    .filter(([, on]) => on)
    .map(([id]) => id)
  const q = ids.length ? `?include=${encodeURIComponent(ids.join(','))}` : ''
  return apiFetch(`/office-reports/bundle${q}`)
}

export function fetchOfficeReports(params = {}) {
  const q = new URLSearchParams()
  if (params.mine) q.set('mine', '1')
  if (params.inbox) q.set('inbox', '1')
  const qs = q.toString()
  return apiFetch(`/office-reports${qs ? `?${qs}` : ''}`)
}

export function fetchOfficeReport(id) {
  return apiFetch(`/office-reports/${id}`)
}

export function createOfficeReport(body) {
  return apiFetch('/office-reports', { method: 'POST', body })
}

export function updateOfficeReport(id, body) {
  return apiFetch(`/office-reports/${id}`, { method: 'PUT', body })
}

export function submitOfficeReport(id, body) {
  return apiFetch(`/office-reports/${id}/submit`, { method: 'POST', body })
}
