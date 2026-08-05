import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initSchema } from './db.js'
import { seedDatabase } from './seed.js'
import authRoutes from './routes/auth.js'
import scheduleRoutes from './routes/schedules.js'
import userRoutes from './routes/users.js'
import memberRoutes from './routes/members.js'
import settingsRoutes from './routes/settings.js'
import attendanceRoutes from './routes/attendance.js'
import dashboardRoutes from './routes/dashboard.js'
import reportsRoutes from './routes/reports.js'
import notificationsRoutes from './routes/notifications.js'
import financeRoutes from './routes/finance.js'
import serviceReportRoutes from './routes/serviceReports.js'
import officeReportRoutes from './routes/officeReports.js'
import configRoutes from './routes/config.js'
import { mountWebApp } from './staticWeb.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

await initSchema()
await seedDatabase()

const app = express()
const port = Number(process.env.PORT ?? 3001)

const corsOriginEnv = process.env.CORS_ORIGIN?.trim()
const corsOrigin = !corsOriginEnv
  ? true
  : corsOriginEnv.includes(',')
    ? corsOriginEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : corsOriginEnv

app.use(cors({ origin: corsOrigin, credentials: true }))
app.use(express.json({ limit: '8mb' }))

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'pmss-api',
    db: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
  })
})

app.use('/auth', authRoutes)
app.use('/schedules', scheduleRoutes)
app.use('/users', userRoutes)
app.use('/members', memberRoutes)
app.use('/settings', settingsRoutes)
app.use('/attendance', attendanceRoutes)
app.use('/config', configRoutes)
app.use('/dashboard', dashboardRoutes)
app.use('/reports', reportsRoutes)
app.use('/notifications', notificationsRoutes)
app.use('/finance', financeRoutes)
app.use('/service-reports', serviceReportRoutes)
app.use('/office-reports', officeReportRoutes)

const serveWeb =
  process.env.SERVE_WEB === '1' ||
  (process.env.NODE_ENV === 'production' && process.env.SERVE_WEB !== '0')
if (serveWeb) {
  mountWebApp(app)
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => {
  const mode = serveWeb ? 'API + web UI' : 'API only'
  console.log(`TMS listening on http://localhost:${port} (${mode})`)
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production')) {
    console.warn('WARNING: Set a strong JWT_SECRET in production.')
  }
})
