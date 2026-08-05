import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Download, Filter, X } from 'lucide-react'
import { PageHeader, DataTable, Badge } from '../layouts/AppShell'
import MembersSubnav from '../components/MembersSubnav'
import Modal from '../components/Modal'
import { MEMBERS, CHOIRS } from '../data/mock'
import { useRole } from '../context/RoleContext'
import { USE_API } from '../api/config'
import { createMember, fetchMembers } from '../api/schedule'
import { apiDownload } from '../api/client'

const CHOIR_OPTIONS = ['', ...CHOIRS.primary, ...CHOIRS.secondary, ...CHOIRS.special]

const ROLE_FILTERS = ['', 'Member', 'President', 'Vice President', 'Secretary', 'Treasurer', 'Coordinator']
const STATUS_FILTERS = ['', 'Active', 'Inactive']

function buildColumns() {
  return [
    {
      key: 'name',
      label: 'Name',
      render: (r) => (
        <Link to={`/members/${r.id}`} className="font-medium text-primary-700 hover:underline">
          {r.name}
        </Link>
      ),
    },
    { key: 'phone', label: 'Phone' },
    { key: 'role', label: 'Role' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge variant={r.status === 'Active' ? 'success' : 'neutral'}>{r.status}</Badge>,
    },
    {
      key: 'attendanceRate',
      label: 'Attendance rate',
      render: (r) => {
        if (r.attendanceRate == null) {
          return <span className="text-neutral-400">—</span>
        }
        const rate = r.attendanceRate
        const variant = rate >= 90 ? 'success' : rate >= 80 ? 'primary' : rate >= 70 ? 'warning' : 'error'
        return <Badge variant={variant}>{rate}%</Badge>
      },
    },
    {
      key: 'choir',
      label: 'Choir',
      render: (r) =>
        r.choir ? (
          <span className="text-neutral-700 max-w-[180px] truncate block" title={r.choir}>
            {r.choir}
          </span>
        ) : (
          <Badge variant="neutral">None</Badge>
        ),
    },
  ]
}

export default function MembersPage() {
  const { permissions } = useRole()
  const [rows, setRows] = useState(USE_API ? [] : MEMBERS)
  const [loading, setLoading] = useState(USE_API)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterChoir, setFilterChoir] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newChoir, setNewChoir] = useState('')
  const [toast, setToast] = useState(null)
  const columns = useMemo(() => buildColumns(), [])

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const resetAddForm = () => {
    setNewName('')
    setNewPhone('')
    setNewChoir('')
  }

  const load = () => {
    if (!USE_API) return
    setLoading(true)
    fetchMembers()
      .then((d) => setRows(d.members ?? []))
      .catch(() => {
        setRows([])
        showToast('Could not load members')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const activeFilterCount = [filterChoir, filterStatus, filterRole].filter(Boolean).length

  const clearFilters = () => {
    setFilterChoir('')
    setFilterStatus('')
    setFilterRole('')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((m) => {
      if (q) {
        const hay = `${m.name} ${m.phone ?? ''} ${m.role ?? ''} ${m.choir ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filterStatus && m.status !== filterStatus) return false
      if (filterRole && m.role !== filterRole) return false
      if (filterChoir === '__none__') {
        if (m.choir) return false
      } else if (filterChoir && m.choir !== filterChoir) {
        return false
      }
      return true
    })
  }, [rows, search, filterChoir, filterStatus, filterRole])

  const submitAdd = async () => {
    if (!newName.trim()) return
    if (USE_API) {
      try {
        const { member } = await createMember({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          role: 'Member',
          choir: newChoir.trim() || null,
        })
        setRows((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)))
        setAddOpen(false)
        resetAddForm()
        showToast('Member added')
      } catch (err) {
        showToast(err.message ?? 'Could not add member')
      }
      return
    }
    const id = String(Math.max(0, ...rows.map((r) => Number(r.id) || 0)) + 1)
    const member = {
      id,
      name: newName.trim(),
      phone: newPhone.trim() || undefined,
      role: 'Member',
      status: 'Active',
      attendanceRate: null,
      choir: newChoir.trim() || null,
    }
    setRows((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)))
    setAddOpen(false)
    resetAddForm()
    showToast('Member added')
  }

  const exportCsv = async () => {
    if (USE_API) {
      try {
        await apiDownload('/members/export/csv', 'pmss-members.csv')
        showToast('Roster exported (CSV)')
      } catch (err) {
        showToast(err.message ?? 'Export failed')
      }
      return
    }
    showToast('Export available when connected to the API')
  }

  return (
    <div className="max-w-7xl mx-auto">
      <MembersSubnav />

      <PageHeader
        title="Members"
        description="Manage protocol ministry roster"
        actions={
          permissions.manageMembers ? (
            <>
              <button type="button" className="pmss-btn-secondary" onClick={exportCsv}>
                <Download className="w-4 h-4" /> Export
              </button>
              <button type="button" className="pmss-btn-primary" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4" /> Add member
              </button>
            </>
          ) : (
            <button type="button" className="pmss-btn-secondary" onClick={exportCsv}>
              <Download className="w-4 h-4" /> Export
            </button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          placeholder="Search by name, phone, choir, or role…"
          className="pmss-input flex-1 max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={`pmss-btn-secondary ${filtersOpen || activeFilterCount ? 'ring-2 ring-primary-200' : ''}`}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          <Filter className="w-4 h-4" /> Filters
          {activeFilterCount > 0 ? (
            <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary-600 text-white text-[11px] font-bold">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        {activeFilterCount > 0 && (
          <button type="button" className="pmss-btn-secondary" onClick={clearFilters}>
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {filtersOpen && (
        <div className="pmss-card p-4 mb-4 grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Status</label>
            <select className="pmss-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              {STATUS_FILTERS.map((s) => (
                <option key={s || 'all'} value={s}>
                  {s || 'All statuses'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Role</label>
            <select className="pmss-input" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              {ROLE_FILTERS.map((r) => (
                <option key={r || 'all'} value={r}>
                  {r || 'All roles'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Choir</label>
            <select className="pmss-input" value={filterChoir} onChange={(e) => setFilterChoir(e.target.value)}>
              <option value="">All choirs</option>
              <option value="__none__">None</option>
              {CHOIR_OPTIONS.filter(Boolean).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500 pmss-card p-6">Loading roster…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered.map((m) => ({ ...m, id: m.id }))}
          emptyTitle="No members match"
          emptyDescription="Try a different search or clear filters."
        />
      )}

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          resetAddForm()
        }}
        title="Add member"
        footer={
          <>
            <button
              type="button"
              className="pmss-btn-secondary"
              onClick={() => {
                setAddOpen(false)
                resetAddForm()
              }}
            >
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={submitAdd} disabled={!newName.trim()}>
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full name</label>
            <input className="pmss-input" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone</label>
            <input className="pmss-input" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Choir</label>
            <select className="pmss-input" value={newChoir} onChange={(e) => setNewChoir(e.target.value)}>
              {CHOIR_OPTIONS.map((c) => (
                <option key={c || 'none'} value={c}>
                  {c || 'None — not in a choir'}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1.5">Pick their choir, or None if they are protocol-only.</p>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      <p className="text-xs text-neutral-400 mt-4">
        {filtered.length}
        {filtered.length !== rows.length ? ` of ${rows.length}` : ''} members ·{' '}
        <Link to="/members/accounts" className="text-primary-600 hover:underline">
          User accounts
        </Link>
      </p>
    </div>
  )
}
