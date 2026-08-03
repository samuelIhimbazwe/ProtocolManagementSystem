import { parseChoirList } from '../components/ChoirCardActions'

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

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function buildChoirExportRows(assignments) {
  return assignments.map(({ date, service, choirs, status }) => ({
    date,
    service,
    status: status ?? '',
    choirs: parseChoirList(choirs).join('; '),
  }))
}

function exportBasename(monthLabel) {
  const safeMonth = monthLabel.replace(/\s+/g, '-').toLowerCase()
  return `pmss-choir-schedule-${safeMonth}`
}

/** Export current choir rows as CSV (choirs column uses semicolon between names). */
export function downloadChoirScheduleCsv(
  assignments,
  { filename, monthLabel = 'August 2026' } = {},
) {
  const rows = buildChoirExportRows(assignments)
  const name = filename ?? `${exportBasename(monthLabel)}.csv`

  const lines = [
    `# PMSS Choir Schedule — ${monthLabel}`,
    'Date,Service,Status,Choirs',
    ...rows.map((r) => [r.date, r.service, r.status, r.choirs].map(escapeCsvCell).join(',')),
  ]

  const blob = new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, name)
}

/** Excel-compatible .xls (HTML table) — opens in Microsoft Excel without extra libraries. */
export function downloadChoirScheduleExcel(
  assignments,
  { filename, monthLabel = 'August 2026' } = {},
) {
  const rows = buildChoirExportRows(assignments)
  const name = filename ?? `${exportBasename(monthLabel)}.xls`

  const tableRows = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.service)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.choirs)}</td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>Choir Schedule</title></head>
<body>
  <h2>PMSS Choir Schedule — ${escapeHtml(monthLabel)}</h2>
  <table border="1">
    <thead><tr><th>Date</th><th>Service</th><th>Status</th><th>Choirs</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body></html>`

  const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  downloadBlob(blob, name)
}

/** Opens the browser print dialog so the user can save as PDF. */
export function downloadChoirSchedulePdf(
  assignments,
  { monthLabel = 'August 2026' } = {},
) {
  const rows = buildChoirExportRows(assignments)
  const tableRows = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.service)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.choirs)}</td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Choir Schedule PDF</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { font-size: 12px; color: #555; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eef2f6; }
  @media print { body { padding: 12px; } }
</style></head>
<body>
  <h1>Choir schedule</h1>
  <p class="sub">${escapeHtml(monthLabel)} · PMSS</p>
  <table>
    <thead><tr><th>Date</th><th>Service</th><th>Status</th><th>Choirs</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body></html>`

  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) {
    throw new Error('Pop-up blocked — allow pop-ups to export PDF')
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  const printWhenReady = () => {
    win.print()
  }
  if (win.document.readyState === 'complete') {
    setTimeout(printWhenReady, 250)
  } else {
    win.onload = () => setTimeout(printWhenReady, 250)
  }
}
