import { Router } from 'express'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function mapMember(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? null,
    role: row.role,
    status: row.status,
    attendanceRate: row.attendance_rate,
    choir: row.choir,
  }
}

function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase()
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined
  return email
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
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.phone ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q),
    )
  }
  return res.json({ members: rows.map(mapMember) })
})

const WRITE_ROLES = new Set(['coordinator', 'secretary'])
const EXPORT_ROLES = new Set(['coordinator', 'secretary', 'president', 'vice_president'])
const ALLOWED_ROLES = new Set([
  'Member',
  'President',
  'Vice President',
  'Secretary',
  'Treasurer',
  'Coordinator',
])
const ALLOWED_STATUSES = new Set(['Active', 'Inactive'])

function parseCsv(text) {
  const raw = String(text ?? '').replace(/^\uFEFF/, '').trim()
  if (!raw) return { header: [], rows: [] }
  const lines = []
  let i = 0
  while (i < raw.length) {
    const cells = []
    let cell = ''
    let inQuotes = false
    while (i < raw.length) {
      const ch = raw[i]
      if (inQuotes) {
        if (ch === '"') {
          if (raw[i + 1] === '"') {
            cell += '"'
            i += 2
            continue
          }
          inQuotes = false
          i += 1
          continue
        }
        cell += ch
        i += 1
        continue
      }
      if (ch === '"') {
        inQuotes = true
        i += 1
        continue
      }
      if (ch === ',') {
        cells.push(cell)
        cell = ''
        i += 1
        continue
      }
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && raw[i + 1] === '\n') i += 1
        i += 1
        break
      }
      cell += ch
      i += 1
    }
    cells.push(cell)
    if (cells.some((c) => String(c).trim() !== '')) lines.push(cells)
  }
  if (!lines.length) return { header: [], rows: [] }
  const header = lines[0].map((h) => String(h).trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).map((cells) => {
    const obj = {}
    header.forEach((key, idx) => {
      obj[key] = cells[idx] != null ? String(cells[idx]).trim() : ''
    })
    return obj
  })
  return { header, rows }
}

function normalizeImportRow(raw) {
  const name = String(raw.name ?? raw.full_name ?? raw.member_name ?? '').trim()
  if (!name) return null
  const phoneRaw = String(raw.phone ?? raw.phone_number ?? raw.mobile ?? '').trim()
  const emailNorm = normalizeEmail(raw.email ?? raw.email_address ?? '')
  const roleRaw = String(raw.role ?? 'Member').trim() || 'Member'
  const statusRaw = String(raw.status ?? 'Active').trim() || 'Active'
  const choirRaw = String(raw.choir ?? '').trim()
  const id = String(raw.id ?? '').trim()
  const role =
    [...ALLOWED_ROLES].find((r) => r.toLowerCase() === roleRaw.toLowerCase()) ?? null
  const status =
    [...ALLOWED_STATUSES].find((s) => s.toLowerCase() === statusRaw.toLowerCase()) ?? null
  return {
    id: id || null,
    name,
    phone: phoneRaw || null,
    email: emailNorm === undefined ? '__invalid__' : emailNorm,
    role,
    status,
    choir:
      !choirRaw || choirRaw.toLowerCase() === 'none' ? null : choirRaw,
    roleRaw,
    statusRaw,
  }
}

router.get('/export/csv', authMiddleware, async (req, res) => {
  if (!EXPORT_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const rows = await db.prepare(`SELECT * FROM members ORDER BY name`).all()
  const header = 'id,name,email,phone,role,status,choir,attendance_rate'
  const lines = rows.map((r) =>
    [r.id, r.name, r.email ?? '', r.phone ?? '', r.role, r.status, r.choir ?? '', r.attendance_rate ?? '']
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  )
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="pmss-members.csv"')
  return res.send([header, ...lines].join('\n'))
})

router.get('/import/template', authMiddleware, async (req, res) => {
  if (!WRITE_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const csv = [
    'name,email,phone,role,status,choir',
    '"Jane Doe","jane.doe@example.com","+250 780000000","Member","Active",""',
    '"John Example","john.example@example.com","+250 781111111","Member","Active","Zion Choir"',
  ].join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="pmss-members-import-template.csv"')
  return res.send(csv)
})

/** Import members from CSV text or a members array. Updates by id when present. */
router.post('/import', authMiddleware, async (req, res) => {
  if (!WRITE_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  let incoming = []
  if (Array.isArray(req.body?.members)) {
    incoming = req.body.members
  } else if (typeof req.body?.csv === 'string') {
    incoming = parseCsv(req.body.csv).rows
  } else {
    return res.status(400).json({ error: 'Provide csv text or members array' })
  }

  const existing = await db.prepare(`SELECT * FROM members`).all()
  const byId = new Map(existing.map((m) => [String(m.id), m]))
  const byNamePhone = new Map(
    existing.map((m) => [
      `${String(m.name).trim().toLowerCase()}|${String(m.phone ?? '').trim().toLowerCase()}`,
      m,
    ]),
  )

  let nextId = (await db.prepare(`SELECT MAX(CAST(id AS INTEGER)) AS m FROM members`).get()).m ?? 0
  const result = { created: 0, updated: 0, skipped: 0, errors: [] }
  const imported = []

  for (let idx = 0; idx < incoming.length; idx += 1) {
    const rowNum = idx + 2
    const parsed = normalizeImportRow(incoming[idx] ?? {})
    if (!parsed) {
      result.skipped += 1
      continue
    }
    if (!parsed.role) {
      result.errors.push({ row: rowNum, name: parsed.name, error: `Invalid role: ${parsed.roleRaw}` })
      continue
    }
    if (!parsed.status) {
      result.errors.push({
        row: rowNum,
        name: parsed.name,
        error: `Invalid status: ${parsed.statusRaw}`,
      })
      continue
    }
    if (parsed.email === '__invalid__') {
      result.errors.push({ row: rowNum, name: parsed.name, error: 'Invalid email' })
      continue
    }

    const key = `${parsed.name.toLowerCase()}|${String(parsed.phone ?? '').toLowerCase()}`
    const matchById = parsed.id ? byId.get(String(parsed.id)) : null
    const matchByKey = byNamePhone.get(key)

    try {
      if (matchById) {
        await db
          .prepare(
            `UPDATE members SET
              name = ?, email = ?, phone = ?, role = ?, status = ?, choir = ?, updated_at = datetime('now')
             WHERE id = ?`,
          )
          .run(
            parsed.name,
            parsed.email,
            parsed.phone,
            parsed.role,
            parsed.status,
            parsed.choir,
            matchById.id,
          )
        const updated = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(matchById.id)
        byId.set(String(updated.id), updated)
        byNamePhone.set(
          `${String(updated.name).trim().toLowerCase()}|${String(updated.phone ?? '').trim().toLowerCase()}`,
          updated,
        )
        result.updated += 1
        imported.push(mapMember(updated))
      } else if (matchByKey) {
        result.skipped += 1
        result.errors.push({
          row: rowNum,
          name: parsed.name,
          error: 'Duplicate name+phone (skipped)',
        })
      } else {
        nextId += 1
        const id = String(nextId)
        await db
          .prepare(
            `INSERT INTO members (id, name, email, phone, role, status, attendance_rate, choir)
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
          )
          .run(id, parsed.name, parsed.email, parsed.phone, parsed.role, parsed.status, parsed.choir)
        const created = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(id)
        byId.set(id, created)
        byNamePhone.set(key, created)
        result.created += 1
        imported.push(mapMember(created))
      }
    } catch (err) {
      result.errors.push({ row: rowNum, name: parsed.name, error: err.message ?? 'Import failed' })
    }
  }

  await audit('members.import', req.auth.sub, {
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    errors: result.errors.length,
  })

  return res.json({ ...result, members: imported })
})

router.get('/:id', authMiddleware, async (req, res) => {
  const row = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Member not found' })
  return res.json({ member: mapMember(row) })
})

router.post('/', authMiddleware, async (req, res) => {
  if (!WRITE_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const { name, phone, email, role, choir, status } = req.body ?? {}
  if (!name || !role) return res.status(400).json({ error: 'name and role required' })
  const emailValue = normalizeEmail(email)
  if (emailValue === undefined) return res.status(400).json({ error: 'Invalid email' })

  const maxId = (await db.prepare(`SELECT MAX(CAST(id AS INTEGER)) AS m FROM members`).get()).m ?? 0
  const id = String(maxId + 1)
  const choirValue =
    choir == null || String(choir).trim() === '' || String(choir).toLowerCase() === 'none'
      ? null
      : String(choir).trim()
  await db.prepare(
    `INSERT INTO members (id, name, email, phone, role, status, attendance_rate, choir)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(id, String(name).trim(), emailValue, phone ?? null, role, status ?? 'Active', choirValue)
  await audit('members.create', req.auth.sub, { memberId: id })
  const row = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(id)
  return res.status(201).json({ member: mapMember(row) })
})

router.patch('/:id', authMiddleware, async (req, res) => {
  if (!WRITE_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const row = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Member not found' })

  const { name, phone, email, role, choir, status } = req.body ?? {}
  const body = req.body ?? {}
  const choirProvided = Object.prototype.hasOwnProperty.call(body, 'choir')
  const phoneProvided = Object.prototype.hasOwnProperty.call(body, 'phone')
  const emailProvided = Object.prototype.hasOwnProperty.call(body, 'email')
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
  let emailValue = null
  if (emailProvided) {
    emailValue = normalizeEmail(email)
    if (emailValue === undefined) return res.status(400).json({ error: 'Invalid email' })
  }

  await db.prepare(
    `UPDATE members SET
      name = COALESCE(?, name),
      email = CASE WHEN ? = 1 THEN ? ELSE email END,
      phone = CASE WHEN ? = 1 THEN ? ELSE phone END,
      role = COALESCE(?, role),
      choir = CASE WHEN ? = 1 THEN ? ELSE choir END,
      status = COALESCE(?, status),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    name != null ? String(name).trim() : null,
    emailProvided ? 1 : 0,
    emailValue,
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
