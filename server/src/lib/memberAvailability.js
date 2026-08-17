/** Duty availability — separate from Active/Inactive roster status. */

export const AVAILABILITY_OPTIONS = [
  { id: 'available', label: 'Available', description: 'Can serve on duty' },
  { id: 'sick', label: 'Sick', description: 'Temporarily unable to serve' },
  { id: 'pregnant', label: 'Pregnant', description: 'Not assigned to duty for now' },
  { id: 'on_leave', label: 'On leave', description: 'Away or on leave' },
  { id: 'family', label: 'Family emergency', description: 'Family situation — cannot serve' },
  { id: 'other', label: 'Unavailable', description: 'Other reason — cannot serve' },
]

export const AVAILABILITY_IDS = AVAILABILITY_OPTIONS.map((o) => o.id)
export const DEFAULT_AVAILABILITY = 'available'

export function normalizeAvailability(value) {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_')
  if (!raw) return DEFAULT_AVAILABILITY
  const aliases = {
    available: 'available',
    ready: 'available',
    sick: 'sick',
    illness: 'sick',
    ill: 'sick',
    pregnant: 'pregnant',
    pregnancy: 'pregnant',
    on_leave: 'on_leave',
    leave: 'on_leave',
    family: 'family',
    family_emergency: 'family',
    other: 'other',
    unavailable: 'other',
  }
  return aliases[raw] ?? (AVAILABILITY_IDS.includes(raw) ? raw : null)
}

export const SERVE_DAYS_OPTIONS = [
  { id: 'all', label: 'All protocol days', description: 'Sunday, Tuesday, and Igaburo' },
  { id: 'tuesday', label: 'Tuesday only', description: 'Assigned to Tuesday services only' },
]

export const DEFAULT_SERVE_DAYS = 'all'

export function normalizeServeDays(value) {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_')
  if (!raw) return DEFAULT_SERVE_DAYS
  const aliases = {
    all: 'all',
    any: 'all',
    every: 'all',
    tuesday: 'tuesday',
    tue: 'tuesday',
    tuesday_only: 'tuesday',
  }
  return aliases[raw] ?? (SERVE_DAYS_OPTIONS.some((o) => o.id === raw) ? raw : null)
}

export function isDutyAvailable(member) {
  if (!member) return false
  if (member.status && member.status !== 'Active') return false
  const avail = member.availability ?? DEFAULT_AVAILABILITY
  return avail === 'available'
}

export function canServeTeamKind(memberOrDays, kind) {
  const days =
    typeof memberOrDays === 'string' || memberOrDays == null
      ? normalizeServeDays(memberOrDays) ?? DEFAULT_SERVE_DAYS
      : normalizeServeDays(memberOrDays.serveDays ?? memberOrDays.serve_days) ?? DEFAULT_SERVE_DAYS
  if (days === 'all') return true
  if (days === 'tuesday') return kind === 'tuesday'
  return true
}

export function serveDaysMapFromMembers(members) {
  const map = {}
  for (const m of members ?? []) {
    if (!m?.name) continue
    map[m.name] = normalizeServeDays(m.serveDays ?? m.serve_days) ?? DEFAULT_SERVE_DAYS
  }
  return map
}
