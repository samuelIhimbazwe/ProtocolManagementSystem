import { initSchema } from '../src/db.js'
import { wipeRosterAndDemoPeople } from '../src/seed.js'

await initSchema()
await wipeRosterAndDemoPeople()
