export const TEAM_LIMITS = { min: 4, max: 10 }

export function normalizeTeam(team) {
  const members = [...(team.members ?? [])]
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
