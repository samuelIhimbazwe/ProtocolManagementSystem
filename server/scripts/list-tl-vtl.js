import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('C:/Users/ihimb/OneDrive/Documents/PMS/server/data/pmss.sqlite')
const today = process.env.PMSS_TODAY ?? '2026-08-02'
const pub = db
  .prepare(
    `SELECT payload_json, month_key FROM schedule_versions
     WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`,
  )
  .get()

if (!pub) {
  console.log('NO_PUBLISHED')
  process.exit(0)
}

const p = JSON.parse(pub.payload_json)
const teams = p.teamAssignments || []
console.log('today', today)
console.log('month', pub.month_key, 'teams', teams.length)

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const active = []
for (const t of teams) {
  const sd = t.serviceDate
  if (!sd) continue
  const starts = addDays(sd, -2)
  const ends = addDays(sd, 1)
  const inWindow = today >= starts && today <= ends
  if (inWindow) {
    active.push({
      date: sd,
      service: t.serviceName,
      tl: t.teamLeader,
      vtl: t.viceTeamLeader,
      starts,
      ends,
    })
  }
}

console.log('ACTIVE_DUTIES', active.length)
for (const a of active) {
  console.log(`${a.date} ${a.service} | TL=${a.tl} | VTL=${a.vtl} | window ${a.starts}->${a.ends}`)
}

const names = [...new Set(active.flatMap((a) => [a.tl, a.vtl].filter(Boolean)))]
console.log('ACTIVE_LEADER_NAMES')
for (const n of names) {
  const m = db.prepare(`SELECT id, name FROM members WHERE name = ?`).get(n)
  const u = m
    ? db.prepare(`SELECT username FROM users WHERE member_id = ?`).get(m.id)
    : null
  console.log(`${n} | memberId=${m?.id ?? 'none'} | user=${u?.username ?? 'NO_LOGIN'}`)
}

const memberUsers = db
  .prepare(
    `SELECT u.username, u.display_name, m.name
     FROM users u LEFT JOIN members m ON m.id = u.member_id
     WHERE u.app_role = 'member'`,
  )
  .all()
console.log('MEMBER_USERS')
for (const u of memberUsers) console.log(`${u.username} | ${u.name}`)
