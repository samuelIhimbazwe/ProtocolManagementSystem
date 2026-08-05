import { MEMBERS } from './mock'
import { ROLES } from './roles'

export const USERS_STORAGE_KEY = 'pmss-user-accounts'

function usernameFromName(name) {
  const parts = name.toLowerCase().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}.${parts[parts.length - 1]}`.replace(/[^a-z.]/g, '')
  }
  return parts[0]?.replace(/[^a-z]/g, '') ?? 'user'
}

function emailFromName(name) {
  const base = usernameFromName(name)
  return `${base}@church.internal`
}

/** Demo TMS login accounts — linked to roster via memberId. */
export function buildDefaultUserAccounts() {
  const leadership = MEMBERS.filter((m) => m.role !== 'Member').map((m, i) => ({
    id: `u-lead-${m.id}`,
    username: usernameFromName(m.name),
    email: emailFromName(m.name),
    memberId: m.id,
    displayName: m.name,
    appRole: ROLES.find((r) => r.label === m.role)?.id ?? 'member',
    status: 'Active',
    lastLogin: ['2026-07-31', '2026-07-30', '2026-08-01', '2026-07-28', '2026-08-02'][i] ?? '2026-07-15',
    invitedAt: null,
  }))

  const protocolSample = MEMBERS.filter((m) => m.role === 'Member').slice(0, 8)
  const protocolUsers = protocolSample.map((m, i) => ({
    id: `u-m-${m.id}`,
    username: usernameFromName(m.name),
    email: emailFromName(m.name),
    memberId: m.id,
    displayName: m.name,
    appRole: 'member',
    status: i === 6 ? 'Invited' : i === 7 ? 'Deactivated' : 'Active',
    lastLogin: i < 6 ? `2026-07-${String(20 + i).padStart(2, '0')}` : null,
    invitedAt: i === 6 ? '2026-07-29' : null,
  }))

  return [...leadership, ...protocolUsers]
}

export function loadUserAccounts() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    /* ignore */
  }
  return buildDefaultUserAccounts()
}

export function saveUserAccounts(accounts) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(accounts))
  } catch {
    /* ignore */
  }
}

export function memberLabel(memberId) {
  const m = MEMBERS.find((x) => x.id === memberId)
  return m?.name ?? 'Unknown member'
}

export function appRoleLabel(appRole) {
  return ROLES.find((r) => r.id === appRole)?.label ?? appRole
}

export function membersWithoutAccount(accounts, roster = MEMBERS) {
  const linked = new Set(accounts.map((a) => a.memberId))
  return roster.filter((m) => !linked.has(m.id))
}

export function suggestUsername(name) {
  return usernameFromName(name)
}
