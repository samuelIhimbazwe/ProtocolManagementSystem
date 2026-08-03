# PMSS API (M1 pilot foundation)

Express API for auth, scheduling, attendance, finance, and reports.

- **Local default:** SQLite via Node [`node:sqlite`](https://nodejs.org/api/sqlite.html) (Node **22.14+**)
- **Production:** Postgres via `DATABASE_URL` (Neon) — see [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for Render + Vercel

## Setup

```bash
cd server
cp .env.example .env
npm install
npm run seed    # optional — auto-seeds on first start
npm run dev
```

Default URL: `http://localhost:3001`

**Postgres (Neon):** set `DATABASE_URL` in `.env`. Schema is created on startup.

**Reseed (wipes pilot data):** `npm run seed -- --force` — creates draft + **published V1** so members can read the schedule immediately.

## Seeded logins (demo)

Password for all: **`Password123!`**

| Username | Role |
|----------|------|
| `s.niyonzima` | President |
| `e.habimana` | Vice President |
| `a.mukamana` | Secretary |
| `j.uwimana` | Treasurer |
| `d.mugisha` | Coordinator |
| `j.ndayisaba` | Member |

## Endpoints

| Method | Path | Notes |
|--------|------|--------|
| POST | `/auth/login` | `{ username, password }` → `{ token, user }` |
| GET | `/auth/me` | Bearer token |
| POST | `/auth/forgot-password` | Returns `demoResetToken` in dev |
| POST | `/auth/reset-password` | `{ token, password }` |
| GET | `/schedules/draft` | Draft payload (coordinator/secretary can PUT) |
| PUT | `/schedules/draft` | `{ payload }` |
| POST | `/schedules/publish` | Coordinator only → `V1`, `V2`, … |
| GET | `/schedules/current` | Draft (editors) or latest published (members) |
| GET | `/schedules/validate` | Run validation on draft |
| GET | `/members` | Roster list · `POST`/`PATCH` for CRUD · `GET /members/export/csv` |
| GET | `/settings/rules` | Validation rules · `PUT` (coordinator) |
| POST | `/attendance/sessions` | Start/load session for a service |
| PUT | `/attendance/sessions/:id/records` | Save attendance rows |
| POST | `/attendance/sessions/:id/submit` | Submit session |
| GET | `/attendance/me/history` | Member submitted history |
| POST | `/users` | Invite account · `PATCH /users/:id` status/role |
| GET | `/config/pilot` | Pilot `today` date (`PMSS_TODAY`) |

Database: SQLite at `server/data/pmss.sqlite` when `DATABASE_URL` is unset; otherwise Neon/Postgres.

Set `JWT_SECRET` in production. For split hosting set `SERVE_WEB=0` and `CORS_ORIGIN` to the Vercel URL.
