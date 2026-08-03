import { downloadBlob } from './choirScheduleExport'

const DEFAULT_TITLE = 'PMSS Ministry Report'

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

function includeHasKeys(include) {
  return include && typeof include === 'object' && Object.keys(include).length > 0
}

/** When include is missing or empty, all sections export (backward compatible). */
function shouldInclude(include, id) {
  if (!includeHasKeys(include)) return true
  if (include[id] === true) return true
  if (id === 'choirFrequency' || id === 'choirAssignments') {
    if (include.choirs === true) return true
  }
  if (id === 'leadershipTally' || id === 'leadershipDetail') {
    if (include.leadership === true) return true
  }
  return false
}

function normalizeOptions(options) {
  const opts = options ?? {}
  return {
    title: opts.title ?? DEFAULT_TITLE,
    subtitle: opts.subtitle ?? '',
    include: opts.include,
  }
}

function formatTimestamp(value) {
  if (value == null || value === '') return value
  return typeof value === 'string' && value.length > 19 ? value.slice(0, 19) : value
}

function teamsByKindRows(teamsByKind) {
  const src = teamsByKind ?? {}
  const labels = {
    sunday: 'Sunday',
    weekday: 'Weekday',
    igaburo: 'Igaburo',
    other: 'Other',
  }
  return Object.entries(src).map(([kind, count]) => ({
    kind: labels[kind] ?? kind,
    count,
  }))
}

function buildSections(report, include, title, subtitle) {
  const o = report.overview ?? {}
  const att = report.attendance?.monthly ?? {}
  const filters = report.filters ?? {}
  const pub = report.schedule?.published ?? {}
  const draft = report.schedule?.draft ?? {}
  const members = report.members ?? {}
  const users = report.users ?? {}
  const monthLabel = o.monthLabel ?? report.schedule?.monthLabel ?? ''

  const sections = []

  const push = (id, sectionTitle, headers, rows) => {
    if (shouldInclude(include, id)) {
      sections.push({ id, title: sectionTitle, headers, rows })
    }
  }

  push('cover', 'Cover', ['metric', 'value'], [
    { metric: 'Title', value: title },
    { metric: 'Subtitle', value: subtitle || '—' },
    { metric: 'Service filter', value: filters.service ?? '—' },
    { metric: 'Start date', value: filters.start ?? '—' },
    { metric: 'End date', value: filters.end ?? '—' },
    { metric: 'Generated at', value: formatTimestamp(report.generatedAt) ?? '—' },
    { metric: 'Month', value: monthLabel || '—' },
  ])

  push('overview', 'Overview', ['metric', 'value'], [
    { metric: 'Month', value: monthLabel },
    { metric: 'Attendance rate', value: o.attendanceRate },
    { metric: 'Attendance marks', value: o.attendanceMarks },
    { metric: 'Sessions submitted', value: o.sessionsSubmitted },
    { metric: 'Active members', value: o.activeMembers },
    { metric: 'Protocol members', value: o.protocolMembers },
    { metric: 'Services scheduled', value: o.servicesScheduled },
    { metric: 'Teams built', value: o.teamsBuilt },
    { metric: 'Full roster teams', value: o.fullRosterTeams },
    { metric: 'Underfilled teams', value: o.underfilledTeams },
    { metric: 'Unique choirs', value: o.uniqueChoirs },
    { metric: 'Leadership assignments', value: o.leadershipAssignments },
    { metric: 'Validation warnings', value: o.validationWarnings },
    { metric: 'Validation errors', value: o.validationErrors },
    { metric: 'Published version', value: o.publishedVersion },
  ])

  push('publication', 'Publication', ['field', 'value'], [
    { field: 'Published version', value: pub.version },
    { field: 'Published status', value: pub.status },
    { field: 'Published by', value: pub.publishedBy },
    { field: 'Published at', value: formatTimestamp(pub.publishedAt) },
    { field: 'Draft version', value: draft.version },
    { field: 'Draft status', value: draft.status },
    { field: 'Draft updated at', value: formatTimestamp(draft.updatedAt ?? draft.updated_at) },
    { field: 'Draft month', value: draft.monthLabel ?? draft.month_key },
  ])

  push('attendance', 'Attendance by status', ['status', 'count'], [
    { status: 'Present', count: att.present },
    { status: 'Half', count: att.halfPresent },
    { status: 'Quarter', count: att.quarterPresent },
    { status: 'Absent', count: att.absent },
    { status: 'Rate', count: att.rate },
  ])

  push(
    'sessions',
    'Attendance sessions',
    ['date', 'service', 'status', 'recorded', 'present', 'absent', 'rate'],
    (report.attendance?.sessions ?? []).map((s) => ({
      date: s.date,
      service: s.service,
      status: s.status,
      recorded: s.recorded,
      present: s.present,
      absent: s.absent,
      rate: s.rate,
    })),
  )

  push(
    'memberAttendance',
    'Member attendance',
    ['name', 'choir', 'marks', 'present', 'halfPresent', 'quarterPresent', 'absent', 'rate'],
    (report.attendance?.members ?? []).map((m) => ({
      name: m.name,
      choir: m.choir,
      marks: m.marks,
      present: m.present,
      halfPresent: m.halfPresent,
      quarterPresent: m.quarterPresent,
      absent: m.absent,
      rate: m.rate,
    })),
  )

  push('services', 'Services', ['date', 'name', 'day', 'status'], report.schedule?.services ?? [])

  push('teamsByKind', 'Teams by kind', ['kind', 'count'], teamsByKindRows(report.schedule?.teamsByKind))

  push(
    'teams',
    'Team fill',
    ['date', 'service', 'kind', 'size', 'target', 'teamLeader', 'viceTeamLeader', 'status'],
    report.schedule?.teamFill ?? [],
  )

  push('choirFrequency', 'Choir frequency', ['choir', 'count'], report.schedule?.choirFrequency ?? [])

  push(
    'choirAssignments',
    'Choir assignments',
    ['date', 'service', 'choirCount', 'choirs', 'status'],
    (report.schedule?.choirAssignments ?? []).map((c) => ({
      date: c.date,
      service: c.service,
      choirCount: c.choirCount,
      choirs: c.choirs,
      status: c.status,
    })),
  )

  push(
    'dutyLoad',
    'Member duty load',
    ['member', 'assignments', 'asLeader'],
    report.schedule?.memberDutyLoad ?? [],
  )

  push(
    'leadershipTally',
    'Leadership tally',
    ['member', 'teamLeader', 'viceLeader'],
    report.schedule?.leadershipTally ?? [],
  )

  push(
    'leadershipDetail',
    'Leadership detail',
    ['date', 'teamLeader', 'viceLeader', 'status'],
    report.schedule?.leadershipDetail ?? [],
  )

  push(
    'validation',
    'Validation',
    ['rule', 'severity', 'issue', 'service', 'status'],
    report.schedule?.validation?.rows ?? [],
  )

  push(
    'history',
    'Schedule history',
    ['version_label', 'status', 'month_key', 'published_at', 'created_at'],
    report.schedule?.history ?? [],
  )

  push('membersOverview', 'Members overview', ['metric', 'value'], [
    { metric: 'Total', value: members.total },
    { metric: 'Active', value: members.active },
    { metric: 'Protocol', value: members.protocol },
    { metric: 'Leadership', value: members.leadership },
    { metric: 'With choir', value: members.withChoir },
  ])

  push('membersByChoir', 'Members by choir', ['choir', 'count'], members.byChoir ?? [])

  push('usersOverview', 'Users overview', ['metric', 'value'], [
    { metric: 'Total', value: users.total },
    { metric: 'Active', value: users.active },
    { metric: 'Invited', value: users.invited },
    { metric: 'Deactivated', value: users.deactivated },
  ])

  push(
    'activity',
    'Activity',
    ['time', 'summary', 'action'],
    (report.activity ?? []).map((a) => ({
      time: a.time,
      summary: a.summary,
      action: a.action,
    })),
  )

  return sections
}

function csvFromSections(sections) {
  return sections
    .map(({ title, headers, rows }) => {
      const lines = [
        `# ${title}`,
        headers.join(','),
        ...rows.map((r) => headers.map((h) => escapeCsvCell(r[h])).join(',')),
        '',
      ]
      return lines.join('\r\n')
    })
    .join('\r\n')
}

function excelTable(sectionTitle, headers, rows) {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const body = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(r[h])}</td>`).join('')}</tr>`)
    .join('')
  return `<h3>${escapeHtml(sectionTitle)}</h3><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function excelFromSections(sections, title, subtitle, report) {
  const o = report.overview ?? {}
  const meta = [
    subtitle ? `<p>${escapeHtml(subtitle)}</p>` : '',
    `<p>${escapeHtml(o.monthLabel ?? '')} · Generated ${escapeHtml(formatTimestamp(report.generatedAt) ?? '')}</p>`,
  ]
    .filter(Boolean)
    .join('\n  ')

  const body = sections.map(({ title: t, headers, rows }) => excelTable(t, headers, rows)).join('\n  ')

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${meta}
  ${body}
</body></html>`
}

function pdfSectionHtml({ title, headers, rows }) {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const body = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(r[h])}</td>`).join('')}</tr>`)
    .join('')
  return `
  <h2>${escapeHtml(title)}</h2>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

const PDF_PRINT_CSS = `
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { color: #555; margin-bottom: 16px; }
  .subtitle { color: #333; margin: 0 0 8px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eef2f6; }
  @media print { body { padding: 8px; } }
`

function pdfFromSections(sections, title, subtitle, report) {
  const o = report.overview ?? {}
  const pub = report.schedule?.published ?? {}
  const metaParts = [
    o.monthLabel,
    pub.version ?? o.publishedVersion,
    formatTimestamp(report.generatedAt),
  ].filter((x) => x != null && x !== '')

  const subtitleBlock = subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''
  const body = sections.map(pdfSectionHtml).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PDF_PRINT_CSS}</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${subtitleBlock}
  <p class="meta">${escapeHtml(metaParts.join(' · '))}</p>
  ${body}
</body></html>`
}

export function downloadReportsCsv(report, filename = 'pmss-ministry-report.csv', options) {
  const { title, subtitle, include } = normalizeOptions(options)
  const sections = buildSections(report, include, title, subtitle)
  const csv = csvFromSections(sections)
  downloadBlob(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), filename)
}

export function downloadReportsExcel(report, filename = 'pmss-ministry-report.xls', options) {
  const { title, subtitle, include } = normalizeOptions(options)
  const sections = buildSections(report, include, title, subtitle)
  const html = excelFromSections(sections, title, subtitle, report)
  downloadBlob(new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8' }), filename)
}

export function downloadReportsPdf(report, options) {
  const { title, subtitle, include } = normalizeOptions(options)
  const sections = buildSections(report, include, title, subtitle)
  const html = pdfFromSections(sections, title, subtitle, report)

  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) throw new Error('Pop-up blocked — allow pop-ups to export PDF')
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
