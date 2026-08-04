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

function kindLabel(kind) {
  if (kind === 'sunday') return 'Sunday'
  if (kind === 'igaburo') return 'Igaburo'
  return 'Weekday'
}

export function buildServiceTeamExportRows(teams) {
  return (teams ?? []).map((t) => {
    const members = Array.isArray(t.members) ? t.members : []
    return {
      date: t.date ?? '',
      service: t.serviceName ?? t.name ?? kindLabel(t.kind),
      kind: kindLabel(t.kind),
      size: t.size ?? members.length,
      teamLeader: t.teamLeader ?? '',
      viceTeamLeader: t.viceTeamLeader ?? '',
      members: members.join('; '),
    }
  })
}

function exportBasename(monthLabel) {
  const safeMonth = String(monthLabel).replace(/\s+/g, '-').toLowerCase()
  return `pmss-service-teams-${safeMonth}`
}

/** Export service teams as CSV. */
export function downloadServiceTeamsCsv(teams, { filename, monthLabel = 'August 2026' } = {}) {
  const rows = buildServiceTeamExportRows(teams)
  const name = filename ?? `${exportBasename(monthLabel)}.csv`
  const lines = [
    `# PMSS Service Teams — ${monthLabel}`,
    'Date,Service,Kind,Size,Team leader,Vice team leader,Members',
    ...rows.map((r) =>
      [r.date, r.service, r.kind, r.size, r.teamLeader, r.viceTeamLeader, r.members]
        .map(escapeCsvCell)
        .join(','),
    ),
  ]
  downloadBlob(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), name)
}

/** Excel-compatible .xls (HTML table). */
export function downloadServiceTeamsExcel(teams, { filename, monthLabel = 'August 2026' } = {}) {
  const rows = buildServiceTeamExportRows(teams)
  const name = filename ?? `${exportBasename(monthLabel)}.xls`
  const tableRows = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.service)}</td><td>${escapeHtml(r.kind)}</td><td>${escapeHtml(r.size)}</td><td>${escapeHtml(r.teamLeader)}</td><td>${escapeHtml(r.viceTeamLeader)}</td><td>${escapeHtml(r.members)}</td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>Service Teams</title></head>
<body>
  <h2>PMSS Service Teams — ${escapeHtml(monthLabel)}</h2>
  <table border="1">
    <thead><tr><th>Date</th><th>Service</th><th>Kind</th><th>Size</th><th>Team leader</th><th>Vice team leader</th><th>Members</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body></html>`

  downloadBlob(new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8' }), name)
}

/** Opens print dialog so the user can save as PDF. */
export function downloadServiceTeamsPdf(teams, { monthLabel = 'August 2026' } = {}) {
  const rows = buildServiceTeamExportRows(teams)
  const blocks = rows
    .map((r) => {
      const members = r.members
        ? r.members
            .split('; ')
            .filter(Boolean)
            .map((m) => `<li>${escapeHtml(m)}</li>`)
            .join('')
        : '<li class="empty">No members</li>'
      return `<section class="team">
  <h2>${escapeHtml(r.date)} · ${escapeHtml(r.service)}</h2>
  <p class="meta">${escapeHtml(r.kind)} · ${escapeHtml(r.size)} members
    ${r.teamLeader ? ` · TL: <strong>${escapeHtml(r.teamLeader)}</strong>` : ''}
    ${r.viceTeamLeader ? ` · VTL: <strong>${escapeHtml(r.viceTeamLeader)}</strong>` : ''}
  </p>
  <ul>${members}</ul>
</section>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Service Teams PDF</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { font-size: 12px; color: #555; margin: 0 0 20px; }
  .team { break-inside: avoid; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #ddd; }
  .team h2 { font-size: 14px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #444; margin: 0 0 8px; }
  ul { margin: 0; padding-left: 1.2rem; font-size: 12px; }
  li.empty { color: #888; list-style: none; margin-left: -1.2rem; }
  @media print { body { padding: 12px; } .team { border-color: #bbb; } }
</style></head>
<body>
  <h1>Service teams</h1>
  <p class="sub">${escapeHtml(monthLabel)} · PMSS</p>
  ${blocks || '<p>No teams to export.</p>'}
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
