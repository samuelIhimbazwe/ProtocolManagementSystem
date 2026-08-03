# PMSS deployment

Split hosting for production:

| Layer | Host | Notes |
|-------|------|--------|
| **API** | [Render](https://render.com) | Express (`server/`) |
| **Web** | [Vercel](https://vercel.com) | Vite React (`prototype/`) |
| **DB** | [Neon](https://neon.tech) Postgres | Set `DATABASE_URL` on Render |

Local development can still use SQLite (no `DATABASE_URL`).

---

## 1. Neon (database)

1. Create a project and copy the connection string (`postgresql://…?sslmode=require`).
2. You will paste it into Render as `DATABASE_URL`.

Schema + demo seed run automatically on API startup (`initSchema` + `seedDatabase`). To reseed later:

```bash
cd server
# with DATABASE_URL in .env
npm run seed -- --force
```

---

## 2. Render (API)

**Option A — Blueprint:** connect the repo; `render.yaml` defines `pmss-api` with `rootDir: server`.

**Option B — Manual Web Service:**

- **Root directory:** `server`
- **Build:** `npm install`
- **Start:** `npm start`
- **Health check:** `/health`

### Environment variables (Render)

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` | Strong secret (`openssl rand -hex 32`) |
| `JWT_EXPIRES` | `12h` (optional) |
| `CORS_ORIGIN` | Your Vercel URL, e.g. `https://pmss.vercel.app` (comma-separate for multiple) |
| `SERVE_WEB` | `0` (API only; UI is on Vercel) |
| `NODE_ENV` | `production` |
| `PMSS_TODAY` | Pilot date, e.g. `2026-08-02` (optional) |

After deploy, open `https://<your-service>.onrender.com/health` — expect `{ "ok": true, "db": "postgres" }`.

> Free Render services sleep when idle; the first request after sleep can take ~30–60s.

---

## 3. Vercel (web)

1. Import the repo in Vercel.
2. **Root directory:** `prototype`
3. Framework: Vite (auto-detected). Build: `npm run build`, output: `dist`.
4. Set environment variables (Production):

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://<your-render-service>.onrender.com` |
| `VITE_DEMO_MODE` | `false` |

5. Deploy. SPA routing is handled by `prototype/vercel.json`.

Update Render `CORS_ORIGIN` to the final Vercel URL if it changed.

---

## Local development

**API (SQLite by default):**

```bash
cd server
cp .env.example .env
npm run dev
```

**API against Neon (optional):**

```bash
# in server/.env
DATABASE_URL=postgresql://...
```

**UI:**

```bash
cd prototype
cp .env.example .env.local
# VITE_API_URL=http://localhost:3001
npm run dev
```

UI: http://localhost:5173 · API: http://localhost:3001

Demo password: `Password123!` (e.g. `d.mugisha`, `j.ndayisaba`, `m.uwamahoro`).

### Unified local production (API + UI one port)

```bash
npm run install:all
npm run build
# server/.env: SERVE_WEB=1, no need for VITE_API_URL on clients
npm run start --prefix server
```

Uses SQLite unless `DATABASE_URL` is set. Prototype `.env.production` uses `VITE_API_URL=same-origin` for this mode.

---

## Environment reference

### Server

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (Render sets this) |
| `DATABASE_URL` | Neon Postgres — if unset, uses SQLite |
| `PMSS_DB_PATH` | SQLite file path (local only) |
| `JWT_SECRET` | **Required in production** |
| `CORS_ORIGIN` | Vercel origin(s) |
| `SERVE_WEB` | `0` on Render; `1` for unified host |
| `PMSS_TODAY` | Pilot “today” for duty windows |
| `NODE_ENV` | `production` / `development` |

### Web (Vite)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Render API base URL (or `same-origin` for unified) |
| `VITE_DEMO_MODE` | `true` = offline mock UI |

---

## Checklist after first deploy

1. `/health` on Render returns `ok` and `db: "postgres"`.
2. Sign in from the Vercel app with a seeded user.
3. Browser network calls go to the Render host (not same-origin).
4. No CORS errors (check `CORS_ORIGIN`).

---

## What is still optional / post-pilot

- Real email (invites, password reset)
- Custom domains on Render / Vercel
- Neon branching / migrations tooling beyond startup schema
- Keeping free-tier Render awake (external cron hitting `/health`)
