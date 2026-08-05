import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware, signToken } from '../middleware/auth.js'
import { getDraftPayload, getPublishedPayload } from '../lib/scheduleAccess.js'
import { resolveOfficeAccess } from '../lib/officeAccess.js'

const router = Router()

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    memberId: row.member_id,
    displayName: row.display_name,
    appRole: row.app_role,
    status: row.status,
    mustChangePassword: Boolean(row.must_change_password),
  }
}

router.post('/login', async (req, res) => {
  const identifier = String(req.body?.email ?? req.body?.username ?? '').trim()
  const { password } = req.body ?? {}
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  let user = await db
    .prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`)
    .get(identifier)
  if (!user) {
    user = await db
      .prepare(`SELECT * FROM users WHERE username = ? COLLATE NOCASE`)
      .get(identifier)
  }

  if (!user || user.status === 'Deactivated') {
    return res.status(401).json({ error: 'Invalid credentials or account inactive' })
  }

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials or account inactive' })
  }

  if (user.status === 'Invited') {
    await db.prepare(`UPDATE users SET status = 'Active' WHERE id = ?`).run(user.id)
    user.status = 'Active'
  }

  await db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(user.id)
  await audit('auth.login', user.id, { username: user.username })

  const token = signToken(user)
  const today = process.env.PMSS_TODAY ?? '2026-08-02'
  const payload = (await getPublishedPayload()) ?? (await getDraftPayload())
  const officeAccess =
    user.app_role === 'member'
      ? resolveOfficeAccess({
          roleId: 'member',
          memberName: user.display_name,
          teamAssignments: payload?.teamAssignments ?? [],
          today,
        })
      : resolveOfficeAccess({ roleId: user.app_role, memberName: null, teamAssignments: [], today })

  return res.json({ token, user: publicUser(user), pilotToday: today, officeAccess })
})

router.get('/me', authMiddleware, async (req, res) => {
  const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.auth.sub)
  if (!user || user.status === 'Deactivated') {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const today = process.env.PMSS_TODAY ?? '2026-08-02'
  const payload = (await getPublishedPayload()) ?? (await getDraftPayload())
  const officeAccess =
    user.app_role === 'member'
      ? resolveOfficeAccess({
          roleId: 'member',
          memberName: user.display_name,
          teamAssignments: payload?.teamAssignments ?? [],
          today,
        })
      : resolveOfficeAccess({ roleId: user.app_role, memberName: null, teamAssignments: [], today })

  return res.json({ user: publicUser(user), pilotToday: today, officeAccess })
})

router.post('/forgot-password', async (req, res) => {
  const identifier = String(req.body?.email ?? req.body?.username ?? '').trim()
  if (!identifier) {
    return res.status(400).json({ error: 'Email required' })
  }

  let user = await db
    .prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`)
    .get(identifier)
  if (!user) {
    user = await db
      .prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`)
      .get(identifier)
  }

  if (user) {
    const token = `reset-${uuid()}`
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    await db.prepare(`INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`).run(
      token,
      user.id,
      expires,
    )
    await audit('auth.forgot_password', user.id, {})
    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        message: 'If an account exists, reset instructions were sent.',
        demoResetToken: token,
        demoResetUrl: `/reset-password?token=${encodeURIComponent(token)}`,
      })
    }
  }

  return res.json({ message: 'If an account exists, reset instructions were sent.' })
})

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body ?? {}
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password required' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const row = await db
    .prepare(
      `SELECT t.*, u.id AS uid FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token = ? AND t.used_at IS NULL`,
    )
    .get(token)

  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired reset link' })
  }
  if (new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired reset link' })
  }

  const hash = await bcrypt.hash(password, 10)
  await db
    .prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`)
    .run(hash, row.uid)
  await db.prepare(`UPDATE password_reset_tokens SET used_at = datetime('now') WHERE token = ?`).run(token)
  await audit('auth.reset_password', row.uid, {})

  return res.json({ message: 'Password updated' })
})

router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {}
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password required' })
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' })
  }
  if (String(currentPassword) === String(newPassword)) {
    return res.status(400).json({ error: 'New password must be different from the current password' })
  }

  const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.auth.sub)
  if (!user || user.status === 'Deactivated') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const ok = await bcrypt.compare(String(currentPassword), user.password_hash)
  if (!ok) {
    return res.status(400).json({ error: 'Current password is incorrect' })
  }

  const hash = await bcrypt.hash(String(newPassword), 10)
  await db
    .prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`)
    .run(hash, user.id)
  await audit('auth.change_password', user.id, {})

  return res.json({ message: 'Password updated', user: publicUser({ ...user, must_change_password: 0, password_hash: hash }) })
})

export default router
