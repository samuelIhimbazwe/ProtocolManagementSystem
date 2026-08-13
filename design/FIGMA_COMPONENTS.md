# TMS — Figma component property tables

Use **component set** naming: `TMS / [Layer] / [Name]`. Property names match React prototype flags where noted.

---

## TMS / Button

| Property | Values | Default |
|----------|--------|---------|
| Type | Primary, Secondary, Ghost, Danger | Primary |
| Size | S (32px), M (40px), L (44px) | M |
| State | Default, Hover, Pressed, Disabled, Loading | Default |
| Icon | None, Leading, Trailing, Only | None |
| Full width | True, False | False |

**Auto-layout:** Horizontal, center, gap 8, padding 12×20 (M), hug contents (width) or fill (full).

---

## TMS / Input

| Property | Type | Values |
|----------|------|--------|
| Variant | Text, Password, Search, Select | Text |
| State | Default, Focus, Error, Disabled | Default |
| Label | Boolean | True |
| Hint | Boolean | False |

Height 40px; radius 12; stroke 1px `neutral/border`.

---

## TMS / Badge

| Property | Values |
|----------|--------|
| Tone | Neutral, Primary, Success, Warning, Error |

Padding 4×10; text 12 Medium.

---

## TMS / Stat card

| Property | Values |
|----------|--------|
| Has icon | True, False |
| Has trend | True, False |

Vertical AL; padding 20; gap 8.

---

## TMS / Nav item

| Property | Values |
|----------|--------|
| State | Default, Hover, Active |
| Device | Desktop, Mobile (icon-only) |

Active: fill `primary/subtle`, 3px left bar `primary/default`.

---

## TMS / Sidebar

| Property | Values |
|----------|--------|
| Role variant | Full, Treasurer, Member |

**Full:** all 6 items. **Treasurer:** Dashboard, Attendance, Reports, Settings. **Member:** Dashboard, Attendance, Scheduling, Settings (see `roles.js`).

---

## TMS / Mobile bottom nav

| Property | Values |
|----------|--------|
| Role variant | Default, Treasurer, Member |
| Active tab | Home, Members, Schedule, Reports, More |

5 slots max; hide slots not in role (use opacity 0 + fixed width or separate component sets).

---

## TMS / Top bar

| Property | Values |
|----------|--------|
| Show search | True, False |
| Notifications | None, Unread |
| Role menu | Open, Closed |

---

## TMS / Data table

| Property | Values |
|----------|--------|
| Row actions | True, False |
| Density | Default, Compact |

Header 48px; row min 48px.

---

## TMS / Service card

| Property | Values |
|----------|--------|
| Mode | Edit (coordinator), Read-only (member/leader view) |
| Status badge | Assigned, Pending, Draft |

Footer actions visible only when Mode = Edit.

---

## TMS / Scheduling tab

| Property | Values |
|----------|--------|
| State | Default, Active |
| Visible | True, False |

Set Visible per role frame (Member hides Validation, Publish, Leadership).

---

## TMS / Attendance status chip

| Property | Values |
|----------|--------|
| Status | Present, Half, Quarter, Absent |
| Selected | True, False |

Segmented group; selected = primary fill.

---

## TMS / Dashboard — Quick actions grid

| Property | Values |
|----------|--------|
| Visible | True, False |

False for President, Member, Treasurer, Secretary (Coordinator only).

---

## TMS / Page header

| Property | Values |
|----------|--------|
| Actions slot | Empty, Primary CTA, Multiple |

---

## Role-based frame variants (hi-fi)

Duplicate **Dashboard**, **Scheduling Center**, **Members**, **Sidebar** with role property:

| Frame suffix | Quick actions | Schedule CTAs | Add member | Record attendance |
|--------------|---------------|---------------|------------|-------------------|
| Coordinator | ✓ | ✓ | ✓ | ✓ |
| President | ✗ | ✗ | ✗ | ✗ |
| Member | ✗ | ✗ | ✗ | ✗ |
| Secretary | ✗ | ✗ | ✓ | ✓ |
| Treasurer | ✗ | ✗ | ✗ | ✗ |

Prototype toggles role via **Login demo role** and **header role select** — use same labels in Figma sticky notes.

---

## Prototype interactions (component triggers)

| From | Trigger | To |
|------|---------|-----|
| Button Primary | On click | Navigate / Open overlay |
| Nav item | On click | Swap active state + change frame |
| Scheduling tab | On click | Swap tab variant |
| Login | On click | Dashboard (role stored) |

Smart animate 200ms; overlays 150ms dissolve.
