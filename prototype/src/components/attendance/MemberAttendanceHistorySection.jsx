import { Badge, DataTable } from '../../layouts/AppShell'
import { ListView, ListViewTable } from '../list/ListView'
import { attendanceStatusBadgeVariant } from '../../data/memberAttendance'
import BulletinEditable from '../bulletin/BulletinEditable'
import { useEffect, useState } from 'react'

const historyColumns = [
  { key: 'date', label: 'Date' },
  { key: 'service', label: 'Service' },
  { key: 'teamRole', label: 'Role' },
  {
    key: 'status',
    label: 'Status',
    render: (r) => <Badge variant={attendanceStatusBadgeVariant(r.status)}>{r.status}</Badge>,
  },
]

const historyColumnsList = [
  {
    key: 'date',
    label: 'Date',
    render: (r) => <span className="pmss-list-date-pill">{r.date}</span>,
  },
  {
    key: 'service',
    label: 'Service',
    cellClassName: 'pmss-list-cell-primary pmss-list-cell-wrap',
    render: (r) => r.service,
  },
  {
    key: 'teamRole',
    label: 'Role',
    render: (r) => <span className="text-xs text-neutral-600">{r.teamRole}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (r) => <Badge variant={attendanceStatusBadgeVariant(r.status)}>{r.status}</Badge>,
  },
]

/** Appended below the main attendance dashboard — does not replace ministry/monthly UI. */
export default function MemberAttendanceHistorySection({ member, history, format = 'cards' }) {
  if (!member || history.length === 0) return null

  if (format === 'list') {
    return (
      <div className="mt-8">
        <ListView
          title="My attendance history"
          description={`${member.name} — all services on your protocol roster`}
          count={history.length}
        >
          <ListViewTable columns={historyColumnsList} rows={history} />
        </ListView>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h2 className="font-semibold text-neutral-900">My attendance history</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {member.name} · {history.length} services on roster
          </p>
        </div>
      </div>
      <DataTable columns={historyColumns} rows={history} />
    </div>
  )
}

export function MemberAttendanceHistoryBulletinSection({ member, history, canEdit = false }) {
  if (!member || history.length === 0) return null

  const [heading, setHeading] = useState(`My attendance history — ${member.name}`)
  const [headers, setHeaders] = useState({
    date: 'Date',
    service: 'Service',
    role: 'Role',
    status: 'Status',
  })
  const [rows, setRows] = useState(
    (history ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      service: r.service,
      teamRole: r.teamRole,
      status: r.status,
    })),
  )

  useEffect(() => {
    setHeading(`My attendance history — ${member.name}`)
  }, [member.name])

  useEffect(() => {
    setRows(
      (history ?? []).map((r) => ({
        id: r.id,
        date: r.date,
        service: r.service,
        teamRole: r.teamRole,
        status: r.status,
      })),
    )
  }, [history])

  const patchRow = (id, key, value) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, [key]: value } : r)))

  return (
    <section className="mb-6 break-inside-avoid">
      <h3 className="text-sm font-bold uppercase tracking-wide border-b border-neutral-400 pb-1 mb-3 font-serif">
        <BulletinEditable
          value={heading}
          onChange={canEdit ? setHeading : undefined}
          disabled={!canEdit}
        />
      </h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-neutral-400">
            {['date', 'service', 'role', 'status'].map((key) => (
              <th key={key} className="text-left py-1 pr-3 font-semibold">
                <BulletinEditable
                  value={headers[key]}
                  onChange={canEdit ? (v) => setHeaders((h) => ({ ...h, [key]: v })) : undefined}
                  disabled={!canEdit}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-neutral-200">
              <td className="py-1.5 pr-3">
                <BulletinEditable
                  value={row.date}
                  onChange={canEdit ? (v) => patchRow(row.id, 'date', v) : undefined}
                  disabled={!canEdit}
                />
              </td>
              <td className="py-1.5 pr-3">
                <BulletinEditable
                  value={row.service}
                  onChange={canEdit ? (v) => patchRow(row.id, 'service', v) : undefined}
                  disabled={!canEdit}
                />
              </td>
              <td className="py-1.5 pr-3">
                <BulletinEditable
                  value={row.teamRole}
                  onChange={canEdit ? (v) => patchRow(row.id, 'teamRole', v) : undefined}
                  disabled={!canEdit}
                />
              </td>
              <td className="py-1.5">
                <BulletinEditable
                  value={row.status}
                  onChange={canEdit ? (v) => patchRow(row.id, 'status', v) : undefined}
                  disabled={!canEdit}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
