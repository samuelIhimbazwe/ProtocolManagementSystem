import { Badge } from '../../layouts/AppShell'
import TeamCardActions from '../TeamCardActions'
import TeamMemberItems from '../TeamMemberItems'
import { FULL_ROSTER_TEAM_SIZE, isFullRosterKind } from '../../data/teamEngine'
import { ListView, ListViewTable, ListViewLeaderCell, ListViewSizeBadge } from './ListView'

export default function ServiceTeamsList({ teams, canEdit, onAction, onRemoveMember, onReplaceMember }) {
  const rows = teams.map((row, index) => ({ ...row, id: row._key, _index: index }))

  const columns = [
    {
      key: 'date',
      label: 'Service',
      cellClassName: 'pmss-list-cell-wrap min-w-[11rem]',
      render: (t) => (
        <div className="space-y-2">
          <p className="pmss-list-cell-primary leading-snug">{t.date}</p>
          <div className="flex flex-wrap gap-1">
            {t.kind === 'sunday' && <Badge variant="primary">Sunday</Badge>}
            {t.kind === 'tuesday' && <Badge variant="primary">Tuesday</Badge>}
            {t.kind === 'igaburo' && <Badge variant="primary">Igaburo</Badge>}
            {t.kind === 'weekday' && <Badge variant="neutral">Weekday</Badge>}
            {isFullRosterKind(t.kind) && t.size === FULL_ROSTER_TEAM_SIZE && (
              <Badge variant="success">Full roster</Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'leaders',
      label: 'Leadership',
      render: (t) => <ListViewLeaderCell teamLeader={t.teamLeader} viceTeamLeader={t.viceTeamLeader} />,
    },
    {
      key: 'members',
      label: 'Roster',
      cellClassName: 'pmss-list-cell-wrap',
      render: (t) => (
        <TeamMemberItems
          members={t.members}
          teamLeader={t.teamLeader}
          viceTeamLeader={t.viceTeamLeader}
          canEdit={canEdit}
          listMax={6}
          onRemove={(name) => onRemoveMember(t._index, name)}
          onReplace={(name) => onReplaceMember(t._index, name)}
        />
      ),
    },
    {
      key: 'size',
      label: 'Size',
      align: 'right',
      render: (t) => (
        <ListViewSizeBadge size={t.size} max={isFullRosterKind(t.kind) ? FULL_ROSTER_TEAM_SIZE : undefined} />
      ),
    },
  ]

  if (canEdit) {
    columns.push({
      key: '_actions',
      label: 'Actions',
      headerClassName: 'pmss-list-cell-actions',
      cellClassName: 'pmss-list-cell-actions',
      render: (r) => <TeamCardActions onAction={(actionId) => onAction(r._index, actionId)} />,
    })
  }

  return (
    <ListView title="Service teams" description="Per-service protocol rosters" count={rows.length}>
      <ListViewTable columns={columns} rows={rows} emptyMessage="No teams built yet." />
    </ListView>
  )
}
