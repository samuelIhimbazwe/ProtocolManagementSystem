import { db } from '../db.js'
import { DEFAULT_RULE_CONFIGURATION, mergeRules } from './rules.js'

const RULES_KEY = 'rule_configuration'

function parseStored(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return mergeRules(parsed, [])
    }
    if (parsed && Array.isArray(parsed.rules)) {
      return mergeRules(parsed.rules, parsed.removedDefaultIds ?? [])
    }
  } catch {
    /* fall through */
  }
  return mergeRules(null, [])
}

export async function loadRulesFromDb() {
  const row = await db.prepare(`SELECT value_json FROM app_settings WHERE key = ?`).get(RULES_KEY)
  if (!row?.value_json) return DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
  return parseStored(row.value_json).rules
}

export async function loadRulesBundleFromDb() {
  const row = await db.prepare(`SELECT value_json FROM app_settings WHERE key = ?`).get(RULES_KEY)
  if (!row?.value_json) {
    return {
      rules: DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r })),
      removedDefaultIds: [],
    }
  }
  return parseStored(row.value_json)
}

export async function saveRulesToDb(rules, removedDefaultIds = []) {
  const list = Array.isArray(rules) ? rules : []
  const removed = Array.isArray(removedDefaultIds) ? removedDefaultIds : []
  const payload = JSON.stringify({
    rules: list.map((r) => ({
      id: r.id,
      enabled: r.enabled !== false,
      parameter: r.parameter ?? '',
      name: r.name,
      category: r.category,
      description: r.description ?? '',
      severity: r.severity,
      custom: !!r.custom,
    })),
    removedDefaultIds: removed,
  })
  await db
    .prepare(
      `INSERT INTO app_settings (key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    )
    .run(RULES_KEY, payload)
  return loadRulesBundleFromDb()
}

export async function ensureDefaultRules() {
  const existing = await db.prepare(`SELECT 1 FROM app_settings WHERE key = ?`).get(RULES_KEY)
  if (!existing) await saveRulesToDb(DEFAULT_RULE_CONFIGURATION, [])
}

export { RULES_KEY }
