# TMS — Time table Management System

Internal church **Time table Management** app: roster, scheduling, attendance, and role-based access.

| Path | Purpose |
|------|---------|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | **Production:** Render (API) + Vercel (web) + Neon (DB) |
| [`server/README.md`](server/README.md) | API, auth, SQLite/Postgres, seed accounts |
| [`prototype/`](prototype/) | React UI (Vite) — deploy root for Vercel |
| [`ROADMAP.md`](ROADMAP.md) | Backlog & milestones |
| [`design/`](design/) | Figma handoff & tokens |

## Quick start (real system)

```bash
npm run install:all
cp server/.env.example server/.env   # set JWT_SECRET before production
npm run seed
npm run build --prefix prototype
cd server && SERVE_WEB=1 npm start
```

Open **http://localhost:3001** · Coordinator **`coordinator@church.internal`** · Password **`Password123!`**

## UI-only demo (no backend)

```bash
cd prototype && npm install && npm run dev
```

Use the header **demo role** switcher at `/login`.

## Design package (Figma)

This repository also includes a **Figma-ready handoff** plus the clickable prototype above.
