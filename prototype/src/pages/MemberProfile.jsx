import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader, Badge } from '../layouts/AppShell'
import Modal from '../components/Modal'
import { MEMBERS, CHOIRS } from '../data/mock'
import { loadUserAccounts } from '../data/userAccounts'
import { USE_API } from '../api/config'
import { fetchUserAccounts } from '../api/client'
import { fetchMember, updateMember } from '../api/schedule'
import { useRole } from '../context/RoleContext'

const CHOIR_OPTIONS = ['', ...CHOIRS.primary, ...CHOIRS.secondary, ...CHOIRS.special]

function Section({ title, children }) {
  return (
    <section className="pmss-card p-5">
      <h2 className="text-sm font-semibold text-neutral-900 mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  )
}

export default function MemberProfilePage() {
  const { id } = useParams()
  const { permissions } = useRole()
  const [member, setMember] = useState(null)
  const [linkedAccount, setLinkedAccount] = useState(null)
  const [loading, setLoading] = useState(USE_API)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', choir: '', status: 'Active' })
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  useEffect(() => {
    if (!USE_API) {
      const m = MEMBERS.find((row) => String(row.id) === String(id)) || null
      setMember(m)
      setLinkedAccount(loadUserAccounts().find((a) => String(a.memberId) === String(id)) ?? null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([fetchMember(id), fetchUserAccounts().catch(() => ({ users: [] }))])
      .then(([profile, users]) => {
        if (cancelled) return
        setMember(profile.member)
        setLinkedAccount((users.users ?? []).find((a) => String(a.memberId) === String(id)) ?? null)
      })
      .catch(() => {
        if (!cancelled) setMember(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const openEdit = () => {
    if (!member) return
    setForm({
      name: member.name ?? '',
      email: member.email ?? '',
      phone: member.phone ?? '',
      choir: member.choir ?? '',
      status: member.status ?? 'Active',
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!form.name.trim()) {
      showToast('Full name is required')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        choir: form.choir.trim() || null,
        status: form.status,
      }
      if (USE_API) {
        const { member: updated } = await updateMember(id, body)
        setMember(updated)
      } else {
        setMember((prev) => ({ ...prev, ...body }))
      }
      setEditOpen(false)
      showToast('Member updated')
    } catch (err) {
      showToast(err.message ?? 'Could not update member')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500 p-8">Loading profile…</p>
  }

  if (!member) {
    return (
      <div className="p-8">
        <Link to="/members" className="text-sm text-primary-600">
          Back to members
        </Link>
        <p className="mt-4 text-neutral-600">Member not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/members" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to members
      </Link>

      <PageHeader
        title={member.name}
        description={`${member.role} · ${member.phone ?? '—'}`}
        actions={
          <>
            <Badge variant={member.status === 'Active' ? 'success' : 'neutral'}>{member.status}</Badge>
            {permissions.manageMembers ? (
              <button type="button" className="pmss-btn-secondary" onClick={openEdit}>
                Edit
              </button>
            ) : null}
          </>
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Personal information">
          <div className="grid gap-4">
            <Field label="Full name" value={member.name} />
            <Field label="Role" value={member.role} />
            <Field label="Member ID" value={member.id} />
          </div>
        </Section>
        <Section title="Contact information">
          <div className="grid gap-4">
            <Field label="Email" value={member.email ?? '—'} />
            <Field label="Phone" value={member.phone ?? '—'} />
            {linkedAccount && (
              <Field label="TMS login" value={`${linkedAccount.username} · ${linkedAccount.status}`} />
            )}
          </div>
        </Section>
        <Section title="Choir & attendance">
          <div className="grid gap-4">
            <Field label="Choir" value={member.choir ?? 'None'} />
            <Field
              label="Attendance rate"
              value={member.attendanceRate != null ? `${member.attendanceRate}%` : '—'}
            />
          </div>
        </Section>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit member"
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveEdit} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full name</label>
            <input
              className="pmss-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
            <input
              type="email"
              className="pmss-input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone</label>
            <input
              className="pmss-input"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Choir</label>
            <select
              className="pmss-input"
              value={form.choir}
              onChange={(e) => setForm((f) => ({ ...f, choir: e.target.value }))}
            >
              {CHOIR_OPTIONS.map((c) => (
                <option key={c || 'none'} value={c}>
                  {c || 'None — not in a choir'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Status</label>
            <select
              className="pmss-input"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
