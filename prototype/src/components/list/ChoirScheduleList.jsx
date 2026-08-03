import { Badge } from '../../layouts/AppShell'
import ChoirAssignmentItems from '../../components/ChoirAssignmentItems'
import ChoirServiceToolbar from '../ChoirServiceToolbar'
import { ListView, ListViewTable } from './ListView'

export default function ChoirScheduleList({
  assignments,
  canEdit,
  onRegenerate,
  onEdit,
  onRemoveChoir,
  onReplaceChoir,
}) {
  const rows = assignments.map((row, index) => ({ ...row, id: row._key, _index: index }))

  const columns = [
    {
      key: 'date',
      label: 'Date',
      width: '7rem',
      render: (r) => <span className="pmss-list-date-pill">{r.date}</span>,
    },
    {
      key: 'service',
      label: 'Service',
      cellClassName: 'pmss-list-cell-primary pmss-list-cell-wrap',
      render: (r) => r.service,
    },
    {
      key: 'choirs',
      label: 'Choirs',
      cellClassName: 'pmss-list-cell-wrap',
      render: (r) => (
        <ChoirAssignmentItems
          choirs={r.choirs}
          canEdit={canEdit}
          compact
          onRemove={(name) => onRemoveChoir(r._index, name)}
          onReplace={(name) => onReplaceChoir(r._index, name)}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge variant={r.status === 'Assigned' ? 'success' : 'warning'}>{r.status}</Badge>,
    },
  ]

  if (canEdit) {
    columns.push({
      key: '_actions',
      label: '',
      width: '11rem',
      align: 'right',
      cellClassName: 'pmss-list-cell-actions',
      render: (r) => (
        <ChoirServiceToolbar
          onRegenerate={() => onRegenerate(r._index)}
          onEdit={() => onEdit(r._index)}
        />
      ),
    })
  }

  return (
    <ListView title="Choir assignments" description="August 2026 schedule" count={rows.length}>
      <ListViewTable columns={columns} rows={rows} emptyMessage="No choir assignments yet." />
    </ListView>
  )
}
