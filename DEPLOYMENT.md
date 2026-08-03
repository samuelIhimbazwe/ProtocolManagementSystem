# PMSS deployment (pilot)

PMSS runs as a **single Node process**: Express API + SQLite + React UI (`prototype/dist`).

## Requirements

- **Node.js 22.14+**
- Writable directory for `server/data/pmss.sqlite`

## First-time setup

```bash
npm run install:all
cp server/.env.example server/.env
# Edit server/.env — set JWT_SECRET (required for production)

npm run seed
npm run build
npm run start --prefix server
```

Open **http://localhost:3001** — sign in with seeded accounts (`Password123!`, e.g. `d.mugisha`).

Set `SERVE_WEB=1` in `server/.env` or use `NODE_ENV=production` (see `server/src/index.js`).

## Development (split UI + API)

Terminal 1:

```bash
cd server && npm run dev
```

Terminal 2:

```bash
cd prototype
cp .env.example .env.local
npm run dev
```

UI: **http://localhost:5173** · API: **http://localhost:3001**

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `3001`) |
| `JWT_SECRET` | **Required in production** — session signing |
| `PMSS_TODAY` | Pilot “today” for TL/VTL duty windows (ISO date) |
| `PMSS_DB_PATH` | Optional SQLite file path |
| `CORS_ORIGIN` | If UI is on another host |
| `SERVE_WEB` | `1` = serve `prototype/dist` from API |
| `NODE_ENV` | `production` enables static UI unless `SERVE_WEB=0` |

## Backup

Copy `server/data/pmss.sqlite` on a schedule (e.g. daily). No migrations tool yet — treat DB as the pilot source of truth.

## What is still optional / post-pilot

- Real email (invites, password reset)
- HTTPS termination (use reverse proxy: nginx, Caddy, IIS)
- Multi-campus / multi-tenant
- PDF/Excel report exports (UI buttons are placeholders)
- Global header search

## Offline demo

For presentations without the API, run only `prototype` with **no** `.env.local` or set `VITE_DEMO_MODE=true`.
