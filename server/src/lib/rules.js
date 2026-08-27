export const DEFAULT_RULE_CONFIGURATION = [
  {
    id: 'hope-ss1',
    category: 'Choir',
    name: 'Hope Choir on Sunday Service 1',
    description: 'Hope Choir must be assigned to every Sunday Service 1 in the month.',
    severity: 'Error',
    enabled: true,
    parameter: 'Required choir: Hope Choir',
  },
  {
    id: 'no-ss1-ss2-overlap',
    category: 'Choir',
    name: 'No shared choir on SS1 and SS2',
    description:
      'The same choir must not serve Sunday Service 1 and Sunday Service 2 on the same day.',
    severity: 'Error',
    enabled: true,
    parameter: 'Same-day SS1 ∩ SS2: empty',
  },
  {
    id: 'no-beulah-yerusalemu-sunday',
    category: 'Choir',
    name: 'Beulah and Yerusalemu not same Sunday',
    description: 'Beulah Choir and Yerusalemu Choir must never both sing on the same Sunday.',
    severity: 'Error',
    enabled: true,
    parameter: 'Beulah ∩ Yerusalemu on same Sunday: empty',
  },
  { id: 'igaburo-team-size', category: 'Service team', name: 'Igaburo team size', severity: 'Error', enabled: true, parameter: 'Igaburo roster: 10 members' },
  { id: 'sunday-team-size', category: 'Service team', name: 'Sunday team size', severity: 'Error', enabled: true, parameter: 'Sunday roster: 10 members' },
  { id: 'tuesday-team-size', category: 'Service team', name: 'Tuesday team size', severity: 'Error', enabled: true, parameter: 'Tuesday roster: 10 members' },
  { id: 'no-friday-teams', category: 'Service team', name: 'No Friday protocol teams', severity: 'Error', enabled: true, parameter: 'Friday teams: none' },
  {
    id: 'member-availability',
    category: 'Service team',
    name: 'Member duty availability',
    severity: 'Error',
    enabled: true,
    parameter: 'Unavailable members: none on teams',
  },
  {
    id: 'serve-days-match',
    category: 'Service team',
    name: 'Serve days match service type',
    severity: 'Error',
    enabled: true,
    parameter: 'Serve days match service',
  },
  { id: 'min-team-size', category: 'Service team', name: 'Minimum team size', severity: 'Error', enabled: true, parameter: 'Minimum: 4 members' },
  { id: 'max-team-size', category: 'Service team', name: 'Maximum team size', severity: 'Error', enabled: true, parameter: 'Maximum: 10 members' },
  {
    id: 'publish-block-errors',
    category: 'Schedule',
    name: 'Block publish on errors',
    severity: 'Error',
    enabled: true,
    parameter: 'Errors must be 0',
  },
]

const BUILTIN_IDS = new Set(DEFAULT_RULE_CONFIGURATION.map((r) => r.id))

function normalizeRule(s, def) {
  if (def) {
    return {
      ...def,
      ...s,
      id: def.id,
      custom: false,
      enabled: s.enabled !== false,
      severity: s.severity === 'Warning' ? 'Warning' : def.severity,
    }
  }
  return {
    id: s.id,
    category: s.category || 'Schedule',
    name: s.name || s.id,
    description: s.description || '',
    severity: s.severity === 'Error' ? 'Error' : 'Warning',
    enabled: s.enabled !== false,
    parameter: s.parameter || '—',
    custom: true,
  }
}

/**
 * Merge stored rules with engine defaults.
 * - Keeps custom rules
 * - Re-applies new defaults not previously removed
 * - Honors removedDefaultIds so deleted built-ins stay gone until reset
 */
export function mergeRules(stored, removedDefaultIds = []) {
  const removed = new Set(removedDefaultIds)
  if (!Array.isArray(stored)) {
    return {
      rules: DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r })),
      removedDefaultIds: [],
    }
  }

  const byId = new Map(stored.map((r) => [r.id, r]))
  const rules = []

  for (const s of stored) {
    if (!s?.id) continue
    if (BUILTIN_IDS.has(s.id) && removed.has(s.id)) continue
    const def = DEFAULT_RULE_CONFIGURATION.find((d) => d.id === s.id)
    rules.push(normalizeRule(s, def))
  }

  for (const def of DEFAULT_RULE_CONFIGURATION) {
    if (!byId.has(def.id) && !removed.has(def.id)) {
      rules.push({ ...def })
    }
  }

  return { rules, removedDefaultIds: [...removed] }
}

export function isBuiltinRuleId(id) {
  return BUILTIN_IDS.has(id)
}
