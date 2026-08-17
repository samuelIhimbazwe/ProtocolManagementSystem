import { initSchema, db } from '../src/db.js'
import { purgeSeededDemoPeople } from '../src/seed.js'

await initSchema()
const result = await purgeSeededDemoPeople()
const remaining = await db.prepare(`SELECT name FROM members ORDER BY name`).all()
console.log(JSON.stringify({ ...result, remainingMembers: remaining.length }, null, 2))
