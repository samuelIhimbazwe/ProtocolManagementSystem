/** Scheduling & validation rules — editable in Settings → Rule configuration */
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

export const RULE_STORAGE_KEY = 'pmss-rule-config'

export function loadRuleConfiguration() {
  try {
    const raw = localStorage.getItem(RULE_STORAGE_KEY)
    if (!raw) return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
    return DEFAULT_RULE_CONFIGURATION.map((def) => {
      const saved = parsed.find((p) => p.id === def.id)
      return saved ? { ...def, ...saved } : { ...def }
    })
  } catch {
    return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
  }
}

export function saveRuleConfiguration(rules) {
  try {
    localStorage.setItem(
      RULE_STORAGE_KEY,
      JSON.stringify(rules.map(({ id, enabled, parameter }) => ({ id, enabled, parameter }))),
    )
  } catch {
    /* ignore */
  }
}
