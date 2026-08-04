import { downloadBlob } from './choirScheduleExport.js'

function escapeCsvCell(value) {
  const s = String(value ?? '')
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function exportBasename(monthLabel) {
  const safe = String(monthLabel ?? 'schedule')
    .replace(/\s+/g, '-')
    .toLowerCase()
  return `pmss-schedule-${safe}`
}

function servicesRows(payload) {
  return (payload.services ?? []).map((s) => ({
    date: s.date ?? '',
    name: s.name ?? '',
    day: s.day ?? '',
    status: s.status ?? '',
  }))
}

function choirRows(payload) {
  return (payload.choirAssignments ?? []).map((c) => ({
    date: c.date ?? '',
    service: c.service ?? '',
    choirs: c.choirs ?? '',
    status: c.status ?? '',
  }))
}

function teamRows(payload) {
  return (payload.teamAssignments ?? []).map((t) => {
    const members = Array.isArray(t.members) ? t.members : []
    return {
      date: t.date ?? t.serviceDate ?? '',
      service: t.serviceName ?? '',
      kind: t.kind ?? '',
      teamLeader: t.teamLeader ?? '',
      viceTeamLeader: t.viceTeamLeader ?? '',
      members: members.join('; '),
      size: t.size ?? members.length,
    }
  })
}

function leadershipRows(payload) {
  return (payload.leadershipReview ?? []).map((r) => ({
    date: r.date ?? '',
    tl: r.tl ?? '',
    vtl: r.vtl ?? '',
    status: r.status ?? '',
  }))
}

/** Full schedule CSV (multi-section). */
export function downloadScheduleCsv(payload, { filename, monthLabel } = {}) {
  const label = monthLabel ?? payload.monthLabel ?? 'Schedule'
  const name = filename ?? `${exportBasename(label)}.csv`
  const chunks = [`# PMSS Schedule — ${label}`, '']

  chunks.push('## Services', 'Date,Name,Day,Status')
  for (const r of servicesRows(payload)) {
    chunks.push([r.date, r.name, r.day, r.status].map(escapeCsvCell).join(','))
  }
  chunks.push('', '## Choir assignments', 'Date,Service,Choirs,Status')
  for (const r of choirRows(payload)) {
    chunks.push([r.date, r.service, r.choirs, r.status].map(escapeCsvCell).join(','))
  }
  chunks.push('', '## Service teams', 'Date,Service,Kind,Size,Team leader,Vice team leader,Members')
  for (const r of teamRows(payload)) {
    chunks.push(
      [r.date, r.service, r.kind, r.size, r.teamLeader, r.viceTeamLeader, r.members]
        .map(escapeCsvCell)
        .join(','),
    )
  }
  chunks.push('', '## Leadership review', 'Date,TL,VTL,Status')
  for (const r of leadershipRows(payload)) {
    chunks.push([r.date, r.tl, r.vtl, r.status].map(escapeCsvCell).join(','))
  }

  downloadBlob(new Blob(['\uFEFF', chunks.join('\r\n')], { type: 'text/csv;charset=utf-8' }), name)
}

/** Excel-compatible .xls with multiple tables. */
export function downloadScheduleExcel(payload, { filename, monthLabel } = {}) {
  const label = monthLabel ?? payload.monthLabel ?? 'Schedule'
  const name = filename ?? `${exportBasename(label)}.xls`

  const table = (title, headers, rows) => {
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
    const body = rows
      .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
      .join('')
    return `<h3>${escapeHtml(title)}</h3><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
  }

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>Schedule</title></head>
<body>
  <h2>PMSS Schedule — ${escapeHtml(label)}</h2>
  ${table(
    'Services',
    ['Date', 'Name', 'Day', 'Status'],
    servicesRows(payload).map((r) => [r.date, r.name, r.day, r.status]),
  )}
  ${table(
    'Choir assignments',
    ['Date', 'Service', 'Choirs', 'Status'],
    choirRows(payload).map((r) => [r.date, r.service, r.choirs, r.status]),
  )}
  ${table(
    'Service teams',
    ['Date', 'Service', 'Kind', 'Size', 'Team leader', 'Vice team leader', 'Members'],
    teamRows(payload).map((r) => [
      r.date,
      r.service,
      r.kind,
      r.size,
      r.teamLeader,
      r.viceTeamLeader,
      r.members,
    ]),
  )}
  ${table(
    'Leadership review',
    ['Date', 'TL', 'VTL', 'Status'],
    leadershipRows(payload).map((r) => [r.date, r.tl, r.vtl, r.status]),
  )}
</body></html>`

  downloadBlob(new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8' }), name)
}

/** Printable PDF via browser print dialog. */
export function downloadSchedulePdf(payload, { monthLabel } = {}) {
  const label = monthLabel ?? payload.monthLabel ?? 'Schedule'
  const section = (title, headers, rows) => {
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
    const body = rows
      .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
      .join('')
    return `<section><h2>${escapeHtml(title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Schedule PDF</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { font-size: 12px; color: #555; margin: 0 0 20px; }
  h2 { font-size: 14px; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
  th, td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #eef2f6; }
  @media print { body { padding: 12px; } }
</style></head>
<body>
  <h1>Protocol schedule</h1>
  <p class="sub">${escapeHtml(label)} · PMSS</p>
  ${section(
    'Services',
    ['Date', 'Name', 'Day', 'Status'],
    servicesRows(payload).map((r) => [r.date, r.name, r.day, r.status]),
  )}
  ${section(
    'Choir assignments',
    ['Date', 'Service', 'Choirs', 'Status'],
    choirRows(payload).map((r) => [r.date, r.service, r.choirs, r.status]),
  )}
  ${section(
    'Service teams',
    ['Date', 'Service', 'Kind', 'Size', 'TL', 'VTL', 'Members'],
    teamRows(payload).map((r) => [
      r.date,
      r.service,
      r.kind,
      r.size,
      r.teamLeader,
      r.viceTeamLeader,
      r.members,
    ]),
  )}
  ${section(
    'Leadership review',
    ['Date', 'TL', 'VTL', 'Status'],
    leadershipRows(payload).map((r) => [r.date, r.tl, r.vtl, r.status]),
  )}
</body></html>`

  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) throw new Error('Pop-up blocked — allow pop-ups to export PDF')
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  const printWhenReady = () => win.print()
  if (win.document.readyState === 'complete') setTimeout(printWhenReady, 250)
  else win.onload = () => setTimeout(printWhenReady, 250)
}
