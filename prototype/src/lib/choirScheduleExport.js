import { parseChoirList } from '../components/ChoirCardActions'
import { downloadHtmlDocumentAsPdf } from './bulletinPdf.js'

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
export async function downloadChoirSchedulePdf(
  assignments,
  { monthLabel = 'August 2026', filename } = {},
) {
  const rows = buildChoirExportRows(assignments)
  const tableRows = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.service)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.choirs)}</td></tr>`,
    )
    .join('')

  const html = `
  <div style="font-family:system-ui,sans-serif;color:#111">
    <h1 style="font-size:18px;margin:0 0 4px">Choir schedule</h1>
    <p style="font-size:12px;color:#555;margin:0 0 20px">${escapeHtml(monthLabel)} · PMSS</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>
        <th style="border:1px solid #333;padding:6px 8px;background:#eef2f6;text-align:left">Date</th>
        <th style="border:1px solid #333;padding:6px 8px;background:#eef2f6;text-align:left">Service</th>
        <th style="border:1px solid #333;padding:6px 8px;background:#eef2f6;text-align:left">Status</th>
        <th style="border:1px solid #333;padding:6px 8px;background:#eef2f6;text-align:left">Choirs</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>`

  return downloadHtmlDocumentAsPdf(html, {
    fileName: filename ?? `${exportBasename(monthLabel)}.pdf`,
  })
}
