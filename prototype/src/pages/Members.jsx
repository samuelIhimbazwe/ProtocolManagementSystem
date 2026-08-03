import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Download, Filter } from 'lucide-react'
import { PageHeader, DataTable, Badge } from '../layouts/AppShell'
import MembersSubnav from '../components/MembersSubnav'
import Modal from '../components/Modal'
import { MEMBERS } from '../data/mock'
import { useRole } from '../context/RoleContext'
import { USE_API } from '../api/config'
import { createMember, fetchMembers } from '../api/schedule'
import { apiDownload } from '../api/client'

const columns = [
  { key: 'name', label: 'Name', render: (r) => <span className="font-medium text-neutral-900">{r.name}</span> },
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

export default function MembersPage() {
  const { permissions } = useRole()
  const [rows, setRows] = useState(USE_API ? [] : MEMBERS)
  const [loading, setLoading] = useState(USE_API)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [toast, setToast] = useState(null)

  const load = () => {
    if (!USE_API) return
    setLoading(true)
    fetchMembers(search)
      .then((d) => setRows(d.members ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || USE_API) return rows
    return rows.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.phone ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const submitAdd = async () => {
    if (!newName.trim()) return
    if (USE_API) {
      try {
        const { member } = await createMember({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          role: 'Member',
        })
        setRows((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)))
        setAddOpen(false)
        setNewName('')
        setNewPhone('')
        setToast('Member added')
      } catch (err) {
        setToast(err.message ?? 'Could not add member')
      }
      return
    }
  }

  const exportCsv = async () => {
    if (USE_API) {
      try {
        await apiDownload('/members/export/csv', 'pmss-members.csv')
      } catch (err) {
        setToast(err.message ?? 'Export failed')
      }
      return
    }
    setToast('Export available in API mode')
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
          placeholder="Search by name or phone…"
          className="pmss-input flex-1 max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && USE_API && load()}
        />
        <button type="button" className="pmss-btn-secondary">
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500 pmss-card p-6">Loading roster…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered.map((m) => ({
            ...m,
            id: m.id,
            link: `/members/${m.id}`,
          }))}
        />
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add member"
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setAddOpen(false)}>
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
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      <p className="text-xs text-neutral-400 mt-4">
        {filtered.length} members ·{' '}
        <Link to="/members/accounts" className="text-primary-600 hover:underline">
          User accounts
        </Link>
      </p>
    </div>
  )
}
