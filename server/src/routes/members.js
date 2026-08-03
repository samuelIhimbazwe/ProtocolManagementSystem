import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { loadRulesFromDb, saveRulesToDb } from '../lib/settingsStore.js'

const router = Router()

function mapMember(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role,
    status: row.status,
    attendanceRate: row.attendance_rate,
    choir: row.choir,
  }
}

const READ_ROLES = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'coordinator',
  'member',
])

router.get('/', authMiddleware, (req, res) => {
  if (!READ_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const q = String(req.query.q ?? '').trim().toLowerCase()
  let rows = db.prepare(`SELECT * FROM members ORDER BY name`).all()
  if (q) {
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.phone ?? '').toLowerCase().includes(q),
    )
  }
  return res.json({ members: rows.map(mapMember) })
})

router.get('/export/csv', authMiddleware, (req, res) => {
  if (!['coordinator', 'secretary', 'president', 'vice_president'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const rows = db.prepare(`SELECT * FROM members ORDER BY name`).all()
  const header = 'id,name,phone,role,status,choir,attendance_rate'
  const lines = rows.map((r) =>
    [r.id, r.name, r.phone ?? '', r.role, r.status, r.choir ?? '', r.attendance_rate ?? '']
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  )
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="pmss-members.csv"')
  return res.send([header, ...lines].join('\n'))
})

router.get('/:id', authMiddleware, (req, res) => {
  const row = db.prepare(`SELECT * FROM members WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Member not found' })
  return res.json({ member: mapMember(row) })
})

router.post('/', authMiddleware, (req, res) => {
  if (!['coordinator', 'secretary'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const { name, phone, role, choir, status } = req.body ?? {}
  if (!name || !role) return res.status(400).json({ error: 'name and role required' })

  const maxId = db.prepare(`SELECT MAX(CAST(id AS INTEGER)) AS m FROM members`).get().m ?? 0
  const id = String(maxId + 1)
  db.prepare(
    `INSERT INTO members (id, name, phone, role, status, attendance_rate, choir)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  ).run(id, String(name).trim(), phone ?? null, role, status ?? 'Active', choir ?? null)
  audit('members.create', req.auth.sub, { memberId: id })
  const row = db.prepare(`SELECT * FROM members WHERE id = ?`).get(id)
  return res.status(201).json({ member: mapMember(row) })
})

router.patch('/:id', authMiddleware, (req, res) => {
  if (!['coordinator', 'secretary'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const row = db.prepare(`SELECT * FROM members WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Member not found' })

  const { name, phone, role, choir, status } = req.body ?? {}
  db.prepare(
    `UPDATE members SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      role = COALESCE(?, role),
      choir = COALESCE(?, choir),
      status = COALESCE(?, status),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    name != null ? String(name).trim() : null,
    phone ?? null,
    role ?? null,
    choir ?? null,
    status ?? null,
    req.params.id,
  )
  audit('members.update', req.auth.sub, { memberId: req.params.id })
  const updated = db.prepare(`SELECT * FROM members WHERE id = ?`).get(req.params.id)
  return res.json({ member: mapMember(updated) })
})

export default router
