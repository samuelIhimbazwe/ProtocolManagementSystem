# PMSS Demo Data

Canonical demo dataset for prototypes, Figma content, and QA. **Demo month: August 2026.**

## Church services (recurring types)

| Service Type     | Occurrence                 |
| ---------------- | -------------------------- |
| Sunday Service 1 | Every Sunday               |
| Sunday Service 2 | Every Sunday               |
| Tuesday Service  | Every Tuesday              |
| Friday Service   | Every Friday               |
| Igaburo Service  | Last Saturday of the month |

## August 2026 calendar (19 services)

See `prototype/src/data/mock.js` → `SERVICES` for machine-readable rows.

## Choirs

**Primary:** El Bethel Choir, Ijwi ry'Umwami Yesu Choir, Elim Choir, Integuza Choir  

**Secondary:** Yerusalemu Choir, Beulah Choir  

**Special:** Hope Choir (every Sunday Service 1)

## Dashboard overview

| Metric            | Value          |
| ----------------- | -------------- |
| Total Members     | 75 (5 admin + 70 protocol) |
| Active Members    | 70             |
| Upcoming Services | 19             |
| Attendance Rate   | 87%            |
| Published Schedule| August 2026    |

## Schedule publishing

| Field         | Value          |
| ------------- | -------------- |
| Version       | V3             |
| Status        | Published      |
| Published by  | David Mugisha  |
| Published date| 31 July 2026   |

## Validation (August schedule)

Passed: 28 · Warnings: 2 · Errors: 0 · **PASS**

Implementation: `prototype/src/data/mock.js`.
