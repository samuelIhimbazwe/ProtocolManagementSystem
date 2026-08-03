import { API_BASE, AUTH_TOKEN_KEY, USE_API } from './config'

export { USE_API }

function getToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
    else localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  if (!USE_API) {
    throw new Error('API not configured')
  }
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error ?? res.statusText)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

/** Download a file from the API with Bearer auth (e.g. CSV export). */
export async function apiDownload(path, filename) {
  if (!USE_API) throw new Error('API not configured')
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? res.statusText)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function login(username, password) {
  const data = await apiFetch('/auth/login', { method: 'POST', body: { username, password }, auth: false })
  setAuthToken(data.token)
  return data
}

export async function fetchMe() {
  return apiFetch('/auth/me')
}

export async function forgotPassword(username) {
  return apiFetch('/auth/forgot-password', { method: 'POST', body: { username }, auth: false })
}

export async function resetPassword(token, password) {
  return apiFetch('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false })
}

export async function publishSchedule() {
  return apiFetch('/schedules/publish', { method: 'POST' })
}

export async function fetchUserAccounts() {
  return apiFetch('/users')
}
