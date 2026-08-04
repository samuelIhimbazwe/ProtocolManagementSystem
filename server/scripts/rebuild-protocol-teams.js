import { initSchema, db } from '../src/db.js'
import { buildMonthlyServiceTeams } from '../src/lib/teamEngine.js'
import { validateSchedulePayload } from '../src/lib/validation.js'
import { loadRulesFromDb, ensureDefaultRules } from '../src/lib/settingsStore.js'
import { protocolNamePool } from '../src/pilotData.js'

await initSchema()
await ensureDefaultRules()

const draft = await db.prepare(`SELECT * FROM schedule_versions WHERE status = 'draft' LIMIT 1`).get()
if (!draft) {
  console.error('No draft schedule found')
  process.exit(1)
}

const payload = JSON.parse(draft.payload_json)
const memberRows = await db.prepare(`SELECT * FROM members`).all()
let names = protocolNamePool(memberRows)
if (names.length < 10) {
  names = [...new Set((payload.teamAssignments ?? []).flatMap((t) => t.members ?? []))]
}

const teams = buildMonthlyServiceTeams(names, payload.services ?? [], { shuffle: false })
payload.teamAssignments = teams
payload.leadershipReview = teams
  .filter((t) => t.kind === 'sunday')
  .slice(0, 4)
  .map((t, i) => ({
    date: t.date,
    tl: t.teamLeader,
    vtl: t.viceTeamLeader,
    status: i < 3 ? 'Approved' : 'Pending approval',
  }))

const rules = await loadRulesFromDb()
const validation = validateSchedulePayload(payload, rules)
payload.validation = validation

await db.prepare(`UPDATE schedule_versions SET payload_json = ? WHERE id = ?`).run(JSON.stringify(payload), draft.id)

const friday = teams.filter((t) => /Friday/i.test(t.serviceName ?? '') || /Friday/i.test(t.date ?? ''))
const byKind = teams.reduce((acc, t) => {
  acc[t.kind] = (acc[t.kind] ?? 0) + 1
  return acc
}, {})

console.log(
  JSON.stringify(
    {
      teams: teams.length,
      fridayTeams: friday.length,
      byKind,
      sizes: [...new Set(teams.map((t) => t.size))],
      sample: teams.slice(0, 6).map((t) => ({ kind: t.kind, size: t.size, name: t.serviceName })),
    },
    null,
    2,
  ),
)
