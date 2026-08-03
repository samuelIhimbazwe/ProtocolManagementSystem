import { db } from '../db.js'
import { DEFAULT_RULE_CONFIGURATION, mergeRules } from './rules.js'

const RULES_KEY = 'rule_configuration'

export async function loadRulesFromDb() {
  const row = await db.prepare(`SELECT value_json FROM app_settings WHERE key = ?`).get(RULES_KEY)
  if (!row?.value_json) return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
  try {
    return mergeRules(JSON.parse(row.value_json))
  } catch {
    return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
  }
}

export async function saveRulesToDb(rules) {
  const payload = JSON.stringify(rules.map(({ id, enabled, parameter }) => ({ id, enabled, parameter })))
  await db.prepare(
    `INSERT INTO app_settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
  ).run(RULES_KEY, payload)
}

export async function ensureDefaultRules() {
  const existing = await db.prepare(`SELECT 1 FROM app_settings WHERE key = ?`).get(RULES_KEY)
  if (!existing) await saveRulesToDb(DEFAULT_RULE_CONFIGURATION)
}

export { RULES_KEY }
