import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { loadRulesFromDb, saveRulesToDb } from '../lib/settingsStore.js'

const router = Router()

router.get('/rules', authMiddleware, (req, res) => {
  return res.json({ rules: loadRulesFromDb() })
})

router.put('/rules', authMiddleware, (req, res) => {
  if (req.auth.role !== 'coordinator') {
    return res.status(403).json({ error: 'Only coordinator can update rules' })
  }
  const { rules } = req.body ?? {}
  if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules array required' })
  saveRulesToDb(rules)
  return res.json({ rules: loadRulesFromDb() })
})

export default router
