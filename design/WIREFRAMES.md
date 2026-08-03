# PMSS Wireframes (Lo-fi)

Use in Figma **Wireframes** page: `#E5E7EB` blocks, 8px radius, 8px spacing. Labels in 12px neutral-600.

## 01 Login

```
┌─────────────────────────────┐
│         [logo 48]           │
│           PMSS              │
│      subtitle line          │
│  ┌───────────────────────┐  │
│  │ Username              │  │
│  │ Password              │  │
│  │ ☐ Remember  Forgot?   │  │
│  │ [    Sign in full    ]  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

Mobile: same stack, card full-bleed minus 16px margins.

---

## 02 Dashboard (desktop)

```
[Sidebar] | [Topbar: search | bell | user]
          | [Stat][Stat][Stat][Stat]
          | [Quick action × 4 grid]
          | [ Upcoming services  ] [ Activity ]
          |                      [ Notifications ]
```

Mobile: no sidebar; bottom nav; stats 2×2; sections stacked.

---

## 03 Members

```
Title + Add + Export
[ Search________ ] [Filters]
┌──────────────────────────────────┐
│ Name | Phone | Role | Status | … │
│ rows…                            │
└──────────────────────────────────┘
```

---

## 04 Member profile

```
← Back    Name + badges    [Edit]
[ Personal info ] [ Contact ]
[ Choir & attendance ] [ Attendance summary ]
[ Leadership    ] [ Service history ]
[ Activity history full width ]
```

---

## 05 Attendance dashboard

```
Title + Record CTA
[5 stat cards row]
[ Bar chart ] [ Donut chart ]
[ Recent attendance table ]
```

---

## 06 Attendance recording

```
Service card: date | type
┌ Member ──────────────────────┐
│ Name                         │
│ [P][Half][Qtr][Absent]       │
└──────────────────────────────┘
(sticky) [Save] [Submit]
```

---

## 07 Scheduling Center

```
Title
[Tabs: Cal | Choir | Teams | Lead | Val | Pub | Hist → scroll]
── tab content area ──
```

### Tab: Calendar

Month + [Generate]  
Table: Service | Date | Day | Status  

### Tab: Choir

[Generate] [Regenerate]  
Grid of service cards (name, date, choirs, actions)  

### Tab: Service Teams

Alert: per-service teams  
[Build] [Rebuild]  
Cards: members chips + team size  

### Tab: Leadership Review

Cards: TL / VTL + Approve / Change / Randomize  

### Tab: Validation

3 summary tiles + results table  

### Tab: Publish

Preview panel | meta + Publish / Archive / PDF  

### Tab: History

Version table + View / Restore  

---

## 08 Reports

```
Filter bar + PDF/Excel
[4 report category tiles]
Optional analytics preview block
```

---

## 09 Settings

Stacked sections with key-value rows + Edit section link.

**Rule configuration** (primary block): table — On | Rule | Category | Parameter | Severity | Edit; category filter chips; Reset / Run validation actions.

---

## Mobile bottom nav

```
[ Home ] [ Members ] [ Schedule ] [ Reports ] [ More ]
```

Fixed 64px; content padding-bottom 80px.
