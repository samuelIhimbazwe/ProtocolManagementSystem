/** Scheduling & validation rules — editable in Validation tab and Settings */

export const RULE_CATEGORIES = ['Choir', 'Service team', 'Leadership', 'Attendance', 'Schedule']

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
      'The same choir must not serve Sunday Service 1 and Sunday Service 2 on the same day. Auto-generation never breaks this; manual edits may, but publish is blocked until fixed.',
    severity: 'Error',
    enabled: true,
    parameter: 'Same-day SS1 ∩ SS2: empty',
  },
  {
    id: 'no-beulah-yerusalemu-sunday',
    category: 'Choir',
    name: 'Beulah and Yerusalemu not same Sunday',
    description:
      'Beulah Choir and Yerusalemu Choir must never both sing on the same Sunday (across Service 1 and 2). Auto-generation never breaks this.',
    severity: 'Error',
    enabled: true,
    parameter: 'Beulah ∩ Yerusalemu on same Sunday: empty',
  },
  {
    id: 'choir-rotation',
    category: 'Choir',
    name: 'Choir rotation window',
    description: 'Discourage the same choir serving twice within the rotation window.',
    severity: 'Warning',
    enabled: true,
    parameter: 'Window: 7 days',
  },
  {
    id: 'secondary-balance',
    category: 'Choir',
    name: 'Secondary choir balance',
    description: 'Secondary choirs should appear at least once per month when enabled.',
    severity: 'Warning',
    enabled: true,
    parameter: 'Min uses / month: 1',
  },
  {
    id: 'igaburo-team-size',
    category: 'Service team',
    name: 'Igaburo team size',
    description: 'Igaburo Service must have exactly 10 protocol members (TL and VTL included).',
    severity: 'Error',
    enabled: true,
    parameter: 'Igaburo roster: 10 members',
  },
  {
    id: 'sunday-team-size',
    category: 'Service team',
    name: 'Sunday team size',
    description: 'Every Sunday Service 1 and 2 in the month must have exactly 10 protocol members (TL and VTL included).',
    severity: 'Error',
    enabled: true,
    parameter: 'Sunday roster: 10 members',
  },
  {
    id: 'tuesday-team-size',
    category: 'Service team',
    name: 'Tuesday team size',
    description: 'Every Tuesday Service in the month must have exactly 10 protocol members (TL and VTL included).',
    severity: 'Error',
    enabled: true,
    parameter: 'Tuesday roster: 10 members',
  },
  {
    id: 'no-friday-teams',
    category: 'Service team',
    name: 'No Friday protocol teams',
    description: 'Protocol does not serve on Friday — Friday services must not have service teams.',
    severity: 'Error',
    enabled: true,
    parameter: 'Friday teams: none',
  },
  {
    id: 'member-availability',
    category: 'Service team',
    name: 'Member duty availability',
    description: 'Sick, pregnant, on leave, or otherwise unavailable members must not appear on protocol teams.',
    severity: 'Error',
    enabled: true,
    parameter: 'Unavailable members: none on teams',
  },
  {
    id: 'serve-days-match',
    category: 'Service team',
    name: 'Serve days match service type',
    description: 'Tuesday-only members appear on Tuesday teams only; other serve-day constraints must hold.',
    severity: 'Error',
    enabled: true,
    parameter: 'Serve days match service',
  },
  {
    id: 'min-team-size',
    category: 'Service team',
    name: 'Minimum team size',
    description: 'Each service must meet the minimum protocol team count.',
    severity: 'Error',
    enabled: true,
    parameter: 'Minimum: 4 members',
  },
  {
    id: 'max-team-size',
    category: 'Service team',
    name: 'Maximum team size',
    description: 'Teams cannot exceed the configured maximum.',
    severity: 'Error',
    enabled: true,
    parameter: 'Maximum: 10 members',
  },
  {
    id: 'max-services-month',
    category: 'Service team',
    name: 'Monthly assignment cap',
    description: 'Limit how many services a member can be assigned per month.',
    severity: 'Warning',
    enabled: true,
    parameter: 'Max: 4 services / member',
  },
  {
    id: 'assignment-rest',
    category: 'Service team',
    name: 'Rest between assignments',
    description: 'Prefer at least one service gap between consecutive assignments.',
    severity: 'Warning',
    enabled: true,
    parameter: 'Rest: 1 service',
  },
  {
    id: 'tl-cooldown',
    category: 'Leadership',
    name: 'Team leader cooldown',
    description: 'Member cannot be team leader again until cooldown passes.',
    severity: 'Warning',
    enabled: true,
    parameter: 'Cooldown: 2 services',
  },
  {
    id: 'vtl-rotation',
    category: 'Leadership',
    name: 'Vice leader rotation',
    description: 'Rotate vice team leader recommendations using attendance and tenure weights.',
    severity: 'Warning',
    enabled: true,
    parameter: 'Weights: Attendance + tenure',
  },
  {
    id: 'attendance-min-rate',
    category: 'Attendance',
    name: 'Minimum attendance for assignment',
    description: 'Members below rate may be deprioritized for scheduling.',
    severity: 'Warning',
    enabled: false,
    parameter: 'Threshold: 70%',
  },
  {
    id: 'publish-block-errors',
    category: 'Schedule',
    name: 'Block publish on errors',
    description: 'Prevent publishing while validation errors remain.',
    severity: 'Error',
    enabled: true,
    parameter: 'Errors must be 0',
  },
]

export const BUILTIN_RULE_IDS = new Set(DEFAULT_RULE_CONFIGURATION.map((r) => r.id))

export function isBuiltinRuleId(id) {
  return BUILTIN_RULE_IDS.has(id)
}

export function createCustomRule({ name, category, description, severity, parameter, enabled }) {
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return {
    id: `custom-${slug || 'rule'}-${Date.now().toString(36)}`,
    category: category || 'Schedule',
    name,
    description: description || '',
    severity: severity === 'Error' ? 'Error' : 'Warning',
    enabled: enabled !== false,
    parameter: parameter || '—',
    custom: true,
  }
}

export const RULE_STORAGE_KEY = 'pmss-rule-config'

export function loadRuleConfiguration() {
  try {
    const raw = localStorage.getItem(RULE_STORAGE_KEY)
    if (!raw) return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : parsed?.rules
    const removedDefaultIds = Array.isArray(parsed?.removedDefaultIds) ? parsed.removedDefaultIds : []
    if (!Array.isArray(list)) return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
    return mergeClientRules(list, removedDefaultIds)
  } catch {
    return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
  }
}

export function mergeClientRules(stored, removedDefaultIds = []) {
  const removed = new Set(removedDefaultIds)
  const byId = new Map((stored ?? []).map((r) => [r.id, r]))
  const merged = []
  for (const s of stored ?? []) {
    const def = DEFAULT_RULE_CONFIGURATION.find((d) => d.id === s.id)
    if (def) {
      if (removed.has(s.id)) continue
      merged.push({ ...def, ...s, custom: false })
    } else {
      merged.push({
        id: s.id,
        category: s.category || 'Schedule',
        name: s.name || s.id,
        description: s.description || '',
        severity: s.severity === 'Error' ? 'Error' : 'Warning',
        enabled: s.enabled !== false,
        parameter: s.parameter || '—',
        custom: true,
      })
    }
  }
  for (const def of DEFAULT_RULE_CONFIGURATION) {
    if (!byId.has(def.id) && !removed.has(def.id)) merged.push({ ...def })
  }
  return merged
}

export function saveRuleConfiguration(rules, removedDefaultIds = []) {
  try {
    localStorage.setItem(
      RULE_STORAGE_KEY,
      JSON.stringify({
        rules: rules.map((r) => ({
          id: r.id,
          enabled: r.enabled,
          parameter: r.parameter,
          name: r.name,
          category: r.category,
          description: r.description,
          severity: r.severity,
          custom: !!r.custom,
        })),
        removedDefaultIds,
      }),
    )
  } catch {
    /* ignore */
  }
}
