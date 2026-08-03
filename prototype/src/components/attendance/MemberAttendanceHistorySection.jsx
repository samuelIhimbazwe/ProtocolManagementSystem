import { Badge, DataTable } from '../../layouts/AppShell'
import { ListView, ListViewTable } from '../list/ListView'
import { attendanceStatusBadgeVariant } from '../../data/memberAttendance'

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

export function MemberAttendanceHistoryBulletinSection({ member, history }) {
  if (!member || history.length === 0) return null

  return (
    <section className="mb-6 break-inside-avoid">
      <h3 className="text-sm font-bold uppercase tracking-wide border-b border-neutral-400 pb-1 mb-3 font-serif">
        My attendance history — {member.name}
      </h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-neutral-400">
            <th className="text-left py-1 pr-3 font-semibold">Date</th>
            <th className="text-left py-1 pr-3 font-semibold">Service</th>
            <th className="text-left py-1 pr-3 font-semibold">Role</th>
            <th className="text-left py-1 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.id} className="border-b border-neutral-200">
              <td className="py-1.5 pr-3">{row.date}</td>
              <td className="py-1.5 pr-3">{row.service}</td>
              <td className="py-1.5 pr-3">{row.teamRole}</td>
              <td className="py-1.5">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
