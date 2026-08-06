import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, MailPlus, UserPlus, UserCheck, UserX, Users } from 'lucide-react'
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
import { inviteUser, createUser, patchUser, fetchMembers, bulkCreateUsersFromRoster } from '../api/schedule'

/** Password field with show/hide — uses standard pmss-input styling. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = 'new-password',
  visible,
  onToggleVisible,
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="pmss-input pr-10"
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
          onClick={onToggleVisible}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

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
    email: m.email ?? '',
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
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPassword, setBulkPassword] = useState('')
  const [bulkConfirm, setBulkConfirm] = useState('')
  const [bulkShowPassword, setBulkShowPassword] = useState(false)
  const [createShowPassword, setCreateShowPassword] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkSelected, setBulkSelected] = useState(() => new Set())
  const [bulkFilter, setBulkFilter] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)

  const availableMembers = useMemo(() => membersWithoutAccount(accounts, roster), [accounts, roster])
  const bulkReadyMembers = useMemo(
    () => availableMembers.filter((m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(m.email ?? '').trim())),
    [availableMembers],
  )
  const bulkReadyIds = useMemo(() => new Set(bulkReadyMembers.map((m) => String(m.id))), [bulkReadyMembers])
  const filteredBulkMembers = useMemo(() => {
    const q = bulkFilter.trim().toLowerCase()
    if (!q) return availableMembers
    return availableMembers.filter(
      (m) =>
        String(m.name ?? '').toLowerCase().includes(q) ||
        String(m.email ?? '').toLowerCase().includes(q) ||
        String(m.role ?? '').toLowerCase().includes(q),
    )
  }, [availableMembers, bulkFilter])
  const selectedReadyCount = useMemo(
    () => [...bulkSelected].filter((id) => bulkReadyIds.has(id)).length,
    [bulkSelected, bulkReadyIds],
  )
  const allReadySelected =
    bulkReadyMembers.length > 0 && bulkReadyMembers.every((m) => bulkSelected.has(String(m.id)))

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
      email: clearEmail ? '' : member.email || `${username}@church.internal`,
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
    setCreateShowPassword(false)
    if (first) {
      const username = suggestUsername(first.name)
      setForm({
        memberId: first.id,
        username,
        email: first.email || `${username}@church.internal`,
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
    if (!isValidEmail(form.email)) {
      setFormError('A valid email is required for login')
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

  const openBulk = () => {
    setBulkPassword('')
    setBulkConfirm('')
    setBulkShowPassword(false)
    setBulkResult(null)
    setFormError('')
    setBulkFilter('')
    // Pre-select everyone who can receive an account (has roster email).
    setBulkSelected(new Set(bulkReadyMembers.map((m) => String(m.id))))
    setBulkOpen(true)
  }

  const toggleBulkMember = (memberId, canSelect) => {
    if (!canSelect) return
    const id = String(memberId)
    setBulkSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllReady = () => {
    if (allReadySelected) {
      setBulkSelected(new Set())
      return
    }
    setBulkSelected(new Set(bulkReadyMembers.map((m) => String(m.id))))
  }

  const submitBulk = async () => {
    if (bulkPassword.length < 8) {
      setFormError('Password must be at least 8 characters')
      return
    }
    if (bulkPassword !== bulkConfirm) {
      setFormError('Passwords do not match')
      return
    }
    const memberIds = [...bulkSelected].filter((id) => bulkReadyIds.has(id))
    if (memberIds.length === 0) {
      setFormError('Select at least one member with a roster email')
      return
    }
    if (!USE_API) {
      setFormError('Bulk create requires the API')
      return
    }
    setSubmitting(true)
    setFormError('')
    setBulkResult(null)
    try {
      const result = await bulkCreateUsersFromRoster({
        password: bulkPassword,
        onlyActive: true,
        memberIds,
      })
      setBulkResult(result)
      await reloadAccounts()
      const createdIds = new Set((result.users ?? []).map((u) => String(u.memberId)))
      setBulkSelected((prev) => new Set([...prev].filter((id) => !createdIds.has(id))))
      const parts = []
      if (result.created) parts.push(`${result.created} created`)
      if (result.skipped) parts.push(`${result.skipped} skipped`)
      showToast(parts.length ? `Roster accounts: ${parts.join(', ')}` : 'No new accounts created')
    } catch (err) {
      setFormError(err.message ?? 'Bulk create failed')
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
                onClick={openBulk}
                disabled={availableMembers.length === 0}
              >
                <Users className="w-4 h-4" /> Create all accounts
              </button>
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
              <PasswordField
                id="create-password"
                label="Password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="Type the password to use"
                visible={createShowPassword}
                onToggleVisible={() => setCreateShowPassword((v) => !v)}
              />
              <PasswordField
                id="create-confirm-password"
                label="Confirm password"
                value={form.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
                placeholder="Re-type the same password"
                visible={createShowPassword}
                onToggleVisible={() => setCreateShowPassword((v) => !v)}
              />
            </div>
            {formError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-input px-3 py-2" role="alert">
                {formError}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Create member accounts"
        description="Select roster members who do not have a login yet. Accounts use their roster name and email, with one shared temporary password."
        xl
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setBulkOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="pmss-btn-primary"
              onClick={submitBulk}
              disabled={submitting || selectedReadyCount === 0}
            >
              {submitting
                ? 'Creating…'
                : `Create ${selectedReadyCount} account${selectedReadyCount === 1 ? '' : 's'}`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <PasswordField
              id="bulk-password"
              label="Temporary password"
              value={bulkPassword}
              onChange={(e) => setBulkPassword(e.target.value)}
              placeholder="Type the shared password"
              visible={bulkShowPassword}
              onToggleVisible={() => setBulkShowPassword((v) => !v)}
            />
            <PasswordField
              id="bulk-confirm-password"
              label="Confirm password"
              value={bulkConfirm}
              onChange={(e) => setBulkConfirm(e.target.value)}
              placeholder="Re-type the same password"
              visible={bulkShowPassword}
              onToggleVisible={() => setBulkShowPassword((v) => !v)}
            />
          </div>
          <p className="text-xs text-neutral-500">
            Choose any temporary password (at least 8 characters). Use the eye icon to show or hide it. Every selected
            member gets this same password and must change it on first login.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <input
              type="search"
              placeholder="Search name, email, or role…"
              className="pmss-input flex-1"
              value={bulkFilter}
              onChange={(e) => setBulkFilter(e.target.value)}
            />
            <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-neutral-300"
                checked={allReadySelected}
                onChange={toggleSelectAllReady}
                disabled={bulkReadyMembers.length === 0}
              />
              Select all with email ({bulkReadyMembers.length})
            </label>
          </div>

          <p className="text-xs text-neutral-500">
            {availableMembers.length} without an account · {selectedReadyCount} selected. Sign-in uses roster email;
            members must change the temporary password on first login.
          </p>

          {availableMembers.length > bulkReadyMembers.length && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-input px-3 py-2">
              {availableMembers.length - bulkReadyMembers.length} member
              {availableMembers.length - bulkReadyMembers.length === 1 ? '' : 's'} missing email cannot be selected —
              add email on the Members roster first.
            </p>
          )}

          <div className="rounded-lg border border-neutral-200 overflow-hidden max-h-[min(42vh,420px)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 border-b border-neutral-200 z-[1]">
                <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="w-10 px-3 py-2 font-semibold"> </th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredBulkMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">
                      {availableMembers.length === 0
                        ? 'Every roster member already has an account.'
                        : 'No members match this search.'}
                    </td>
                  </tr>
                ) : (
                  filteredBulkMembers.map((m) => {
                    const id = String(m.id)
                    const email = String(m.email ?? '').trim()
                    const canSelect = bulkReadyIds.has(id)
                    const checked = bulkSelected.has(id)
                    return (
                      <tr
                        key={id}
                        role="button"
                        tabIndex={canSelect ? 0 : -1}
                        aria-pressed={checked}
                        className={`hover:bg-primary-50/40 ${canSelect ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                        onClick={() => toggleBulkMember(id, canSelect)}
                        onKeyDown={(e) => {
                          if (!canSelect) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleBulkMember(id, true)
                          }
                        }}
                      >
                        <td className="px-3 py-2.5 align-middle">
                          <input
                            type="checkbox"
                            className="rounded border-neutral-300 pointer-events-none"
                            checked={checked && canSelect}
                            disabled={!canSelect}
                            readOnly
                            tabIndex={-1}
                            aria-hidden="true"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-neutral-900">{m.name}</td>
                        <td className="px-3 py-2.5 text-neutral-700 font-mono text-xs">
                          {email || <span className="text-amber-700 font-sans">No email</span>}
                        </td>
                        <td className="px-3 py-2.5 text-neutral-600">{m.role}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {formError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-input px-3 py-2" role="alert">
              {formError}
            </p>
          )}
          {bulkResult && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 text-sm space-y-2">
              <p className="font-medium text-neutral-800">
                {bulkResult.created ?? 0} created · {bulkResult.skipped ?? 0} skipped
                {(bulkResult.errors?.length ?? 0) > 0 ? ` · ${bulkResult.errors.length} errors` : ''}
              </p>
              {(bulkResult.users?.length ?? 0) > 0 && (
                <ul className="text-xs text-neutral-700 max-h-40 overflow-y-auto space-y-0.5 font-mono">
                  {bulkResult.users.slice(0, 40).map((u) => (
                    <li key={u.id}>
                      {u.email} — {u.displayName}
                    </li>
                  ))}
                  {bulkResult.users.length > 40 && (
                    <li>…and {bulkResult.users.length - 40} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
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
