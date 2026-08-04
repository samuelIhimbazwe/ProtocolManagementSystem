import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendInviteEmail } from '../lib/mail.js'

const router = Router()

const VIEW_ROLES = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'coordinator',
])

const MANAGE_ROLES = new Set(['coordinator', 'secretary'])

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    memberId: row.member_id,
    displayName: row.display_name,
    appRole: row.app_role,
    status: row.status,
  }
}

function usernameFromName(name) {
  const parts = name.toLowerCase().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}.${parts[parts.length - 1]}`.replace(/[^a-z.]/g, '')
  return parts[0]?.replace(/[^a-z]/g, '') ?? 'user'
}

router.get('/', authMiddleware, async (req, res) => {
  if (!VIEW_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const rows = await db
    .prepare(
      `SELECT id, username, email, member_id, display_name, app_role, status, last_login_at, invited_at
       FROM users ORDER BY display_name`,
    )
    .all()

  return res.json({
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      memberId: r.member_id,
      displayName: r.display_name,
      appRole: r.app_role,
      status: r.status,
      lastLogin: r.last_login_at,
      invitedAt: r.invited_at,
    })),
  })
})

router.post('/', authMiddleware, async (req, res) => {
  if (!MANAGE_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { memberId, appRole, username, email, displayName, password, mode } = req.body ?? {}
  if (!memberId || !appRole) {
    return res.status(400).json({ error: 'memberId and appRole required' })
  }

  const createActive = mode === 'create'
  if (createActive) {
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
  } else {
    const inviteEmail = String(email ?? '').trim()
    if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      return res.status(400).json({ error: 'A valid invite email is required' })
    }
  }

  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(String(memberId))
  if (!member) return res.status(404).json({ error: 'Member not found' })

  const existing = await db.prepare(`SELECT id FROM users WHERE member_id = ?`).get(String(memberId))
  if (existing) return res.status(400).json({ error: 'Member already has an account' })

  const un = username?.trim() || usernameFromName(member.name)
  const em = String(email ?? '').trim() || (createActive ? `${un}@church.internal` : '')
  if (!em) {
    return res.status(400).json({ error: 'A valid invite email is required' })
  }
  const name = displayName?.trim() || member.name

  const dup = await db.prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`).get(un)
  if (dup) return res.status(400).json({ error: 'Username already taken' })

  const tempPassword = createActive ? null : `Invite-${uuid().slice(0, 8)}!`
  const plainPassword = createActive ? String(password) : tempPassword
  const hash = await bcrypt.hash(plainPassword, 10)
  const id = uuid()
  const status = createActive ? 'Active' : 'Invited'

  await db
    .prepare(
      createActive
        ? `INSERT INTO users (id, username, email, password_hash, member_id, display_name, app_role, status, invited_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
        : `INSERT INTO users (id, username, email, password_hash, member_id, display_name, app_role, status, invited_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(id, un, em, hash, String(memberId), name, appRole, status)

  let inviteMail = null
  if (!createActive) {
    inviteMail = await sendInviteEmail({
      to: em,
      displayName: name,
      username: un,
      tempPassword,
    })
  }

  await audit(createActive ? 'users.create' : 'users.invite', req.auth.sub, {
    userId: id,
    memberId,
    email: em,
  })

  const row = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(id)
  const body = { user: publicUser(row), inviteEmail: em }
  if (!createActive) {
    body.inviteQueued = Boolean(inviteMail?.queued)
    if (process.env.NODE_ENV !== 'production') {
      body.demoTempPassword = tempPassword
    }
  }
  return res.status(201).json(body)
})

router.patch('/:id', authMiddleware, async (req, res) => {
  if (!MANAGE_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const row = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'User not found' })

  const { status, appRole } = req.body ?? {}
  if (status != null) {
    await db.prepare(`UPDATE users SET status = ? WHERE id = ?`).run(status, req.params.id)
    await audit('users.status', req.auth.sub, { userId: req.params.id, status })
  }
  if (appRole != null) {
    await db.prepare(`UPDATE users SET app_role = ? WHERE id = ?`).run(appRole, req.params.id)
    await audit('users.role', req.auth.sub, { userId: req.params.id, appRole })
  }

  const updated = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id)
  return res.json({ user: publicUser(updated) })
})

export default router
