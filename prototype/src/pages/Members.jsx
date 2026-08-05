import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Download, Upload, Filter, X } from 'lucide-react'
import { PageHeader, DataTable, Badge } from '../layouts/AppShell'
import MembersSubnav from '../components/MembersSubnav'
import Modal from '../components/Modal'
import { MEMBERS, CHOIRS } from '../data/mock'
import { useRole } from '../context/RoleContext'
import { useMembers } from '../context/MembersContext'
import { USE_API } from '../api/config'
import { createMember, fetchMembers, importMembers } from '../api/schedule'
import { apiDownload } from '../api/client'

const CHOIR_OPTIONS = ['', ...CHOIRS.primary, ...CHOIRS.secondary, ...CHOIRS.special]

const ROLE_FILTERS = ['', 'Member', 'President', 'Vice President', 'Secretary', 'Treasurer', 'Coordinator']
const STATUS_FILTERS = ['', 'Active', 'Inactive']

const IMPORT_TEMPLATE = [
  'name,email,phone,role,status,choir',
  '"Jane Doe","jane.doe@example.com","+250 780000000","Member","Active",""',
  '"John Example","john.example@example.com","+250 781111111","Member","Active","Zion Choir"',
].join('\n')

function downloadTemplate() {
  const blob = new Blob([IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pmss-members-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCsvPreview(text) {
  const raw = String(text ?? '').replace(/^\uFEFF/, '').trim()
  if (!raw) return []
  const lines = raw.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const splitLine = (line) => {
    const cells = []
    let cell = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cell += '"'
            i += 1
          } else inQuotes = false
        } else cell += ch
      } else if (ch === '"') inQuotes = true
      else if (ch === ',') {
        cells.push(cell)
        cell = ''
      } else cell += ch
    }
    cells.push(cell)
    return cells
  }
  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines
    .slice(1)
    .map((line) => {
      const cells = splitLine(line)
      const obj = {}
      header.forEach((key, idx) => {
        obj[key] = (cells[idx] ?? '').trim()
      })
      return {
        name: obj.name || obj.full_name || '',
        email: obj.email || obj.email_address || '',
        phone: obj.phone || obj.phone_number || '',
        role: obj.role || 'Member',
        status: obj.status || 'Active',
        choir: obj.choir || '',
        id: obj.id || '',
      }
    })
    .filter((r) => r.name)
}

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
    {
      key: 'email',
      label: 'Email',
      render: (r) => r.email || <span className="text-neutral-400">—</span>,
    },
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
  const { refresh: refreshMembers } = useMembers()
  const [rows, setRows] = useState(USE_API ? [] : MEMBERS)
  const [loading, setLoading] = useState(USE_API)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterChoir, setFilterChoir] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importCsv, setImportCsv] = useState('')
  const [importFileName, setImportFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newChoir, setNewChoir] = useState('')
  const [toast, setToast] = useState(null)
  const columns = useMemo(() => buildColumns(), [])
  const importPreview = useMemo(() => parseCsvPreview(importCsv).slice(0, 8), [importCsv])
  const importCount = useMemo(() => parseCsvPreview(importCsv).length, [importCsv])

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const resetAddForm = () => {
    setNewName('')
    setNewEmail('')
    setNewPhone('')
    setNewChoir('')
  }

  const resetImport = () => {
    setImportCsv('')
    setImportFileName('')
    setImportResult(null)
    setImporting(false)
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
        const hay = `${m.name} ${m.phone ?? ''} ${m.email ?? ''} ${m.role ?? ''} ${m.choir ?? ''}`.toLowerCase()
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
          email: newEmail.trim() || null,
          phone: newPhone.trim() || undefined,
          role: 'Member',
          choir: newChoir.trim() || null,
        })
        setRows((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)))
        setAddOpen(false)
        resetAddForm()
        refreshMembers()
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
      email: newEmail.trim() || null,
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

  const onImportFile = async (file) => {
    if (!file) return
    setImportFileName(file.name)
    setImportResult(null)
    const text = await file.text()
    setImportCsv(text)
  }

  const submitImport = async () => {
    if (!importCsv.trim()) {
      showToast('Choose a CSV file first')
      return
    }
    if (!USE_API) {
      showToast('Import available when connected to the API')
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const result = await importMembers({ csv: importCsv })
      setImportResult(result)
      load()
      refreshMembers()
      const parts = []
      if (result.created) parts.push(`${result.created} added`)
      if (result.updated) parts.push(`${result.updated} updated`)
      if (result.skipped) parts.push(`${result.skipped} skipped`)
      showToast(parts.length ? `Import complete: ${parts.join(', ')}` : 'Import finished')
    } catch (err) {
      showToast(err.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
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
              <button
                type="button"
                className="pmss-btn-secondary"
                onClick={() => {
                  resetImport()
                  setImportOpen(true)
                }}
              >
                <Upload className="w-4 h-4" /> Import
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
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
            <input
              type="email"
              className="pmss-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Used for sign-in when an account is created"
            />
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

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          resetImport()
        }}
        title="Import members"
        description="Upload a CSV roster. Rows with an existing id are updated; new names are added."
        wide
        footer={
          <>
            <button
              type="button"
              className="pmss-btn-secondary"
              onClick={() => {
                setImportOpen(false)
                resetImport()
              }}
            >
              Close
            </button>
            <button
              type="button"
              className="pmss-btn-primary"
              onClick={submitImport}
              disabled={!importCsv.trim() || importing}
            >
              {importing ? 'Importing…' : `Import${importCount ? ` (${importCount})` : ''}`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pmss-btn-secondary text-sm h-9" onClick={downloadTemplate}>
              <Download className="w-4 h-4" /> Download template
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">CSV file</label>
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-neutral-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-800 file:font-medium file:text-sm"
              onChange={(e) => onImportFile(e.target.files?.[0])}
            />
            {importFileName && (
              <p className="text-xs text-neutral-500 mt-1.5">
                {importFileName}
                {importCount ? ` · ${importCount} row${importCount === 1 ? '' : 's'} ready` : ''}
              </p>
            )}
            <p className="text-xs text-neutral-500 mt-2">
              Columns: <span className="font-mono">name, email, phone, role, status, choir</span>
              {' '}(optional <span className="font-mono">id</span> to update an existing member). Email is used for
              sign-in when you create accounts.
            </p>
          </div>

          {importPreview.length > 0 && (
            <div className="rounded-lg border border-neutral-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-neutral-500">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">Name</th>
                    <th className="text-left font-semibold px-3 py-2">Email</th>
                    <th className="text-left font-semibold px-3 py-2">Phone</th>
                    <th className="text-left font-semibold px-3 py-2">Role</th>
                    <th className="text-left font-semibold px-3 py-2">Choir</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((r, i) => (
                    <tr key={`${r.name}-${i}`} className="border-t border-neutral-100">
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2 text-neutral-600">{r.email || '—'}</td>
                      <td className="px-3 py-2 text-neutral-600">{r.phone || '—'}</td>
                      <td className="px-3 py-2">{r.role}</td>
                      <td className="px-3 py-2 text-neutral-600">{r.choir || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importCount > importPreview.length && (
                <p className="text-xs text-neutral-500 px-3 py-2 border-t border-neutral-100">
                  Showing {importPreview.length} of {importCount} rows
                </p>
              )}
            </div>
          )}

          {importResult && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 text-sm space-y-1">
              <p className="font-medium text-neutral-800">Import result</p>
              <p className="text-neutral-600">
                {importResult.created ?? 0} added · {importResult.updated ?? 0} updated ·{' '}
                {importResult.skipped ?? 0} skipped
              </p>
              {(importResult.errors?.length ?? 0) > 0 && (
                <ul className="text-xs text-amber-800 mt-2 space-y-0.5 max-h-28 overflow-y-auto">
                  {importResult.errors.slice(0, 12).map((e, i) => (
                    <li key={`${e.row}-${i}`}>
                      Row {e.row}
                      {e.name ? ` (${e.name})` : ''}: {e.error}
                    </li>
                  ))}
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
