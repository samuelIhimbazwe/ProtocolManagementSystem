# PMSS Design System

Aligned with interactive prototype (`prototype/src`) and Figma component library.

## Foundations

| Token | Value |
|-------|--------|
| Font | Inter 400/500/600/700 |
| Primary | `#2563EB` (600), hover `#1D4ED8` |
| Background | `#F9FAFB` |
| Surface | `#FFFFFF` |
| Border | `#E5E7EB` |
| Text primary | `#111827` |
| Text secondary | `#6B7280` |
| Success | `#10B981` on `#ECFDF5` |
| Warning | `#F59E0B` on `#FFFBEB` |
| Error | `#EF4444` on `#FEF2F2` |
| Radius (default) | 12px |
| Shadow card | see `design-tokens.json` |

## Spacing scale

4, 8, 12, 16, 24, 32, 48 px — section gaps 24–32; card padding 20; page padding 16 mobile / 32 desktop.

## Typography scale

| Style | Size / weight | Use |
|-------|----------------|-----|
| Page title | 24px semibold | H1 |
| Section title | 14–18px semibold | H2 |
| Body | 14px regular | Tables, forms |
| Caption | 12px medium | Labels, meta |
| Stat value | 24px semibold | Dashboard cards |

## Components

### Button

- **Primary**: filled blue, 40px height, 12px radius, semibold 14px  
- **Secondary**: white, 1px border neutral-200  
- **Ghost**: text only for tertiary actions in cards  
- **Mobile**: min height 44px for primary CTAs  

### Input / Select

- Height 40px, padding 10×14, radius 12px  
- Focus: 2px ring primary at 30% opacity  

### Badge

Variants: neutral, primary, success, warning, error — pill shape, 12px medium  

### Card (`.pmss-card`)

White, 12px radius, soft shadow, optional 1px border at 80% opacity  

### Stat card

Label (secondary) → value (2xl semibold) → optional subtext/trend  

### Data table

Header row neutral-50, 12px semibold labels; row height ≥ 48px; hover row tint  

### Service card

Date badge → title → content → divider → text action links (coordinator edits)  

### Navigation

- **Desktop sidebar**: 240px, active item primary-50 + 3px left bar  
- **Top bar**: 56px, search + notifications + avatar  
- **Mobile bottom nav**: 64px, 5 items, 10px labels  

### Scheduling tabs

Horizontal scroll; active = primary-50 + ring; icon + label  

### Attendance status chips

Segmented 4-state: Present, Half, Quarter, Absent — selected = primary fill  

## Layout grids

| Context | Grid |
|---------|------|
| Dashboard stats | 2 col mobile, 4 col desktop |
| Quick actions | 2 col mobile, 4 col desktop |
| Scheduling service cards | 1 → 2 → 3 columns |
| Member profile | 1 col mobile, 2 col desktop sections |

## Icons

Lucide outline, 18–20px nav, 16px inline — match Figma icon set (Feather/Lucide style).

## Motion (Figma prototype)

- Screen transitions: 200ms ease-out  
- Modals: 150ms dissolve  
- Toasts: slide up 200ms (prototype uses fixed toast 2.8s)  

## Accessibility

- Focus visible on all interactive elements  
- Status: icon + label (badges), not color alone  
- Table horizontal scroll on small screens with hint text  
