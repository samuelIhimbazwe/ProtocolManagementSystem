# PMSS — Figma Production Handoff

**Protocol Management & Scheduling System**  
Target: Church leadership presentation + developer implementation  
Design language: Linear / Notion / Stripe Dashboard (simplified)

---

## 1. Figma file structure

Create one Figma file: **`PMSS — Product UI v1`**

```
📁 Cover
📁 🎨 Design System
   📄 Tokens (Variables collection)
   📄 Typography
   📄 Color styles
   📄 Effects (shadows)
   📄 Grid & breakpoints
📁 🧩 Component Library
   📄 Atoms
   📄 Molecules
   📄 Organisms
   📄 Mobile
📁 📐 Wireframes (Lo-fi)
   📄 Desktop — All flows
   📄 Mobile — Key flows
📁 🖥 Desktop — Hi-Fi
   📄 01 Login
   📄 02 Dashboard
   📄 03 Members List
   📄 04 Member Profile
   📄 05 Attendance Dashboard
   📄 06 Attendance Recording
   📄 07 Scheduling Center (7 tab states)
   📄 08 Reports
   📄 09 Settings
📁 📱 Mobile — Hi-Fi
   📄 01 Login
   📄 02 Dashboard
   📄 03 Members List
   📄 04 Attendance Recording
   📄 05 Scheduling Center
   📄 06 Leadership Review
   📄 07 Reports
📁 🔗 Prototype
   📄 Flow — Coordinator (primary)
   📄 Flow — Member
   📄 Flow — President
📁 📋 Specs (Dev handoff)
   📄 Redlines & annotations
```

---

## 2. Frames & auto-layout

| Frame name | Size (W×H) | Notes |
|------------|------------|--------|
| Desktop / App | 1440 × 900 | Main artboard; fill `#F9FAFB` |
| Desktop / Content | 1200 × auto | Max content inside shell |
| Mobile / App | 390 × 844 | iPhone 14 Pro reference |
| Mobile / Safe | 390 × auto | Padding 16px horizontal |

**App shell (desktop)** — Auto-layout vertical, fill:

- **Row 1 — Top bar**: H fixed 56px, W fill, padding 16×24, space-between, align center, fill `#FFFFFF`, stroke bottom `#E5E7EB`
- **Row 2 — Body**: H fill, horizontal auto-layout
  - **Sidebar**: W 240px fixed, padding 16, gap 4, fill `#FFFFFF`
  - **Main**: W fill, padding 32, gap 24, vertical auto-layout

**App shell (mobile)** — Vertical fill:

- **Main**: padding 16, gap 16, bottom padding 80 (clear bottom nav)
- **Bottom nav**: H 64px fixed, dock bottom, 5 items, equal width

**Card** — Auto-layout vertical, padding 20, gap 16, radius 12, fill `#FFFFFF`, effect `shadow/card`

**Table row** — H 48px min, horizontal, padding 12×16, gap 16, align center; header row fill `#F9FAFB`, text 12px semibold `#6B7280`

**Primary button** — H 40px (mobile 44px), padding 12×20, radius 12, fill `#2563EB`, text 14px semibold white

**Input** — H 40px, padding 10×14, radius 12, stroke `#E5E7EB`, focus stroke `#2563EB` 2px

**Tab bar (Scheduling Center)** — Horizontal scroll on mobile; gap 8; tab H 36px, padding 8×16, radius 12; active fill `#EFF6FF`, text `#2563EB`

---

## 3. Figma Variables (map from `design-tokens.json`)

**Collection: PMSS / Color**

- `primary/default` → `#2563EB`
- `primary/subtle` → `#EFF6FF`
- `neutral/bg` → `#F9FAFB`
- `neutral/surface` → `#FFFFFF`
- `neutral/border` → `#E5E7EB`
- `neutral/text-primary` → `#111827`
- `neutral/text-secondary` → `#6B7280`
- `semantic/success` → `#10B981`
- `semantic/warning` → `#F59E0B`
- `semantic/error` → `#EF4444`

**Collection: PMSS / Radius** — `sm` 8, `md` 12, `lg` 16

**Collection: PMSS / Spacing** — 4, 8, 12, 16, 24, 32, 48

---

## 4. Component library (create as variants)

### Atoms

| Component | Variants |
|-----------|----------|
| Button | Type: Primary / Secondary / Ghost / Danger; Size: S / M / L; State: Default / Hover / Disabled / Loading |
| Input | Type: Text / Password / Search; State: Default / Focus / Error |
| Checkbox, Toggle, Badge | Status colors |
| Avatar | Size: 24 / 32 / 40; Initials fallback |
| Icon button | 32×32, ghost |

### Molecules

| Component | Notes |
|-----------|--------|
| Nav item | Icon + label; active left bar 3px `#2563EB` |
| Stat card | Label, value, optional trend, icon top-right |
| Service card | Date pill, title, meta row, action row |
| Table | Header + body slots; optional checkbox column |
| Empty state | Illustration placeholder + CTA |
| Toast | Success / warning / error |

### Organisms

| Component | Notes |
|-----------|--------|
| Sidebar | Logo block + nav list + collapse (optional v2) |
| Top bar | Search 320px, bell badge, avatar menu |
| Mobile bottom nav | Dashboard, Members, Schedule, Reports, More |
| Scheduling tabs | 7 tabs with scroll |
| Validation row | Severity icon + rule + service link |
| Member profile sections | Accordion on mobile |

**Naming**: `PMSS / [Category] / [Name]`

---

## 5. Screen inventory (hi-fi checklist)

### Screen 1 — Login

- Center card 400px (mobile: full width minus 32)
- Logo 48px, title “PMSS”, subtitle “Protocol Management & Scheduling”
- Fields, remember me row, primary CTA full width
- Link “Forgot password?”

### Screen 2 — Dashboard

- 4 stat cards in 4-column grid (mobile 2×2)
- Quick actions 2×2 grid of secondary buttons
- Two-column: Upcoming Services (left) + Recent Activity (right); stack on mobile
- Notifications panel (collapsible on mobile)

### Screen 3 — Members

- Toolbar: search, filters (Role, Status, Choir), Add Member, Export
- Table columns: Name, Phone, Role, Status, Attendance rate, Choir
- Data table with row actions menu

### Screen 4 — Member profile

- Header: name, role badge, status, Edit CTA
- 2-column desktop / stacked mobile sections per spec

### Screen 5 — Attendance dashboard

- 5 mini stat cards
- Chart placeholders (bar + donut) — use Figma chart plugin or styled frames
- Recent attendance table

### Screen 6 — Attendance recording

- Service info card (date, type)
- Inline status segmented control per row: Present / Half / Quarter / Absent
- Sticky footer: Save / Submit

### Screen 7 — Scheduling Center

Single page; **7 prototype variants** on tab component:

1. **Calendar** — Month picker + table + “Generate Monthly Calendar”
2. **Choir** — CTA row + calendar grid of service cards
3. **Service Teams** — Per-service cards, member chips, team size
4. **Leadership Review** — TL / VTL recommendations + actions
5. **Validation** — Summary cards + results table
6. **Publish** — Preview + version + actions
7. **History** — Version table

### Screen 8 — Reports

- 4 report category cards
- Filter bar + export PDF/Excel

### Screen 9 — Settings

- Left sub-nav or stacked sections: Service config, Team size, Limits, Rotation, **Rule configuration**, Notifications, Preferences

---

## 6. Prototype interactions

### Coordinator flow (primary)

```
Login [Login btn] → Dashboard
Dashboard [Quick: Generate Choir Schedule] → Scheduling / Choir tab
Scheduling [Build Service Teams] → Service Teams tab
Service Teams [Continue] → Leadership Review tab
Leadership [Approve] → Validation tab
Validation [Publish Schedule] → Publish tab
Publish [Publish Schedule] → Toast success → Dashboard
```

**Interaction specs**

- Smart animate 200ms ease-out between connected frames
- Overlay: modals (Replace Choir, Change Leader) — dissolve 150ms
- Tab switches: instant swap variant on Scheduling frame
- Mobile: same flows via bottom nav + Scheduling entry

### Member flow

```
Login → Dashboard → (widget) My Assignments → Scheduling read-only preview
Dashboard → Attendance → Attendance dashboard (read)
Notifications from top bar
```

### President flow

```
Login → Dashboard → Reports → Attendance analytics drill-down
Reports → Scheduling reports
```

---

## 7. Wireframe fidelity (lo-fi frames)

Use gray `#E5E7EB` blocks, 8px radius, no brand color. One frame per desktop screen + mobile subset listed in file structure. Label flows with connector arrows on **Wireframes** page only.

---

## 8. Accessibility & content

- Minimum touch target 44×44 mobile
- Contrast: text on white ≥ 4.5:1 for body
- Focus rings: 2px `#2563EB` offset 2px
- Role labels in tables; status never color-only (icon + text)

---

## 9. Developer sync

- Tokens: `design/design-tokens.json`
- Interactive reference: `prototype/` (Vite + React)
- Component props should mirror Figma variant properties in README

---

## 10. Presentation deck (optional Figma page)

Duplicate **Cover** with 3 hero frames: Dashboard, Scheduling Center, Mobile Dashboard — for leadership review.
