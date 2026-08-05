import { apiFetch } from './client'
import { API_BASE, AUTH_TOKEN_KEY } from './config'

function authHeaders() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

export function fetchFinanceSummary() {
  return apiFetch('/finance/summary')
}

export function fetchPaymentMethods() {
  return apiFetch('/finance/methods')
}

export function createPaymentMethod(body) {
  return apiFetch('/finance/methods', { method: 'POST', body })
}

export function updatePaymentMethod(id, body) {
  return apiFetch(`/finance/methods/${id}`, { method: 'PUT', body })
}

export function deactivatePaymentMethod(id) {
  return apiFetch(`/finance/methods/${id}`, { method: 'DELETE' })
}

export function fetchContributionTypes() {
  return apiFetch('/finance/types')
}

export function createContributionType(body) {
  return apiFetch('/finance/types', { method: 'POST', body })
}

export function updateContributionType(id, body) {
  return apiFetch(`/finance/types/${id}`, { method: 'PUT', body })
}

export function closeContributionType(id) {
  return apiFetch(`/finance/types/${id}`, { method: 'DELETE' })
}

export function fetchSubmissions(params = {}) {
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  if (params.typeId) q.set('typeId', params.typeId)
  if (params.memberId) q.set('memberId', params.memberId)
  const qs = q.toString()
  return apiFetch(`/finance/submissions${qs ? `?${qs}` : ''}`)
}

export function createSubmission(body) {
  return apiFetch('/finance/submissions', { method: 'POST', body })
}

/** Fetch attached evidence as a blob URL for in-app viewing. Caller must revoke the URL. */
export async function fetchSubmissionEvidenceBlob(submissionId) {
  const res = await fetch(`${API_BASE}/finance/submissions/${submissionId}/evidence`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Could not open evidence')
  }
  const blob = await res.blob()
  const mime = res.headers.get('Content-Type') || blob.type || 'application/octet-stream'
  return { blob, mime, url: URL.createObjectURL(blob) }
}

/** Open attached evidence (image/PDF/doc) in a new tab. Prefer in-app viewer when possible. */
export async function openSubmissionEvidence(submissionId) {
  const { url } = await fetchSubmissionEvidenceBlob(submissionId)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    URL.revokeObjectURL(url)
    throw new Error('Pop-up blocked — open View evidence instead')
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function verifySubmission(id, body) {
  return apiFetch(`/finance/submissions/${id}/verify`, { method: 'POST', body })
}

export function fetchFollowups() {
  return apiFetch('/finance/followups')
}

export function fetchFollowup(id) {
  return apiFetch(`/finance/followups/${id}`)
}

export function updateFollowup(id, body) {
  return apiFetch(`/finance/followups/${id}`, { method: 'PATCH', body })
}

export function fetchFinanceReports() {
  return apiFetch('/finance/reports')
}
