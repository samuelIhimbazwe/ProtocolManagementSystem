# PMSS product roadmap & backlog

Ordered work for moving from **prototype + design handoff** to **pilot with real data**, with a parallel **UI/Figma parity** track.

**Legend:** P0 = pilot blocker · P1 = pilot should-have · P2 = post-pilot · UI = prototype/Figma only (no backend)

---

## Milestone M1 — Pilot with real data (recommended next)

Goal: One ministry can run **August-style** month on real auth, one database, publish once, members see truth.

| # | Epic | Priority | Scope (acceptance) |
|---|------|----------|-------------------|
| 1 | **Platform & auth** | P0 | API + DB; real login (username/password); sessions; link `User accounts` to credentials; remove prod dependency on demo role switcher |
| 2 | **Password lifecycle** | P0 | Forgot/reset with signed tokens, expiry, email (or SMS); deactivate blocks login |
| 3 | **Audit & roles** | P0 | Server enforces `appRole`; TL/VTL duty flags from **published** assignments + dates (not `DEMO_TODAY`); audit log for publish, roster, account changes |
| 4 | **Canonical schedule model** | P0 | Single `ScheduleVersion` (draft → published); all tabs read/write draft until publish; members read published only |
| 5 | **Calendar generation** | P1 | Generate monthly service calendar (services CRUD or import); feeds choir/teams engines |
| 6 | **Choir schedule persistence** | P1 | Generate/regenerate/edit/replace/swap persisted on draft; diff on republish |
| 7 | **Service teams persistence** | P1 | Build/rebuild engine output saved; Add/Remove/Replace on draft; Sunday/Igaburo 10-member rule enforced server-side |
| 8 | **Leadership review workflow** | P1 | Approve/pending TL/VTL per Sunday (or service); status visible before validation |
| 9 | **Validation engine** | P1 | Rules from Settings stored in DB; validation tab runs live checks; errors block publish when rule enabled |
| 10 | **Publish & history** | P0 | Publish creates version Vn; history tab accurate; dashboard “published schedule” from API |
| 11 | **Notifications (minimal)** | P1 | On publish + team assignment: in-app list + optional email; member prefs from Settings honored |
| 12 | **Roster CRUD** | P1 | Members list: add/edit/deactivate; choir field; search/filters work; export CSV |
| 13 | **Attendance sessions** | P1 | Pick published service → load assigned team → record/submit; TL/VTL/coordinator/secretary permissions server-side |
| 14 | **Personal attendance history** | P1 | Member history from submitted sessions (not generated seeds) |
| 15 | **Reports v1** | P2 | Attendance rate by service/month from real data; CSV export |
| 16 | **Deploy & ops** | P0 | Dev/staging/prod; env secrets; backup; basic monitoring |

### M1 suggested sprint order

1. **1 → 2 → 3** (auth, accounts, enforce roles)  
2. **4 → 10** (schedule version + publish)  
3. **5 → 7 → 8 → 9** (scheduling pipeline on draft)  
4. **12 → 13 → 14** (roster + attendance)  
5. **11 → 15 → 16** (notifications, reports, deploy)

---

## Milestone M2 — UI / Figma parity (parallel or after M1 core)

Goal: Every role and state in **Figma** matches prototype; empty/loading/error states defined.

| # | Item | Priority | Notes |
|---|------|----------|--------|
| U1 | Figma file from handoff | UI | Pages in `FIGMA_HANDOFF.md`; component props in `FIGMA_COMPONENTS.md` |
| U2 | Role matrix frames | UI | President, VP, Secretary, Treasurer, Coordinator, Member, TL/VTL duty |
| U3 | Settings per role | UI | Match `settingsByRole.js` layouts |
| U4 | Portal vs Office dashboard | UI | Member vs leadership; temporary Office for TL/VTL |
| U5 | Cards / List / Bulletin | UI | Choir, teams, attendance (done in prototype — mirror in Figma) |
| U6 | Auth screens | UI | Login, forgot, reset, invalid token |
| U7 | User accounts | UI | Roster sub-nav, invite modal, status badges |
| U8 | Empty & error states | UI | No team, validation failed, publish blocked, no attendance |
| U9 | Mobile patterns | UI | Bottom nav, wide tables → cards on small screens |
| U10 | Global search & notifications drawer | P2 / UI | Header search; bell inbox with mark-read |

---

## Milestone M3 — Post-pilot enhancements

| # | Epic | Priority |
|---|------|----------|
| 17 | PDF bulletin export (server or print CSS polish) | P2 |
| 18 | Excel exports (reports, roster, schedule) | P2 |
| 19 | Pagination / virtualization (members, accounts, history) | P2 |
| 20 | i18n (EN / Kinyarwanda / FR) | P2 |
| 21 | Self-service profile (phone, avatar, password change) | P2 |
| 22 | Assignment fairness analytics (rotation, caps, rest rules) | P2 |
| 23 | Integrations (calendar ICS, WhatsApp digest — if needed) | P3 |

---

## Current prototype coverage (baseline)

| Area | Status |
|------|--------|
| Design tokens, flows, wireframes | Done (docs) |
| Role-based nav & permissions | Done (client-side) |
| Scheduling UI (choir, teams, validation, publish tabs) | Interactive demo |
| Team engine (Sundays, Igaburo 10, weekdays) | Client-side |
| Dashboard Portal / Office + TL/VTL window | Demo date |
| Attendance + personal history append | Demo/generated |
| Settings by role + rule table | localStorage |
| User accounts + roster sub-nav | localStorage |
| Forgot / reset password | UI only |
| Reports, search, notification bell | Mostly static |

---

## Decision log (fill as you go)

| Date | Decision |
|------|----------|
| 2026-08-01 | **Pilot app** — unified deploy (`SERVE_WEB`), production UI uses API by default, dashboard/reports/notifications + roster from SQLite |
| 2026-08-01 | **M1 API expansion** — roster, rules, validation, attendance sessions, schedule payload seed, UI `ScheduleContext` |
| 2026-08-01 | **M1 started** — `server/` SQLite API: auth, reset tokens, schedule draft/publish skeleton; prototype `VITE_API_URL` mode |
| — | Backend stack → **Node + Express + SQLite** (pilot) |
| — | Email provider for invites/reset → _TBD_ |
| — | Single-tenant vs multi-campus → _TBD_ |

---

## How to use this doc

- Pull items into GitHub Issues / Azure DevOps with IDs `PMSS-1`, …  
- Mark prototype tasks **UI** when no API is required.  
- Do not ship pilot until **P0** rows in M1 are acceptance-tested with real users (Coordinator + Secretary minimum).
