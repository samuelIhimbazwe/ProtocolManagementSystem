import { Router } from 'express'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

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

router.get('/', authMiddleware, async (req, res) => {
  if (!READ_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const q = String(req.query.q ?? '').trim().toLowerCase()
  let rows = await db.prepare(`SELECT * FROM members ORDER BY name`).all()
  if (q) {
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.phone ?? '').toLowerCase().includes(q),
    )
  }
  return res.json({ members: rows.map(mapMember) })
})

router.get('/export/csv', authMiddleware, async (req, res) => {
  if (!['coordinator', 'secretary', 'president', 'vice_president'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const rows = await db.prepare(`SELECT * FROM members ORDER BY name`).all()
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

router.get('/:id', authMiddleware, async (req, res) => {
  const row = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Member not found' })
  return res.json({ member: mapMember(row) })
})

router.post('/', authMiddleware, async (req, res) => {
  if (!['coordinator', 'secretary'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const { name, phone, role, choir, status } = req.body ?? {}
  if (!name || !role) return res.status(400).json({ error: 'name and role required' })

  const maxId = (await db.prepare(`SELECT MAX(CAST(id AS INTEGER)) AS m FROM members`).get()).m ?? 0
  const id = String(maxId + 1)
  const choirValue =
    choir == null || String(choir).trim() === '' || String(choir).toLowerCase() === 'none'
      ? null
      : String(choir).trim()
  await db.prepare(
    `INSERT INTO members (id, name, phone, role, status, attendance_rate, choir)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  ).run(id, String(name).trim(), phone ?? null, role, status ?? 'Active', choirValue)
  await audit('members.create', req.auth.sub, { memberId: id })
  const row = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(id)
  return res.status(201).json({ member: mapMember(row) })
})

router.patch('/:id', authMiddleware, async (req, res) => {
  if (!['coordinator', 'secretary'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const row = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Member not found' })

  const { name, phone, role, choir, status } = req.body ?? {}
  const body = req.body ?? {}
  const choirProvided = Object.prototype.hasOwnProperty.call(body, 'choir')
  const phoneProvided = Object.prototype.hasOwnProperty.call(body, 'phone')
  const choirValue = !choirProvided
    ? null
    : choir == null || String(choir).trim() === '' || String(choir).toLowerCase() === 'none'
      ? null
      : String(choir).trim()
  const phoneValue = !phoneProvided
    ? null
    : phone == null || String(phone).trim() === ''
      ? null
      : String(phone).trim()

  await db.prepare(
    `UPDATE members SET
      name = COALESCE(?, name),
      phone = CASE WHEN ? = 1 THEN ? ELSE phone END,
      role = COALESCE(?, role),
      choir = CASE WHEN ? = 1 THEN ? ELSE choir END,
      status = COALESCE(?, status),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    name != null ? String(name).trim() : null,
    phoneProvided ? 1 : 0,
    phoneValue,
    role ?? null,
    choirProvided ? 1 : 0,
    choirValue,
    status ?? null,
    req.params.id,
  )
  await audit('members.update', req.auth.sub, { memberId: req.params.id })
  const updated = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(req.params.id)
  return res.json({ member: mapMember(updated) })
})

export default router
