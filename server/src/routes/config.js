import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/pilot', (_req, res) => {
  res.json({
    today: process.env.PMSS_TODAY ?? '2026-08-02',
  })
})

export default router
