import { DatabaseSync } from 'node:sqlite'

/** Assign seeded member logins as TL/VTL on active duty services for demo. */
const db = new DatabaseSync('data/pmss.sqlite')
const pub = db
  .prepare(
    `SELECT id, payload_json FROM schedule_versions
     WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`,
  )
  .get()
if (!pub) {
  console.error('No published schedule')
  process.exit(1)
}

const payload = JSON.parse(pub.payload_json)
const teams = payload.teamAssignments ?? []
const jean = 'Jean Bosco Ndayisaba'
const marie = 'Marie Claire Uwamahoro'

function putLeader(team, role, name) {
  const members = [...(team.members ?? [])]
  if (!members.includes(name)) {
    // swap first non-leader slot or append within size
    if (members.length >= 10) members[members.length - 1] = name
    else members.push(name)
  }
  if (role === 'TL') {
    team.teamLeader = name
    if (team.viceTeamLeader === name) {
      team.viceTeamLeader = members.find((m) => m !== name) ?? null
    }
  } else {
    team.viceTeamLeader = name
    if (team.teamLeader === name) {
      team.teamLeader = members.find((m) => m !== name) ?? null
    }
  }
  team.members = members
  team.size = members.length
}

const s1 = teams.find((t) => t.serviceDate === '2026-08-02' && t.serviceName === 'Sunday Service 1')
const s2 = teams.find((t) => t.serviceDate === '2026-08-02' && t.serviceName === 'Sunday Service 2')
if (!s1 || !s2) {
  console.error('Could not find Aug 2 Sunday teams')
  process.exit(1)
}

putLeader(s1, 'TL', jean)
putLeader(s1, 'VTL', marie)
putLeader(s2, 'VTL', jean)

db.prepare(`UPDATE schedule_versions SET payload_json = ? WHERE id = ?`).run(
  JSON.stringify(payload),
  pub.id,
)

const draft = db.prepare(`SELECT id, payload_json FROM schedule_versions WHERE status = 'draft' LIMIT 1`).get()
if (draft) {
  const dp = JSON.parse(draft.payload_json)
  const dTeams = dp.teamAssignments ?? []
  const d1 = dTeams.find((t) => t.serviceDate === '2026-08-02' && t.serviceName === 'Sunday Service 1')
  const d2 = dTeams.find((t) => t.serviceDate === '2026-08-02' && t.serviceName === 'Sunday Service 2')
  if (d1) {
    putLeader(d1, 'TL', jean)
    putLeader(d1, 'VTL', marie)
  }
  if (d2) putLeader(d2, 'VTL', jean)
  db.prepare(`UPDATE schedule_versions SET payload_json = ? WHERE id = ?`).run(
    JSON.stringify(dp),
    draft.id,
  )
}

console.log('Updated:')
console.log('Sunday Service 1 TL=', s1.teamLeader, 'VTL=', s1.viceTeamLeader)
console.log('Sunday Service 2 TL=', s2.teamLeader, 'VTL=', s2.viceTeamLeader)
console.log('Login as j.ndayisaba (TL) or m.uwamahoro (VTL) with Password123!')
