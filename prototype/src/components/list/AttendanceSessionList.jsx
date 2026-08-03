import { ListView, ListViewTable, ListViewStatusPicker } from './ListView'

const STATUSES = ['Present', 'Half Present', 'Quarter Present', 'Absent']

function initials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function AttendanceSessionList({ members, statuses, onStatusChange }) {
  const rows = members.map((m) => ({ ...m, id: m.id }))

  return (
    <ListView title="Team attendance" description="Tap a status for each member" count={rows.length}>
      <ListViewTable
        columns={[
          {
            key: 'name',
            label: 'Member',
            render: (m) => (
              <div className="pmss-list-member-cell">
                <span className="pmss-list-member-avatar" aria-hidden>
                  {initials(m.name)}
                </span>
                <span className="pmss-list-cell-primary">{m.name}</span>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            cellClassName: 'pmss-list-cell-wrap min-w-[20rem]',
            render: (m) => (
              <ListViewStatusPicker
                statuses={STATUSES}
                value={statuses[m.id]}
                onChange={(st) => onStatusChange(m.id, st)}
              />
            ),
          },
        ]}
        rows={rows}
      />
    </ListView>
  )
}
