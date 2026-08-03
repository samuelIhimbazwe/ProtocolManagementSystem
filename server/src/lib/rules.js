export const DEFAULT_RULE_CONFIGURATION = [
  { id: 'hope-ss1', category: 'Choir', name: 'Hope Choir on Sunday Service 1', severity: 'Error', enabled: true },
  { id: 'igaburo-team-size', category: 'Service team', name: 'Igaburo team size', severity: 'Error', enabled: true },
  { id: 'sunday-team-size', category: 'Service team', name: 'Sunday team size', severity: 'Error', enabled: true },
  { id: 'min-team-size', category: 'Service team', name: 'Minimum team size', severity: 'Error', enabled: true },
  { id: 'max-team-size', category: 'Service team', name: 'Maximum team size', severity: 'Error', enabled: true },
  { id: 'publish-block-errors', category: 'Schedule', name: 'Block publish on errors', severity: 'Error', enabled: true },
]

export function mergeRules(stored) {
  if (!Array.isArray(stored)) return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
  return DEFAULT_RULE_CONFIGURATION.map((def) => {
    const saved = stored.find((p) => p.id === def.id)
    return saved ? { ...def, ...saved } : { ...def }
  })
}
