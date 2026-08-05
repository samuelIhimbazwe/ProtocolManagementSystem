import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuid } from 'uuid'
import { db, audit } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EVIDENCE_DIR = path.join(__dirname, '..', 'data', 'uploads', 'evidence')
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024
const ALLOWED_EVIDENCE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

function ensureEvidenceDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
}

function extensionForEvidence(name, mime) {
  const fromName = path.extname(String(name ?? '')).toLowerCase()
  if (fromName && fromName.length <= 8) return fromName
  const byMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  }
  return byMime[mime] ?? ''
}

function saveEvidenceFile(submissionId, evidenceFile) {
  if (!evidenceFile || typeof evidenceFile !== 'object') return null
  const name = String(evidenceFile.name ?? '').trim().slice(0, 180)
  const mime = String(evidenceFile.mimeType ?? evidenceFile.mime ?? '').trim().toLowerCase()
  const raw = String(evidenceFile.dataBase64 ?? evidenceFile.data ?? '')
  if (!name || !mime || !raw) return null
  if (!ALLOWED_EVIDENCE_MIME.has(mime)) {
    const err = new Error('Evidence file type not allowed (use image, PDF, or Word doc)')
    err.status = 400
    throw err
  }
  const base64 = raw.replace(/^data:[^;]+;base64,/, '')
  let buf
  try {
    buf = Buffer.from(base64, 'base64')
  } catch {
    const err = new Error('Invalid evidence file data')
    err.status = 400
    throw err
  }
  if (!buf.length) return null
  if (buf.length > MAX_EVIDENCE_BYTES) {
    const err = new Error('Evidence file too large (max 5 MB)')
    err.status = 400
    throw err
  }
  ensureEvidenceDir()
  const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  const stored = `${submissionId}${extensionForEvidence(safeName, mime)}`
  const abs = path.join(EVIDENCE_DIR, stored)
  fs.writeFileSync(abs, buf)
  return {
    fileName: safeName,
    mime,
    relativePath: path.join('uploads', 'evidence', stored).replace(/\\/g, '/'),
  }
}

const VIEW_ROLES = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'coordinator',
  'member',
])
const MANAGE_TYPES = new Set(['treasurer', 'president', 'vice_president'])
const EXTEND_DEADLINE = new Set(['treasurer', 'president', 'vice_president'])
const MAKE_PUBLIC = new Set(['treasurer', 'president', 'vice_president'])
const MANAGE_METHODS = new Set(['treasurer'])
const VERIFY = new Set(['treasurer'])
const VIEW_LEDGER = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'coordinator',
])
const VIEW_REPORTS = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'coordinator',
])

function forbid(res) {
  res.status(403).json({ error: 'Forbidden' })
  return false
}

function requireRole(req, res, set) {
  if (!set.has(req.auth.role)) return forbid(res)
  return true
}

function mapMethod(row) {
  if (!row) return null
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    provider: row.provider,
    accountName: row.account_name,
    accountNumber: row.account_number,
    instructions: row.instructions,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
  }
}

function mapType(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    frequency: row.frequency,
    ministryGoal: row.ministry_goal ?? 0,
    memberGoal: row.member_goal ?? 0,
    memberGoalMode: row.member_goal_mode,
    visibility: row.visibility,
    startDate: row.start_date,
    deadline: row.deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSubmission(row) {
  if (!row) return null
  return {
    id: row.id,
    contributionTypeId: row.contribution_type_id,
    contributionName: row.contribution_name ?? row.name ?? null,
    memberId: row.member_id,
    memberName: row.member_name ?? null,
    memberPhone: row.member_phone ?? null,
    paymentDate: row.payment_date,
    claimedAmount: row.claimed_amount ?? 0,
    confirmedAmount: row.confirmed_amount,
    paymentMethodId: row.payment_method_id,
    paymentMethodLabel: row.payment_method_label ?? null,
    evidenceNote: row.evidence_note,
    evidenceFileName: row.evidence_file_name ?? null,
    evidenceFileMime: row.evidence_file_mime ?? null,
    hasEvidenceFile: Boolean(row.evidence_file_path),
    status: row.status,
    verificationNote: row.verification_note,
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at,
    verifiedByUserId: row.verified_by_user_id,
    verifiedByName: row.verified_by_name ?? null,
    followUpStatus: row.followup_status ?? null,
    followUpId: row.followup_id ?? null,
    outstandingAmount: row.outstanding_amount ?? null,
  }
}

async function memberGoalFor(typeId, memberId, typeRow) {
  if (typeRow.member_goal_mode === 'custom') {
    const custom = await db
      .prepare(
        `SELECT goal_amount FROM contribution_member_goals
         WHERE contribution_type_id = ? AND member_id = ?`,
      )
      .get(typeId, memberId)
    if (custom) return custom.goal_amount
  }
  return typeRow.member_goal ?? 0
}

async function confirmedTotalForMember(typeId, memberId) {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(
         CASE
           WHEN status = 'confirmed' THEN COALESCE(confirmed_amount, claimed_amount)
           WHEN status = 'partial' THEN COALESCE(confirmed_amount, 0)
           ELSE 0
         END
       ), 0) AS total
       FROM contribution_submissions
       WHERE contribution_type_id = ? AND member_id = ?`,
    )
    .get(typeId, memberId)
  return row?.total ?? 0
}

async function ministryCollected(typeId) {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(
         CASE
           WHEN status = 'confirmed' THEN COALESCE(confirmed_amount, claimed_amount)
           WHEN status = 'partial' THEN COALESCE(confirmed_amount, 0)
           ELSE 0
         END
       ), 0) AS total
       FROM contribution_submissions
       WHERE contribution_type_id = ?`,
    )
    .get(typeId)
  return row?.total ?? 0
}

async function ensureFollowUp(submissionId, outstanding, note, actorId) {
  let fu = await db
    .prepare(`SELECT * FROM contribution_followups WHERE submission_id = ?`)
    .get(submissionId)
  if (!fu) {
    const id = uuid()
    await db.prepare(
      `INSERT INTO contribution_followups (id, submission_id, outstanding_amount, status)
       VALUES (?, ?, ?, 'open')`,
    ).run(id, submissionId, outstanding)
    fu = await db.prepare(`SELECT * FROM contribution_followups WHERE id = ?`).get(id)
  } else {
    await db.prepare(
      `UPDATE contribution_followups SET outstanding_amount = ?, status = 'open',
       updated_at = datetime('now'), resolved_at = NULL WHERE id = ?`,
    ).run(outstanding, fu.id)
  }
  if (note) {
    await db.prepare(
      `INSERT INTO contribution_followup_notes (id, followup_id, author_user_id, body)
       VALUES (?, ?, ?, ?)`,
    ).run(uuid(), fu.id, actorId ?? null, note)
  }
  return fu.id
}

/** GET /finance/summary — role-aware home widgets */
router.get('/summary', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VIEW_ROLES)) return

  const types = (await db
    .prepare(`SELECT * FROM contribution_types WHERE status = 'Active' ORDER BY name`)
    .all()).map(mapType)

  const activeMethods = (await db
    .prepare(`SELECT * FROM payment_methods WHERE active = 1 ORDER BY sort_order, label`)
    .all()).map(mapMethod)

  if (req.auth.role === 'member') {
    const mid = req.auth.memberId
    const memberProgress = []
    if (mid) {
      for (const t of types) {
        const row = await db.prepare(`SELECT * FROM contribution_types WHERE id = ?`).get(t.id)
        const goal = await memberGoalFor(t.id, mid, row)
        const paid = await confirmedTotalForMember(t.id, mid)
        const remaining = Math.max(0, goal - paid)
        const entry = {
          id: t.id,
          name: t.name,
          frequency: t.frequency,
          deadline: t.deadline,
          visibility: t.visibility,
          memberGoal: goal,
          paid,
          remaining,
          progressPct: goal > 0 ? Math.min(100, Math.round((paid / goal) * 100)) : 0,
        }
        if (t.visibility === 'public') {
          const collectedAmt = await ministryCollected(t.id)
          entry.ministryGoal = t.ministryGoal
          entry.collected = collectedAmt
          entry.ministryProgressPct =
            t.ministryGoal > 0 ? Math.min(100, Math.round((collectedAmt / t.ministryGoal) * 100)) : 0
        }
        memberProgress.push(entry)
      }
    }

    const publicGoals = []
    for (const t of types.filter((x) => x.visibility === 'public')) {
      const collectedAmt = await ministryCollected(t.id)
      publicGoals.push({
        id: t.id,
        name: t.name,
        frequency: t.frequency,
        deadline: t.deadline,
        ministryGoal: t.ministryGoal,
        collected: collectedAmt,
        progressPct:
          t.ministryGoal > 0 ? Math.min(100, Math.round((collectedAmt / t.ministryGoal) * 100)) : 0,
      })
    }

    return res.json({
      leadership: null,
      memberProgress,
      publicGoals,
      methods: activeMethods,
    })
  }

  const pending = (
    await db
      .prepare(`SELECT COUNT(*) AS c FROM contribution_submissions WHERE status = 'pending'`)
      .get()
  ).c
  const activeTypes = (
    await db
      .prepare(`SELECT COUNT(*) AS c FROM contribution_types WHERE status = 'Active'`)
      .get()
  ).c
  const collected = (
    await db
      .prepare(
        `SELECT COALESCE(SUM(
         CASE
           WHEN status = 'confirmed' THEN COALESCE(confirmed_amount, claimed_amount)
           WHEN status = 'partial' THEN COALESCE(confirmed_amount, 0)
           ELSE 0
         END
       ), 0) AS total FROM contribution_submissions`,
      )
      .get()
  ).total
  const outstanding = (
    await db
      .prepare(
        `SELECT COALESCE(SUM(outstanding_amount), 0) AS total
       FROM contribution_followups WHERE status IN ('open', 'in_progress')`,
      )
      .get()
  ).total

  const publicGoals = []
  for (const t of types.filter((x) => x.visibility === 'public')) {
    const collectedAmt = await ministryCollected(t.id)
    publicGoals.push({
      id: t.id,
      name: t.name,
      frequency: t.frequency,
      deadline: t.deadline,
      ministryGoal: t.ministryGoal,
      collected: collectedAmt,
      progressPct:
        t.ministryGoal > 0 ? Math.min(100, Math.round((collectedAmt / t.ministryGoal) * 100)) : 0,
    })
  }

  const leadership = {
    totalCollected: collected,
    pendingVerification: pending,
    outstandingBalances: outstanding,
    activeTypes,
    goalAchievement: (() => {
      const goals = types.reduce((s, t) => s + (t.ministryGoal || 0), 0)
      return goals > 0 ? Math.round((collected / goals) * 100) : null
    })(),
  }

  // Leadership also pays — include personal progress when the login is linked to the roster.
  let memberProgress = null
  if (req.auth.memberId) {
    const mid = req.auth.memberId
    memberProgress = []
    for (const t of types) {
      const row = await db.prepare(`SELECT * FROM contribution_types WHERE id = ?`).get(t.id)
      const goal = await memberGoalFor(t.id, mid, row)
      const paid = await confirmedTotalForMember(t.id, mid)
      const remaining = Math.max(0, goal - paid)
      memberProgress.push({
        id: t.id,
        name: t.name,
        frequency: t.frequency,
        deadline: t.deadline,
        visibility: t.visibility,
        memberGoal: goal,
        paid,
        remaining,
        progressPct: goal > 0 ? Math.min(100, Math.round((paid / goal) * 100)) : 0,
      })
    }
  }

  return res.json({
    leadership,
    memberProgress,
    publicGoals,
    methods: activeMethods,
  })
})

/** Payment methods */
router.get('/methods', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VIEW_ROLES)) return
  const all = req.auth.role === 'treasurer'
  const rows = all
    ? await db.prepare(`SELECT * FROM payment_methods ORDER BY sort_order, label`).all()
    : await db.prepare(`SELECT * FROM payment_methods WHERE active = 1 ORDER BY sort_order, label`).all()
  return res.json({ methods: rows.map(mapMethod) })
})

router.post('/methods', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, MANAGE_METHODS)) return
  const { kind, label, provider, accountName, accountNumber, instructions, sortOrder } = req.body ?? {}
  if (!kind || !label?.trim()) return res.status(400).json({ error: 'kind and label required' })
  const id = uuid()
  await db.prepare(
    `INSERT INTO payment_methods
     (id, kind, label, provider, account_name, account_number, instructions, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    kind,
    label.trim(),
    provider ?? null,
    accountName ?? null,
    accountNumber ?? null,
    instructions ?? null,
    Number(sortOrder) || 0,
  )
  await audit('finance.method.create', req.auth.sub, { id, label })
  return res.status(201).json({ method: mapMethod(await db.prepare(`SELECT * FROM payment_methods WHERE id = ?`).get(id)) })
})

router.put('/methods/:id', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, MANAGE_METHODS)) return
  const existing = await db.prepare(`SELECT * FROM payment_methods WHERE id = ?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const b = req.body ?? {}
  await db.prepare(
    `UPDATE payment_methods SET
      kind = ?, label = ?, provider = ?, account_name = ?, account_number = ?,
      instructions = ?, sort_order = ?, active = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    b.kind ?? existing.kind,
    (b.label ?? existing.label).trim(),
    b.provider !== undefined ? b.provider : existing.provider,
    b.accountName !== undefined ? b.accountName : existing.account_name,
    b.accountNumber !== undefined ? b.accountNumber : existing.account_number,
    b.instructions !== undefined ? b.instructions : existing.instructions,
    b.sortOrder !== undefined ? Number(b.sortOrder) : existing.sort_order,
    b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
    req.params.id,
  )
  await audit('finance.method.update', req.auth.sub, { id: req.params.id })
  return res.json({ method: mapMethod(await db.prepare(`SELECT * FROM payment_methods WHERE id = ?`).get(req.params.id)) })
})

router.delete('/methods/:id', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, MANAGE_METHODS)) return
  await db.prepare(`UPDATE payment_methods SET active = 0, updated_at = datetime('now') WHERE id = ?`).run(
    req.params.id,
  )
  await audit('finance.method.deactivate', req.auth.sub, { id: req.params.id })
  return res.json({ ok: true })
})

/** Contribution types */
router.get('/types', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VIEW_ROLES)) return
  let rows
  if (req.auth.role === 'member') {
    rows = await db
      .prepare(
        `SELECT * FROM contribution_types
         WHERE status = 'Active' AND (visibility = 'public' OR visibility = 'private')
         ORDER BY name`,
      )
      .all()
    // Members see private types for payment obligation, but ministry totals only if public
  } else {
    rows = await db.prepare(`SELECT * FROM contribution_types ORDER BY status, name`).all()
  }
  const types = []
  for (const r of rows) {
    const t = mapType(r)
    if (req.auth.role === 'member') {
      // Members may pay against active types; hide ministry collection for private goals.
      const safe = {
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        status: t.status,
        frequency: t.frequency,
        memberGoal: t.memberGoal,
        visibility: t.visibility,
        startDate: t.startDate,
        deadline: t.deadline,
        showMinistryGoal: t.visibility === 'public',
      }
      if (t.visibility === 'public') {
        const collected = await ministryCollected(r.id)
        safe.ministryGoal = t.ministryGoal
        safe.collected = collected
        safe.progressPct =
          t.ministryGoal > 0 ? Math.min(100, Math.round((collected / t.ministryGoal) * 100)) : 0
      }
      types.push(safe)
      continue
    }
    const collected = await ministryCollected(r.id)
    types.push({
      ...t,
      collected,
      progressPct: t.ministryGoal > 0 ? Math.min(100, Math.round((collected / t.ministryGoal) * 100)) : 0,
      showMinistryGoal: true,
    })
  }
  return res.json({ types })
})

router.post('/types', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, MANAGE_TYPES)) return
  const b = req.body ?? {}
  if (!b.name?.trim()) return res.status(400).json({ error: 'name required' })
  if (!b.deadline && b.frequency !== 'continuous') {
    return res.status(400).json({ error: 'deadline required unless continuous' })
  }
  const id = uuid()
  await db.prepare(
    `INSERT INTO contribution_types
     (id, name, description, category, status, frequency, ministry_goal, member_goal,
      member_goal_mode, visibility, start_date, deadline, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    b.name.trim(),
    b.description ?? null,
    b.category ?? 'General',
    b.status ?? 'Active',
    b.frequency ?? 'one_time',
    Number(b.ministryGoal) || 0,
    Number(b.memberGoal) || 0,
    b.memberGoalMode ?? 'uniform',
    b.visibility ?? 'private',
    b.startDate ?? null,
    b.deadline ?? null,
    req.auth.sub,
  )
  if (Array.isArray(b.memberGoals)) {
    const ins = db.prepare(
      `INSERT INTO contribution_member_goals (contribution_type_id, member_id, goal_amount)
       VALUES (?, ?, ?)
       ON CONFLICT(contribution_type_id, member_id) DO UPDATE SET goal_amount = excluded.goal_amount`,
    )
    for (const g of b.memberGoals) {
      if (g.memberId) await ins.run(id, g.memberId, Number(g.goalAmount) || 0)
    }
  }
  await audit('finance.type.create', req.auth.sub, { id, name: b.name })
  return res.status(201).json({ type: mapType(await db.prepare(`SELECT * FROM contribution_types WHERE id = ?`).get(id)) })
})

router.put('/types/:id', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, MANAGE_TYPES)) return
  const existing = await db.prepare(`SELECT * FROM contribution_types WHERE id = ?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const b = req.body ?? {}

  if (b.visibility === 'public' && !MAKE_PUBLIC.has(req.auth.role)) {
    return forbid(res)
  }
  if (b.deadline && b.deadline !== existing.deadline && !EXTEND_DEADLINE.has(req.auth.role)) {
    return forbid(res)
  }

  await db.prepare(
    `UPDATE contribution_types SET
      name = ?, description = ?, category = ?, status = ?, frequency = ?,
      ministry_goal = ?, member_goal = ?, member_goal_mode = ?, visibility = ?,
      start_date = ?, deadline = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    (b.name ?? existing.name).trim(),
    b.description !== undefined ? b.description : existing.description,
    b.category ?? existing.category,
    b.status ?? existing.status,
    b.frequency ?? existing.frequency,
    b.ministryGoal !== undefined ? Number(b.ministryGoal) : existing.ministry_goal,
    b.memberGoal !== undefined ? Number(b.memberGoal) : existing.member_goal,
    b.memberGoalMode ?? existing.member_goal_mode,
    b.visibility ?? existing.visibility,
    b.startDate !== undefined ? b.startDate : existing.start_date,
    b.deadline !== undefined ? b.deadline : existing.deadline,
    req.params.id,
  )
  await audit('finance.type.update', req.auth.sub, { id: req.params.id })
  return res.json({
    type: mapType(await db.prepare(`SELECT * FROM contribution_types WHERE id = ?`).get(req.params.id)),
  })
})

router.delete('/types/:id', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, new Set(['treasurer']))) return
  const existing = await db.prepare(`SELECT * FROM contribution_types WHERE id = ?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  await db.prepare(`UPDATE contribution_types SET status = 'Closed', updated_at = datetime('now') WHERE id = ?`).run(
    req.params.id,
  )
  await audit('finance.type.close', req.auth.sub, { id: req.params.id })
  return res.json({ ok: true })
})

/** Submissions */
router.get('/submissions', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VIEW_ROLES)) return
  const { status, typeId, memberId } = req.query
  const clauses = []
  const params = []

  if (req.auth.role === 'member') {
    clauses.push('s.member_id = ?')
    params.push(req.auth.memberId)
  } else if (!VIEW_LEDGER.has(req.auth.role)) {
    return forbid(res)
  } else if (memberId) {
    clauses.push('s.member_id = ?')
    params.push(String(memberId))
  }

  if (status) {
    clauses.push('s.status = ?')
    params.push(String(status))
  }
  if (typeId) {
    clauses.push('s.contribution_type_id = ?')
    params.push(String(typeId))
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = (await db
    .prepare(
      `SELECT s.*, t.name AS contribution_name, m.name AS member_name, m.phone AS member_phone,
        pm.label AS payment_method_label, u.display_name AS verified_by_name,
        f.status AS followup_status, f.id AS followup_id, f.outstanding_amount
       FROM contribution_submissions s
       JOIN contribution_types t ON t.id = s.contribution_type_id
       JOIN members m ON m.id = s.member_id
       LEFT JOIN payment_methods pm ON pm.id = s.payment_method_id
       LEFT JOIN users u ON u.id = s.verified_by_user_id
       LEFT JOIN contribution_followups f ON f.submission_id = s.id
       ${where}
       ORDER BY s.submitted_at DESC
       LIMIT 200`,
    )
    .all(...params)).map(mapSubmission)

  const claimedTotal = rows.reduce((s, r) => s + (r.claimedAmount || 0), 0)
  const confirmedTotal = rows.reduce((s, r) => {
    if (r.status === 'confirmed') return s + (r.confirmedAmount ?? r.claimedAmount ?? 0)
    if (r.status === 'partial') return s + (r.confirmedAmount ?? 0)
    return s
  }, 0)

  return res.json({
    submissions: rows,
    totals: {
      claimedTotal,
      confirmedTotal,
      difference: claimedTotal - confirmedTotal,
    },
  })
})

router.post('/submissions', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VIEW_ROLES)) return
  const b = req.body ?? {}
  // Members may only submit for themselves. Any roster-linked login may pay for themselves.
  // Leadership with ledger access may also submit on behalf of another member.
  if (req.auth.role === 'member') {
    if (!req.auth.memberId) return res.status(403).json({ error: 'Member profile not linked' })
  } else {
    const payingSelf = !b.memberId || String(b.memberId) === String(req.auth.memberId)
    if (payingSelf && req.auth.memberId) {
      // own contribution — allowed for every finance role
    } else if (!VIEW_LEDGER.has(req.auth.role)) {
      return forbid(res)
    }
  }
  const memberId =
    req.auth.role === 'member'
      ? req.auth.memberId
      : b.memberId
        ? String(b.memberId)
        : req.auth.memberId
          ? String(req.auth.memberId)
          : null
  if (!memberId) {
    return res.status(400).json({
      error: 'memberId required — link this login to a roster member or choose a member',
    })
  }
  // Ignore any client-supplied memberId override from members.
  if (req.auth.role === 'member' && b.memberId && String(b.memberId) !== String(req.auth.memberId)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!b.contributionTypeId || !b.paymentDate || b.claimedAmount == null) {
    return res.status(400).json({ error: 'contributionTypeId, paymentDate, claimedAmount required' })
  }
  const type = await db.prepare(`SELECT * FROM contribution_types WHERE id = ?`).get(b.contributionTypeId)
  if (!type || type.status !== 'Active') return res.status(400).json({ error: 'Invalid contribution type' })

  const claimed = Math.round(Number(b.claimedAmount))
  if (!Number.isFinite(claimed) || claimed <= 0) return res.status(400).json({ error: 'Invalid amount' })

  const id = uuid()
  let savedEvidence = null
  try {
    savedEvidence = saveEvidenceFile(id, b.evidenceFile)
  } catch (err) {
    return res.status(err.status ?? 400).json({ error: err.message ?? 'Invalid evidence file' })
  }

  await db.prepare(
    `INSERT INTO contribution_submissions
     (id, contribution_type_id, member_id, payment_date, claimed_amount, payment_method_id,
      evidence_note, evidence_file_name, evidence_file_mime, evidence_file_path, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  ).run(
    id,
    b.contributionTypeId,
    memberId,
    b.paymentDate,
    claimed,
    b.paymentMethodId ?? null,
    b.evidenceNote ?? null,
    savedEvidence?.fileName ?? null,
    savedEvidence?.mime ?? null,
    savedEvidence?.relativePath ?? null,
  )
  await audit('finance.submission.create', req.auth.sub, {
    id,
    memberId,
    claimed,
    hasEvidenceFile: Boolean(savedEvidence),
  })
  const row = await db
    .prepare(
      `SELECT s.*, t.name AS contribution_name, m.name AS member_name, m.phone AS member_phone
       FROM contribution_submissions s
       JOIN contribution_types t ON t.id = s.contribution_type_id
       JOIN members m ON m.id = s.member_id
       WHERE s.id = ?`,
    )
    .get(id)
  return res.status(201).json({ submission: mapSubmission(row) })
})

router.get('/submissions/:id/evidence', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VIEW_ROLES)) return
  const sub = await db.prepare(`SELECT * FROM contribution_submissions WHERE id = ?`).get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Not found' })
  if (req.auth.role === 'member') {
    if (String(sub.member_id ?? '') !== String(req.auth.memberId ?? '')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  } else if (!VIEW_LEDGER.has(req.auth.role)) {
    return forbid(res)
  }
  if (!sub.evidence_file_path) return res.status(404).json({ error: 'No evidence file' })

  const abs = path.join(__dirname, '..', 'data', sub.evidence_file_path)
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Evidence file missing' })

  res.setHeader('Content-Type', sub.evidence_file_mime || 'application/octet-stream')
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${String(sub.evidence_file_name ?? 'evidence').replace(/"/g, '')}"`,
  )
  return res.sendFile(abs)
})

router.post('/submissions/:id/verify', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VERIFY)) return
  const sub = await db.prepare(`SELECT * FROM contribution_submissions WHERE id = ?`).get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Not found' })
  if (sub.status !== 'pending' && sub.status !== 'partial') {
    return res.status(400).json({ error: 'Only pending or partial submissions can be verified' })
  }

  const { action, receivedAmount, note } = req.body ?? {}
  if (!['confirm', 'partial', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'action must be confirm, partial, or decline' })
  }

  if (action === 'confirm') {
    await db.prepare(
      `UPDATE contribution_submissions SET
        status = 'confirmed', confirmed_amount = ?, verification_note = ?,
        confirmed_at = datetime('now'), verified_by_user_id = ?
       WHERE id = ?`,
    ).run(sub.claimed_amount, note ?? null, req.auth.sub, sub.id)
    const fu = await db.prepare(`SELECT id FROM contribution_followups WHERE submission_id = ?`).get(sub.id)
    if (fu) {
      await db.prepare(
        `UPDATE contribution_followups SET status = 'resolved', outstanding_amount = 0,
         updated_at = datetime('now'), resolved_at = datetime('now') WHERE id = ?`,
      ).run(fu.id)
    }
  } else if (action === 'partial') {
    const received = Math.round(Number(receivedAmount))
    if (!Number.isFinite(received) || received < 0) {
      return res.status(400).json({ error: 'receivedAmount required' })
    }
    if (!note?.trim()) return res.status(400).json({ error: 'explanation note required' })
    const outstanding = Math.max(0, sub.claimed_amount - received)
    await db.prepare(
      `UPDATE contribution_submissions SET
        status = 'partial', confirmed_amount = ?, verification_note = ?,
        confirmed_at = datetime('now'), verified_by_user_id = ?
       WHERE id = ?`,
    ).run(received, note.trim(), req.auth.sub, sub.id)
    await ensureFollowUp(sub.id, outstanding, note.trim(), req.auth.sub)
  } else {
    if (!note?.trim()) return res.status(400).json({ error: 'note required when declining' })
    await db.prepare(
      `UPDATE contribution_submissions SET
        status = 'declined', confirmed_amount = 0, verification_note = ?,
        confirmed_at = datetime('now'), verified_by_user_id = ?
       WHERE id = ?`,
    ).run(note.trim(), req.auth.sub, sub.id)
    await ensureFollowUp(sub.id, sub.claimed_amount, note.trim(), req.auth.sub)
  }

  const row = await db
    .prepare(
      `SELECT s.*, t.name AS contribution_name, m.name AS member_name, m.phone AS member_phone,
        f.status AS followup_status, f.id AS followup_id, f.outstanding_amount
       FROM contribution_submissions s
       JOIN contribution_types t ON t.id = s.contribution_type_id
       JOIN members m ON m.id = s.member_id
       LEFT JOIN contribution_followups f ON f.submission_id = s.id
       WHERE s.id = ?`,
    )
    .get(sub.id)

  await audit('finance.submission.verify', req.auth.sub, {
    id: sub.id,
    action,
    memberName: row?.member_name,
    contributionName: row?.contribution_name,
    summary:
      row?.member_name && row?.contribution_name
        ? `${row.member_name} · ${row.contribution_name}`
        : undefined,
  })

  return res.json({ submission: mapSubmission(row) })
})

/** Follow-ups */
router.get('/followups', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VIEW_LEDGER)) return
  const rows = (await db
    .prepare(
      `SELECT f.*, s.claimed_amount, s.confirmed_amount, s.status AS submission_status,
        s.verification_note, m.name AS member_name, t.name AS contribution_name
       FROM contribution_followups f
       JOIN contribution_submissions s ON s.id = f.submission_id
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       ORDER BY f.updated_at DESC`,
    )
    .all()).map((r) => ({
      id: r.id,
      submissionId: r.submission_id,
      outstandingAmount: r.outstanding_amount,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      resolvedAt: r.resolved_at,
      memberName: r.member_name,
      contributionName: r.contribution_name,
      claimedAmount: r.claimed_amount,
      confirmedAmount: r.confirmed_amount,
      submissionStatus: r.submission_status,
      verificationNote: r.verification_note,
    }))
  return res.json({ followups: rows })
})

router.get('/followups/:id', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VIEW_LEDGER)) return
  const r = await db
    .prepare(
      `SELECT f.*, m.name AS member_name, t.name AS contribution_name, s.verification_note
       FROM contribution_followups f
       JOIN contribution_submissions s ON s.id = f.submission_id
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       WHERE f.id = ?`,
    )
    .get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Not found' })
  const notes = (await db
    .prepare(
      `SELECT n.*, u.display_name AS author_name FROM contribution_followup_notes n
       LEFT JOIN users u ON u.id = n.author_user_id
       WHERE n.followup_id = ? ORDER BY n.created_at`,
    )
    .all(req.params.id)).map((n) => ({
      id: n.id,
      body: n.body,
      authorName: n.author_name,
      createdAt: n.created_at,
    }))
  return res.json({
    followup: {
      id: r.id,
      submissionId: r.submission_id,
      outstandingAmount: r.outstanding_amount,
      status: r.status,
      memberName: r.member_name,
      contributionName: r.contribution_name,
      verificationNote: r.verification_note,
      notes,
    },
  })
})

router.patch('/followups/:id', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VERIFY)) return
  const fu = await db.prepare(`SELECT * FROM contribution_followups WHERE id = ?`).get(req.params.id)
  if (!fu) return res.status(404).json({ error: 'Not found' })
  const { status, note, outstandingAmount } = req.body ?? {}
  const nextStatus = status ?? fu.status
  await db.prepare(
    `UPDATE contribution_followups SET
      status = ?,
      outstanding_amount = ?,
      updated_at = datetime('now'),
      resolved_at = CASE WHEN ? IN ('resolved', 'closed') THEN datetime('now') ELSE resolved_at END
     WHERE id = ?`,
  ).run(
    nextStatus,
    outstandingAmount !== undefined ? Number(outstandingAmount) : fu.outstanding_amount,
    nextStatus,
    req.params.id,
  )
  if (note?.trim()) {
    await db.prepare(
      `INSERT INTO contribution_followup_notes (id, followup_id, author_user_id, body)
       VALUES (?, ?, ?, ?)`,
    ).run(uuid(), req.params.id, req.auth.sub, note.trim())
  }
  await audit('finance.followup.update', req.auth.sub, { id: req.params.id, status: nextStatus })
  return res.json({ ok: true })
})

/** Reports */
router.get('/reports', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, VIEW_REPORTS)) return
  const byType = (await db
    .prepare(
      `SELECT t.id, t.name, t.ministry_goal,
        COALESCE(SUM(CASE WHEN s.status = 'confirmed' THEN COALESCE(s.confirmed_amount, s.claimed_amount)
                          WHEN s.status = 'partial' THEN COALESCE(s.confirmed_amount, 0) ELSE 0 END), 0) AS collected,
        COALESCE(SUM(s.claimed_amount), 0) AS claimed
       FROM contribution_types t
       LEFT JOIN contribution_submissions s ON s.contribution_type_id = t.id
       GROUP BY t.id
       ORDER BY t.name`,
    )
    .all()).map((r) => ({
      id: r.id,
      name: r.name,
      ministryGoal: r.ministry_goal,
      collected: r.collected,
      claimed: r.claimed,
      progressPct:
        r.ministry_goal > 0 ? Math.min(100, Math.round((r.collected / r.ministry_goal) * 100)) : null,
    }))

  const byMember = (await db
    .prepare(
      `SELECT m.id, m.name, m.phone,
        COALESCE(SUM(CASE WHEN s.status = 'confirmed' THEN COALESCE(s.confirmed_amount, s.claimed_amount)
                          WHEN s.status = 'partial' THEN COALESCE(s.confirmed_amount, 0) ELSE 0 END), 0) AS paid,
        COALESCE(SUM(s.claimed_amount), 0) AS claimed
       FROM members m
       LEFT JOIN contribution_submissions s ON s.member_id = m.id
       WHERE m.role = 'Member' AND m.status = 'Active'
       GROUP BY m.id
       ORDER BY paid DESC, m.name`,
    )
    .all()).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      paid: r.paid,
      claimed: r.claimed,
    }))

  const outstanding = await db
    .prepare(
      `SELECT f.outstanding_amount, f.status, m.name AS member_name, t.name AS contribution_name,
        s.status AS submission_status
       FROM contribution_followups f
       JOIN contribution_submissions s ON s.id = f.submission_id
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       WHERE f.status IN ('open', 'in_progress')
       ORDER BY f.outstanding_amount DESC`,
    )
    .all()

  const partials = (await db
    .prepare(
      `SELECT s.*, m.name AS member_name, t.name AS contribution_name
       FROM contribution_submissions s
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       WHERE s.status = 'partial'
       ORDER BY s.confirmed_at DESC`,
    )
    .all()).map(mapSubmission)

  const declined = (await db
    .prepare(
      `SELECT s.*, m.name AS member_name, t.name AS contribution_name
       FROM contribution_submissions s
       JOIN members m ON m.id = s.member_id
       JOIN contribution_types t ON t.id = s.contribution_type_id
       WHERE s.status = 'declined'
       ORDER BY s.confirmed_at DESC`,
    )
    .all()).map(mapSubmission)

  return res.json({
    collection: byType,
    members: byMember,
    outstanding,
    partials,
    declined,
  })
})

export default router
