import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, MailPlus, UserCheck, UserX } from 'lucide-react'
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
  memberLabel,
} from '../data/userAccounts'
import { USE_API } from '../api/config'
import { fetchUserAccounts } from '../api/client'
import { inviteUser, patchUser } from '../api/schedule'

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

function statusVariant(status) {
  if (status === 'Active') return 'success'
  if (status === 'Invited') return 'warning'
  return 'neutral'
}

export default function UserAccountsPage() {
  const { permissions } = useRole()
  const canManage = permissions.manageUsers

  const [accounts, setAccounts] = useState(() => (USE_API ? [] : loadUserAccounts()))
  const [accountsLoading, setAccountsLoading] = useState(USE_API)
  const [accountsError, setAccountsError] = useState(null)
  const [search, setSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteMemberId, setInviteMemberId] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [toast, setToast] = useState(null)

  const availableMembers = useMemo(() => membersWithoutAccount(accounts), [accounts])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
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
    reloadAccounts()
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
    setInviteMemberId(first?.id ?? '')
    setInviteRole(first?.role === 'Member' ? 'member' : ROLES.find((r) => r.label === first?.role)?.id ?? 'member')
    setInviteOpen(true)
  }

  const submitInvite = async () => {
    const member = MEMBERS.find((m) => m.id === inviteMemberId)
    if (!member) return
    if (USE_API) {
      try {
        const res = await inviteUser({ memberId: member.id, appRole: inviteRole })
        await reloadAccounts()
        showToast(
          res.demoTempPassword
            ? `Invite created for ${member.name}. Temporary password: ${res.demoTempPassword}`
            : `Invite sent to ${member.name}`,
        )
        setInviteOpen(false)
      } catch (err) {
        showToast(err.message ?? 'Invite failed')
      }
      return
    }
    const parts = member.name.toLowerCase().split(/\s+/).filter(Boolean)
    const un =
      parts.length >= 2
        ? `${parts[0][0]}.${parts[parts.length - 1]}`.replace(/[^a-z.]/g, '')
        : 'new.user'
    const newAccount = {
      id: `u-new-${Date.now()}`,
      username: un,
      email: `${un}@church.internal`,
      memberId: member.id,
      displayName: member.name,
      appRole: inviteRole,
      status: 'Invited',
      lastLogin: null,
      invitedAt: new Date().toISOString().slice(0, 10),
    }
    persist([...accounts, newAccount])
    showToast(`Invite sent to ${member.name}`)
    setInviteOpen(false)
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
    showToast(`Use Forgot password on login — reset link for ${account.username} (dev: POST /auth/forgot-password)`)
  }

  const resendInvite = (account) => {
    showToast(`Invite pending for ${account.email}`)
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

  return (
    <div className="max-w-7xl mx-auto">
      <MembersSubnav />

      <PageHeader
        title="User accounts"
        description="PMSS login accounts linked to ministry members — invite, deactivate, and password reset"
        actions={
          canManage ? (
            <button
              type="button"
              className="pmss-btn-primary"
              onClick={openInvite}
              disabled={availableMembers.length === 0}
            >
              <MailPlus className="w-4 h-4" /> Invite user
            </button>
          ) : null
        }
      />

      {USE_API && (
        <p className="text-sm text-neutral-600 mb-4 pmss-card p-4 border-l-4 border-primary-500">
          Pilot API — accounts sync with the server. Invite and deactivate update{' '}
          <code className="text-xs">/users</code> immediately.
        </p>
      )}

      {accountsError && (
        <p className="text-sm text-red-700 mb-4 pmss-card p-4">{accountsError}</p>
      )}

      {!canManage && (
        <p className="text-sm text-neutral-500 mb-4 pmss-card p-4">
          View only — Secretary and Coordinator can invite and manage accounts.
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
        <Link to="/login" className="pmss-btn-secondary text-sm inline-flex items-center justify-center">
          Open sign-in page
        </Link>
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
        description="Creates a login linked to a roster member. They receive email to set a password."
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={submitInvite} disabled={!inviteMemberId}>
              Send invite
            </button>
          </>
        }
      >
        {availableMembers.length === 0 ? (
          <p className="text-sm text-neutral-600">Every roster member already has an account.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Roster member</label>
              <select className="pmss-input" value={inviteMemberId} onChange={(e) => setInviteMemberId(e.target.value)}>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">App role (permissions)</label>
              <select className="pmss-input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-neutral-400">
              Linked profile: {memberLabel(inviteMemberId)} · Sign-in at{' '}
              <Link to="/login" className="text-primary-600">
                /login
              </Link>
            </p>
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
