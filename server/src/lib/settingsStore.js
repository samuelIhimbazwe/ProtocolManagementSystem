import { db } from '../db.js'
import { DEFAULT_RULE_CONFIGURATION, mergeRules } from './rules.js'

const RULES_KEY = 'rule_configuration'

export function loadRulesFromDb() {
  const row = db.prepare(`SELECT value_json FROM app_settings WHERE key = ?`).get(RULES_KEY)
  if (!row?.value_json) return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
  try {
    return mergeRules(JSON.parse(row.value_json))
  } catch {
    return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
  }
}

export function saveRulesToDb(rules) {
  const payload = JSON.stringify(rules.map(({ id, enabled, parameter }) => ({ id, enabled, parameter })))
  db.prepare(
    `INSERT INTO app_settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
  ).run(RULES_KEY, payload)
}

export function ensureDefaultRules() {
  const existing = db.prepare(`SELECT 1 FROM app_settings WHERE key = ?`).get(RULES_KEY)
  if (!existing) saveRulesToDb(DEFAULT_RULE_CONFIGURATION)
}

export { RULES_KEY }
