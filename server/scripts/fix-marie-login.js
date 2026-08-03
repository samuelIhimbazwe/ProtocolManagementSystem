import bcrypt from 'bcryptjs'
import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('data/pmss.sqlite')
const member = db
  .prepare(`SELECT id, name FROM members WHERE name = 'Marie Claire Uwamahoro' LIMIT 1`)
  .get()

const hash = await bcrypt.hash('Password123!', 10)
const result = db
  .prepare(
    `UPDATE users
     SET password_hash = ?, status = 'Active', member_id = COALESCE(member_id, ?)
     WHERE username = 'm.uwamahoro' COLLATE NOCASE`,
  )
  .run(hash, member?.id ?? null)

const user = db
  .prepare(`SELECT username, status, member_id, display_name FROM users WHERE username = 'm.uwamahoro' COLLATE NOCASE`)
  .get()

const ok = user
  ? await bcrypt.compare(
      'Password123!',
      db.prepare(`SELECT password_hash FROM users WHERE username = 'm.uwamahoro' COLLATE NOCASE`).get()
        .password_hash,
    )
  : false

console.log(JSON.stringify({ member, changes: result.changes, user, passwordMatches: ok }, null, 2))
