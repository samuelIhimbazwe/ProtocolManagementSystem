# PMSS User Flows

## Roles

| Role | Primary goals |
|------|----------------|
| President | Oversight, reports, analytics |
| Vice President | Same as President (delegated) |
| Secretary | Members, records, reports |
| Treasurer | Reports (attendance/participation) |
| **Coordinator** | **Scheduling end-to-end (primary power user)** |
| Member | View assignments, attendance, notifications |
| Team Leader / Vice TL | Per-service (temporary), shown in scheduling |

---

## Flow A — Coordinator (automation-first)

```mermaid
flowchart LR
  A[Login] --> B[Dashboard]
  B --> C[Scheduling Center]
  C --> D[Calendar: Generate Monthly Calendar]
  D --> E[Choir: Generate Choir Schedule]
  E --> F{Edit needed?}
  F -->|Yes| G[Edit / Replace / Swap]
  G --> E
  F -->|No| H[Service Teams: Build Teams]
  H --> I{Adjust roster?}
  I -->|Yes| J[Add / Remove / Replace]
  J --> H
  I -->|No| K[Leadership Review]
  K --> L[Approve or Change TL/VTL]
  L --> M[Validation]
  M --> N{Errors?}
  N -->|Yes| O[Fix in prior tabs]
  O --> M
  N -->|No| P[Publish]
  P --> Q[Dashboard: Published status]
```

**Click budget target**: Login → Publish in ≤ 12 primary clicks when no edits (Generate × 3, tab navigations, Approve, Publish).

---

## Flow B — Member

```mermaid
flowchart LR
  A[Login] --> B[Dashboard]
  B --> C[View assignments widget]
  B --> D[Attendance summary]
  B --> E[Notifications]
```

No write access to scheduling unless role elevation.

---

## Flow C — President

```mermaid
flowchart LR
  A[Login] --> B[Dashboard]
  B --> C[Reports]
  C --> D[Attendance analytics]
  C --> E[Scheduling reports]
  C --> F[Export PDF / Excel]
```

---

## Mobile navigation map

| Tab | Route | Screen |
|-----|-------|--------|
| Home | `/` | Dashboard |
| Members | `/members` | Member list |
| Schedule | `/scheduling` | Scheduling Center (default Calendar) |
| Reports | `/reports` | Reports |
| More | `/settings` | Settings + Attendance entry |

Attendance recording: Dashboard quick link or More menu → `/attendance/record`.

---

## Scheduling Center tab order (fixed)

1. Calendar → 2. Choir → 3. Service Teams → 4. Leadership Review → 5. Validation → 6. Publish → 7. History

Prototype: horizontal tabs desktop; scrollable chips mobile.
