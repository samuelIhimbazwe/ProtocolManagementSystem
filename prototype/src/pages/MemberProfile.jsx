import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader, Badge } from '../layouts/AppShell'
import { MEMBERS } from '../data/mock'
import { loadUserAccounts } from '../data/userAccounts'
import { USE_API } from '../api/config'
import { fetchUserAccounts } from '../api/client'
import { fetchMember } from '../api/schedule'

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
  const [member, setMember] = useState(null)
  const [linkedAccount, setLinkedAccount] = useState(null)
  const [loading, setLoading] = useState(USE_API)

  useEffect(() => {
    if (!USE_API) {
      setMember(MEMBERS.find((m) => m.id === id) || MEMBERS[0])
      setLinkedAccount(loadUserAccounts().find((a) => a.memberId === id) ?? null)
      setLoading(false)
      return
    }
    let cancelled = false
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

  const display = member ?? MEMBERS.find((m) => m.id === id)

  if (loading) {
    return <p className="text-sm text-neutral-500 p-8">Loading profile…</p>
  }

  if (!display) {
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
        title={display.name}
        description={`${display.role} · ${display.phone ?? '—'}`}
        actions={
          <>
            <Badge variant={display.status === 'Active' ? 'success' : 'neutral'}>{display.status}</Badge>
            <button type="button" className="pmss-btn-secondary">
              Edit
            </button>
          </>
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Personal information">
          <div className="grid gap-4">
            <Field label="Full name" value={display.name} />
            <Field label="Role" value={display.role} />
            <Field label="Member ID" value={display.id} />
          </div>
        </Section>
        <Section title="Contact information">
          <div className="grid gap-4">
            <Field label="Phone" value={display.phone ?? '—'} />
            {linkedAccount && (
              <Field
                label="PMSS login"
                value={`${linkedAccount.username} · ${linkedAccount.status}`}
              />
            )}
          </div>
        </Section>
        <Section title="Choir & attendance">
          <div className="grid gap-4">
            <Field label="Choir" value={display.choir ?? 'Not assigned'} />
            <Field
              label="Attendance rate"
              value={display.attendanceRate != null ? `${display.attendanceRate}%` : '—'}
            />
          </div>
        </Section>
      </div>
    </div>
  )
}
