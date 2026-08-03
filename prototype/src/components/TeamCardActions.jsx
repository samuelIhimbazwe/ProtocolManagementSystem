import { Repeat2, UserMinus, UserPlus } from 'lucide-react'

const actions = [
  { id: 'add', label: 'Add member', icon: UserPlus, style: 'primary' },
  { id: 'remove', label: 'Remove', icon: UserMinus, style: 'danger' },
  { id: 'replace', label: 'Replace', icon: Repeat2, style: 'secondary' },
]

export default function TeamCardActions({ onAction, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ id, label, icon: Icon, style }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onAction(id)}
          className={`pmss-btn-chip pmss-btn-chip-${style} disabled:opacity-40 disabled:pointer-events-none`}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
          {label}
        </button>
      ))}
    </div>
  )
}

export const TEAM_LIMITS = { min: 4, max: 10 }

export function normalizeTeam(team) {
  const members = [...team.members]
  let { teamLeader, viceTeamLeader } = team
  if (teamLeader && !members.includes(teamLeader)) {
    teamLeader = members[0] ?? null
  }
  if (viceTeamLeader && !members.includes(viceTeamLeader)) {
    viceTeamLeader = members.find((m) => m !== teamLeader) ?? null
  }
  return {
    ...team,
    members,
    size: members.length,
    teamLeader,
    viceTeamLeader,
  }
}

export function shuffleCopy(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Demo: auto-build a roster for one service from the protocol pool */
export function buildDemoTeam(pool, targetSize = 8) {
  const picked = shuffleCopy(pool).slice(0, Math.min(targetSize, pool.length, TEAM_LIMITS.max))
  return normalizeTeam({
    members: picked,
    size: picked.length,
    teamLeader: picked[0] ?? null,
    viceTeamLeader: picked[1] ?? null,
  })
}
