import { Badge } from '../../layouts/AppShell'
import { ListView, ListViewTable, ListViewSummaryGrid } from './ListView'

export default function AttendanceDashboardList({ monthly, recentRows, onViewService }) {
  const summary = [
    { label: 'Attendance rate', value: monthly.rate, tone: 0 },
    { label: 'Present', value: String(monthly.present), tone: 'present' },
    { label: 'Half present', value: String(monthly.halfPresent), tone: 'half' },
    { label: 'Quarter present', value: String(monthly.quarterPresent), tone: 'quarter' },
    { label: 'Absent', value: String(monthly.absent), tone: 'absent' },
  ]

  return (
    <div className="space-y-8">
      <ListView title="Monthly overview" description="August 2026 participation">
        <div className="p-4 md:p-5">
          <ListViewSummaryGrid items={summary} />
        </div>
      </ListView>

      <ListView title="Recent sessions" description="Submitted attendance by service" count={recentRows.length}>
        <ListViewTable
          columns={[
            {
              key: 'service',
              label: 'Service',
              cellClassName: 'pmss-list-cell-primary',
              render: (r) => r.service,
            },
            {
              key: 'date',
              label: 'Date',
              render: (r) => <span className="pmss-list-date-pill">{r.date}</span>,
            },
            {
              key: 'rate',
              label: 'Rate',
              render: (r) => <span className="font-semibold text-primary-700 tabular-nums">{r.rate}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <Badge variant={r.status === 'Submitted' ? 'success' : 'warning'}>{r.status}</Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (r) =>
                onViewService ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary-700 hover:text-primary-800"
                    onClick={() => onViewService(r)}
                  >
                    View service
                  </button>
                ) : null,
            },
          ]}
          rows={recentRows}
        />
      </ListView>
    </div>
  )
}
