import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, MailPlus, UserPlus, UserCheck, UserX } from 'lucide-react'
import { PageHeader, DataTable, Badge } from '../layouts/AppShell'
import Modal from '../components/Modal'
import MembersSubnav from '../components/MembersSubnav'
import { useRole } from '../context/RoleContext'
import { ROLES } from '../data/roles'
import { MEMBERS } from '../data/mock'
import {
  loadUserAccounts,
  saveUserAccounts,
  appRoleLabel,
  membersWithoutAccount,
  suggestUsername,
} from '../data/userAccounts'
import { USE_API } from '../api/config'
import { fetchUserAccounts } from '../api/client'
import { inviteUser, createUser, patchUser, fetchMembers } from '../api/schedule'

function mapApiUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    memberId: u.memberId,
    displayName: u.displayName,
    appRole: u.appRole,
    status: u.status,
    lastLogin: u.lastLogin ? String(u.lastLogin).slice(0, 10) : null,
    invitedAt: u.invitedAt ? String(u.invitedAt).slice(0, 10) : null,
  }
}

function mapApiMember(m) {
  return {
    id: String(m.id),
    name: m.name,
    role: m.role,
  }
}

function statusVariant(status) {
  if (status === 'Active') return 'success'
  if (status === 'Invited') return 'warning'
  return 'neutral'
}

function emptyForm() {
  return {
    memberId: '',
    username: '',
    email: '',
    appRole: 'member',
    password: '',
    confirmPassword: '',
  }
}

export default function UserAccountsPage() {
  const { permissions } = useRole()
  const canManage = permissions.manageUsers

  const [accounts, setAccounts] = useState(() => (USE_API ? [] : loadUserAccounts()))
  const [roster, setRoster] = useState(() => (USE_API ? [] : MEMBERS))
  const [accountsLoading, setAccountsLoading] = useState(USE_API)
  const [accountsError, setAccountsError] = useState(null)
  const [search, setSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)

  const availableMembers = useMemo(() => membersWithoutAccount(accounts, roster), [accounts, roster])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const applyMemberDefaults = (memberId, { clearEmail = false } = {}) => {
    const member = roster.find((m) => m.id === memberId)
    if (!member) return
    const username = suggestUsername(member.name)
    setForm((f) => ({
      ...f,
      memberId,
      username,
      email: clearEmail ? '' : `${username}@church.internal`,
      appRole: member.role === 'Member' ? 'member' : ROLES.find((r) => r.label === member.role)?.id ?? 'member',
    }))
  }

  const reloadAccounts = () => {
    if (!USE_API) return Promise.resolve()
    return fetchUserAccounts()
      .then((data) => {
        setAccounts((data.users ?? []).map(mapApiUser))
        setAccountsError(null)
      })
      .catch((err) => setAccountsError(err.message ?? 'Could not load accounts'))
  }

  useEffect(() => {
    if (!USE_API) return
    let cancelled = false
    setAccountsLoading(true)
    Promise.all([reloadAccounts(), fetchMembers()])
      .then(([, membersData]) => {
        if (cancelled) return
        setRoster((membersData.members ?? []).map(mapApiMember))
      })
      .catch((err) => {
        if (!cancelled) setAccountsError(err.message ?? 'Could not load accounts')
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = (next) => {
    if (USE_API) return
    setAccounts(next)
    saveUserAccounts(next)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        a.username.toLowerCase().includes(q) ||
        a.displayName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q),
    )
  }, [accounts, search])

  const openInvite = () => {
    const first = availableMembers[0]
    setFormError('')
    if (first) {
      const username = suggestUsername(first.name)
      setForm({
        memberId: first.id,
        username,
        email: '',
        appRole: first.role === 'Member' ? 'member' : ROLES.find((r) => r.label === first.role)?.id ?? 'member',
        password: '',
        confirmPassword: '',
      })
    } else {
      setForm(emptyForm())
    }
    setInviteOpen(true)
  }

  const openCreate = () => {
    const first = availableMembers[0]
    setFormError('')
    if (first) {
      const username = suggestUsername(first.name)
      setForm({
        memberId: first.id,
        username,
        email: `${username}@church.internal`,
        appRole: first.role === 'Member' ? 'member' : ROLES.find((r) => r.label === first.role)?.id ?? 'member',
        password: '',
        confirmPassword: '',
      })
    } else {
      setForm(emptyForm())
    }
    setCreateOpen(true)
  }

  const onMemberChange = (memberId, { forInvite = false } = {}) => {
    applyMemberDefaults(memberId, { clearEmail: forInvite })
  }

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())

  const submitInvite = async () => {
    const member = roster.find((m) => m.id === form.memberId)
    if (!member) return
    if (!form.username.trim()) {
      setFormError('Username is required')
      return
    }
    if (!isValidEmail(form.email)) {
      setFormError('Enter the email address where the invite should be sent')
      return
    }
    setSubmitting(true)
    setFormError('')
    const inviteEmail = form.email.trim()
    try {
      if (USE_API) {
        const res = await inviteUser({
          memberId: member.id,
          appRole: form.appRole,
          username: form.username.trim(),
          email: inviteEmail,
          mode: 'invite',
        })
        await reloadAccounts()
        const dest = res.inviteEmail || inviteEmail
        showToast(
          res.demoTempPassword
            ? `Invite queued for ${dest}. Temporary password: ${res.demoTempPassword}`
            : `Invite queued for ${dest}`,
        )
      } else {
        const newAccount = {
          id: `u-new-${Date.now()}`,
          username: form.username.trim(),
          email: inviteEmail,
          memberId: member.id,
          displayName: member.name,
          appRole: form.appRole,
          status: 'Invited',
          lastLogin: null,
          invitedAt: new Date().toISOString().slice(0, 10),
        }
        persist([...accounts, newAccount])
        showToast(`Invite queued for ${inviteEmail}`)
      }
      setInviteOpen(false)
    } catch (err) {
      setFormError(err.message ?? 'Invite failed')
    } finally {
      setSubmitting(false)
    }
  }

  const submitCreate = async () => {
    const member = roster.find((m) => m.id === form.memberId)
    if (!member) return
    if (!form.username.trim()) {
      setFormError('Username is required')
      return
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      setFormError('Passwords do not match')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      if (USE_API) {
        await createUser({
          memberId: member.id,
          appRole: form.appRole,
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          mode: 'create',
        })
        await reloadAccounts()
      } else {
        const newAccount = {
          id: `u-new-${Date.now()}`,
          username: form.username.trim(),
          email: form.email.trim() || `${form.username.trim()}@church.internal`,
          memberId: member.id,
          displayName: member.name,
          appRole: form.appRole,
          status: 'Active',
          lastLogin: null,
          invitedAt: null,
        }
        persist([...accounts, newAccount])
      }
      showToast(`Account created for ${member.name}`)
      setCreateOpen(false)
    } catch (err) {
      setFormError(err.message ?? 'Could not create user')
    } finally {
      setSubmitting(false)
    }
  }

  const setStatus = async (id, status) => {
    if (USE_API) {
      try {
        await patchUser(id, { status })
        await reloadAccounts()
        showToast(status === 'Active' ? 'Account reactivated' : 'Account deactivated')
      } catch (err) {
        showToast(err.message ?? 'Update failed')
      }
      return
    }
    persist(
      accounts.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              lastLogin: status === 'Active' && !a.lastLogin ? new Date().toISOString().slice(0, 10) : a.lastLogin,
            }
          : a,
      ),
    )
    showToast(status === 'Active' ? 'Account reactivated' : 'Account deactivated')
  }

  const sendReset = (account) => {
    showToast(`Password reset: use Forgot password on the login page for ${account.username}`)
  }

  const resendInvite = (account) => {
    showToast(`Invite remains pending for ${account.username}`)
  }

  const columns = [
    {
      key: 'displayName',
      label: 'Name',
      render: (a) => (
        <div>
          <p className="font-medium text-neutral-900">{a.displayName}</p>
          <p className="text-xs text-neutral-500">{a.username}</p>
        </div>
      ),
    },
    { key: 'email', label: 'Email' },
    {
      key: 'appRole',
      label: 'App role',
      render: (a) => <Badge variant="primary">{appRoleLabel(a.appRole)}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (a) => <Badge variant={statusVariant(a.status)}>{a.status}</Badge>,
    },
    {
      key: 'lastLogin',
      label: 'Last sign-in',
      render: (a) => a.lastLogin ?? (a.status === 'Invited' ? `Invited ${a.invitedAt ?? '—'}` : '—'),
    },
    {
      key: 'member',
      label: 'Roster',
      render: (a) => (
        <Link to={`/members/${a.memberId}`} className="text-primary-600 text-xs font-medium hover:underline">
          View profile
        </Link>
      ),
    },
  ]

  const memberFields = ({ forInvite = false } = {}) => (
    <>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Roster member</label>
        <select
          className="pmss-input"
          value={form.memberId}
          onChange={(e) => onMemberChange(e.target.value, { forInvite })}
        >
          {availableMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>
      </div>
      {forInvite ? (
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Invite email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            className="pmss-input"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            autoComplete="email"
            placeholder="name@example.com"
            required
          />
          <p className="text-xs text-neutral-500 mt-1.5">
            The invite (username and temporary password) will be sent to this address.
          </p>
        </div>
      ) : null}
      <div className={`grid grid-cols-1 ${forInvite ? '' : 'sm:grid-cols-2'} gap-3`}>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Username</label>
          <input
            className="pmss-input"
            value={form.username}
            onChange={(e) => setField('username', e.target.value)}
            autoComplete="off"
          />
        </div>
        {!forInvite && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
            <input
              type="email"
              className="pmss-input"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">App role</label>
        <select className="pmss-input" value={form.appRole} onChange={(e) => setField('appRole', e.target.value)}>
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
    </>
  )

  return (
    <div className="max-w-7xl mx-auto">
      <MembersSubnav />

      <PageHeader
        title="User accounts"
        description="Create or invite login accounts linked to the ministry roster"
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="pmss-btn-secondary"
                onClick={openInvite}
                disabled={availableMembers.length === 0}
              >
                <MailPlus className="w-4 h-4" /> Invite user
              </button>
              <button
                type="button"
                className="pmss-btn-primary"
                onClick={openCreate}
                disabled={availableMembers.length === 0}
              >
                <UserPlus className="w-4 h-4" /> Create user
              </button>
            </div>
          ) : null
        }
      />

      {accountsError && <p className="text-sm text-red-700 mb-4 pmss-card p-4">{accountsError}</p>}

      {!canManage && (
        <p className="text-sm text-neutral-500 mb-4 pmss-card p-4">
          View only — Secretary and Coordinator can create, invite, and manage accounts.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          placeholder="Search username, name, or email…"
          className="pmss-input flex-1 max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {accountsLoading ? (
        <p className="text-sm text-neutral-500 pmss-card p-6">Loading accounts…</p>
      ) : (
        <DataTable columns={columns} rows={filtered.map((a) => ({ ...a, id: a.id }))} />
      )}

      {canManage && (
        <div className="mt-4 pmss-card p-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            {filtered.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-2 text-xs border border-neutral-100 rounded-lg px-3 py-2 bg-neutral-50/80"
              >
                <span className="font-medium text-neutral-800">{a.username}</span>
                {a.status === 'Invited' && (
                  <button type="button" className="text-primary-600 font-semibold" onClick={() => resendInvite(a)}>
                    Resend invite
                  </button>
                )}
                {a.status === 'Active' && (
                  <>
                    <button
                      type="button"
                      className="text-primary-600 font-semibold inline-flex items-center gap-1"
                      onClick={() => sendReset(a)}
                    >
                      <KeyRound className="w-3 h-3" /> Reset password
                    </button>
                    <button
                      type="button"
                      className="text-red-600 font-semibold inline-flex items-center gap-1"
                      onClick={() => setStatus(a.id, 'Deactivated')}
                    >
                      <UserX className="w-3 h-3" /> Deactivate
                    </button>
                  </>
                )}
                {a.status === 'Deactivated' && (
                  <button
                    type="button"
                    className="text-emerald-700 font-semibold inline-flex items-center gap-1"
                    onClick={() => setStatus(a.id, 'Active')}
                  >
                    <UserCheck className="w-3 h-3" /> Reactivate
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite user"
        description="Enter the member’s email so we can send their invite with login details."
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="pmss-btn-primary"
              onClick={submitInvite}
              disabled={!form.memberId || submitting}
            >
              {submitting ? 'Sending…' : 'Send invite'}
            </button>
          </>
        }
      >
        {availableMembers.length === 0 ? (
          <p className="text-sm text-neutral-600">Every roster member already has an account.</p>
        ) : (
          <div className="space-y-4">
            {memberFields({ forInvite: true })}
            {formError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-input px-3 py-2" role="alert">
                {formError}
              </p>
            )}
            <p className="text-xs text-neutral-500">
              Linked to {roster.find((m) => m.id === form.memberId)?.name ?? 'selected member'}. In development, the
              temporary password is also shown after invite.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create user"
        description="Creates an Active login immediately with a password you set. The member can sign in right away."
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="pmss-btn-primary"
              onClick={submitCreate}
              disabled={!form.memberId || submitting}
            >
              {submitting ? 'Creating…' : 'Create account'}
            </button>
          </>
        }
      >
        {availableMembers.length === 0 ? (
          <p className="text-sm text-neutral-600">Every roster member already has an account.</p>
        ) : (
          <div className="space-y-4">
            {memberFields({ forInvite: false })}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Password</label>
                <input
                  type="password"
                  className="pmss-input"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  className="pmss-input"
                  value={form.confirmPassword}
                  onChange={(e) => setField('confirmPassword', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            {formError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-input px-3 py-2" role="alert">
                {formError}
              </p>
            )}
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
