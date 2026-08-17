import { Router } from 'express'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  DEFAULT_AVAILABILITY,
  DEFAULT_SERVE_DAYS,
  normalizeAvailability,
  normalizeServeDays,
} from '../lib/memberAvailability.js'

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
    availability: row.availability ?? DEFAULT_AVAILABILITY,
    availabilityNote: row.availability_note ?? '',
    availabilityUpdatedAt: row.availability_updated_at ?? null,
    serveDays: row.serve_days ?? DEFAULT_SERVE_DAYS,
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
  const availabilityRaw = String(raw.availability ?? raw.duty_availability ?? DEFAULT_AVAILABILITY).trim()
  const availabilityNote = String(raw.availability_note ?? raw.note ?? '').trim()
  const serveDaysRaw = String(raw.serve_days ?? raw.serveDays ?? DEFAULT_SERVE_DAYS).trim()
  const id = String(raw.id ?? '').trim()
  const role =
    [...ALLOWED_ROLES].find((r) => r.toLowerCase() === roleRaw.toLowerCase()) ?? null
  const status =
    [...ALLOWED_STATUSES].find((s) => s.toLowerCase() === statusRaw.toLowerCase()) ?? null
  const availability = normalizeAvailability(availabilityRaw)
  const serveDays = normalizeServeDays(serveDaysRaw)
  return {
    id: id || null,
    name,
    phone: phoneRaw || null,
    email: emailNorm === undefined ? '__invalid__' : emailNorm,
    role,
    status,
    choir:
      !choirRaw || choirRaw.toLowerCase() === 'none' ? null : choirRaw,
    availability,
    availabilityNote: availabilityNote || null,
    serveDays,
    roleRaw,
    statusRaw,
    availabilityRaw,
    serveDaysRaw,
  }
}

router.get('/export/csv', authMiddleware, async (req, res) => {
  if (!EXPORT_ROLES.has(req.auth.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const rows = await db.prepare(`SELECT * FROM members ORDER BY name`).all()
  const header = 'id,name,email,phone,role,status,choir,attendance_rate,availability,availability_note,serve_days'
  const lines = rows.map((r) =>
    [r.id, r.name, r.email ?? '', r.phone ?? '', r.role, r.status, r.choir ?? '', r.attendance_rate ?? '', r.availability ?? 'available', r.availability_note ?? '', r.serve_days ?? 'all']
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
    'name,email,phone,role,status,choir,availability,availability_note,serve_days',
    '"Jane Doe","jane.doe@example.com","+250 780000000","Member","Active","","available","","all"',
    '"John Example","john.example@example.com","+250 781111111","Member","Active","Zion Choir","sick","Flu","tuesday"',
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
    if (!parsed.availability) {
      result.errors.push({
        row: rowNum,
        name: parsed.name,
        error: `Invalid availability: ${parsed.availabilityRaw}`,
      })
      continue
    }
    if (!parsed.serveDays) {
      result.errors.push({
        row: rowNum,
        name: parsed.name,
        error: `Invalid serve days: ${parsed.serveDaysRaw}`,
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
              name = ?, email = ?, phone = ?, role = ?, status = ?, choir = ?,
              availability = ?, availability_note = ?, availability_updated_at = datetime('now'),
              serve_days = ?,
              updated_at = datetime('now')
             WHERE id = ?`,
          )
          .run(
            parsed.name,
            parsed.email,
            parsed.phone,
            parsed.role,
            parsed.status,
            parsed.choir,
            parsed.availability,
            parsed.availabilityNote,
            parsed.serveDays,
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
            `INSERT INTO members (id, name, email, phone, role, status, attendance_rate, choir, availability, availability_note, availability_updated_at, serve_days)
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, datetime('now'), ?)`,
          )
          .run(
            id,
            parsed.name,
            parsed.email,
            parsed.phone,
            parsed.role,
            parsed.status,
            parsed.choir,
            parsed.availability,
            parsed.availabilityNote,
            parsed.serveDays,
          )
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
  const { name, phone, email, role, choir, status, availability, availabilityNote, serveDays } = req.body ?? {}
  if (!name || !role) return res.status(400).json({ error: 'name and role required' })
  const emailValue = normalizeEmail(email)
  if (emailValue === undefined) return res.status(400).json({ error: 'Invalid email' })
  const availabilityValue = availability ? normalizeAvailability(availability) : DEFAULT_AVAILABILITY
  if (!availabilityValue) return res.status(400).json({ error: 'Invalid availability' })
  const serveDaysValue = serveDays ? normalizeServeDays(serveDays) : DEFAULT_SERVE_DAYS
  if (!serveDaysValue) return res.status(400).json({ error: 'Invalid serve days' })

  const maxId = (await db.prepare(`SELECT MAX(CAST(id AS INTEGER)) AS m FROM members`).get()).m ?? 0
  const id = String(maxId + 1)
  const choirValue =
    choir == null || String(choir).trim() === '' || String(choir).toLowerCase() === 'none'
      ? null
      : String(choir).trim()
  const noteValue = availabilityNote == null || String(availabilityNote).trim() === ''
    ? null
    : String(availabilityNote).trim()
  await db.prepare(
    `INSERT INTO members (id, name, email, phone, role, status, attendance_rate, choir, availability, availability_note, availability_updated_at, serve_days)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, datetime('now'), ?)`,
  ).run(
    id,
    String(name).trim(),
    emailValue,
    phone ?? null,
    role,
    status ?? 'Active',
    choirValue,
    availabilityValue,
    noteValue,
    serveDaysValue,
  )
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

  const { name, phone, email, role, choir, status, availability, availabilityNote, serveDays } = req.body ?? {}
  const body = req.body ?? {}
  const choirProvided = Object.prototype.hasOwnProperty.call(body, 'choir')
  const phoneProvided = Object.prototype.hasOwnProperty.call(body, 'phone')
  const emailProvided = Object.prototype.hasOwnProperty.call(body, 'email')
  const availabilityProvided = Object.prototype.hasOwnProperty.call(body, 'availability')
  const noteProvided = Object.prototype.hasOwnProperty.call(body, 'availabilityNote')
  const serveDaysProvided = Object.prototype.hasOwnProperty.call(body, 'serveDays')
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
  let availabilityValue = null
  if (availabilityProvided) {
    availabilityValue = normalizeAvailability(availability)
    if (!availabilityValue) return res.status(400).json({ error: 'Invalid availability' })
  }
  let serveDaysValue = null
  if (serveDaysProvided) {
    serveDaysValue = normalizeServeDays(serveDays)
    if (!serveDaysValue) return res.status(400).json({ error: 'Invalid serve days' })
  }
  const noteValue = !noteProvided
    ? null
    : availabilityNote == null || String(availabilityNote).trim() === ''
      ? null
      : String(availabilityNote).trim()

  await db.prepare(
    `UPDATE members SET
      name = COALESCE(?, name),
      email = CASE WHEN ? = 1 THEN ? ELSE email END,
      phone = CASE WHEN ? = 1 THEN ? ELSE phone END,
      role = COALESCE(?, role),
      choir = CASE WHEN ? = 1 THEN ? ELSE choir END,
      status = COALESCE(?, status),
      availability = CASE WHEN ? = 1 THEN ? ELSE availability END,
      availability_note = CASE WHEN ? = 1 THEN ? ELSE availability_note END,
      availability_updated_at = CASE WHEN ? = 1 OR ? = 1 THEN datetime('now') ELSE availability_updated_at END,
      serve_days = CASE WHEN ? = 1 THEN ? ELSE serve_days END,
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
    availabilityProvided ? 1 : 0,
    availabilityValue,
    noteProvided ? 1 : 0,
    noteValue,
    availabilityProvided ? 1 : 0,
    noteProvided ? 1 : 0,
    serveDaysProvided ? 1 : 0,
    serveDaysValue,
    req.params.id,
  )
  await audit('members.update', req.auth.sub, { memberId: req.params.id })
  const updated = await db.prepare(`SELECT * FROM members WHERE id = ?`).get(req.params.id)
  return res.json({ member: mapMember(updated) })
})

export default router
