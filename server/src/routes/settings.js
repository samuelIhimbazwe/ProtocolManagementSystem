import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { loadRulesBundleFromDb, saveRulesToDb } from '../lib/settingsStore.js'
import { DEFAULT_RULE_CONFIGURATION } from '../lib/rules.js'

const router = Router()

const RULE_EDITOR_ROLES = new Set(['coordinator', 'choir_scheduler'])
const CHOIR_BUILTIN_IDS = new Set(
  DEFAULT_RULE_CONFIGURATION.filter((r) => r.category === 'Choir').map((r) => r.id),
)

function isChoirRule(rule) {
  return String(rule?.category ?? '') === 'Choir' || CHOIR_BUILTIN_IDS.has(rule?.id)
}

router.get('/rules', authMiddleware, async (req, res) => {
  const bundle = await loadRulesBundleFromDb()
  return res.json(bundle)
})

router.put('/rules', authMiddleware, async (req, res) => {
  if (!RULE_EDITOR_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Not allowed to update rules' })
  }
  const { rules, removedDefaultIds } = req.body ?? {}
  if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules array required' })

  if (req.auth.role === 'choir_scheduler') {
    if (rules.some((r) => r && !isChoirRule(r))) {
      return res.status(400).json({ error: 'Choir scheduler can only manage Choir rules' })
    }

    const existing = await loadRulesBundleFromDb()
    const nonChoirRules = (existing.rules ?? []).filter((r) => !isChoirRule(r))
    const choirRules = rules.filter(isChoirRule)

    const nonChoirRemoved = (existing.removedDefaultIds ?? []).filter((id) => !CHOIR_BUILTIN_IDS.has(id))
    const choirRemoved = (removedDefaultIds ?? []).filter((id) => CHOIR_BUILTIN_IDS.has(id))

    const bundle = await saveRulesToDb([...nonChoirRules, ...choirRules], [
      ...new Set([...nonChoirRemoved, ...choirRemoved]),
    ])
    return res.json(bundle)
  }

  const bundle = await saveRulesToDb(rules, removedDefaultIds ?? [])
  return res.json(bundle)
})

export default router
