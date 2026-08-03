import { parseChoirList } from '../components/ChoirCardActions'
import { downloadBlob } from './choirScheduleExport'

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

function csvSection(title, headers, rows) {
  const lines = [
    `# ${title}`,
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escapeCsvCell(r[h])).join(',')),
    '',
  ]
  return lines.join('\r\n')
}

/** Comprehensive ministry report → CSV workbook-style single file with sections. */
export function downloadReportsCsv(report, filename = 'pmss-ministry-report.csv') {
  const o = report.overview ?? {}
  const att = report.attendance?.monthly ?? {}
  const chunks = [
    csvSection(
      'Overview',
      ['metric', 'value'],
      [
        { metric: 'Month', value: o.monthLabel },
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
        { metric: 'Published version', value: o.publishedVersion },
      ],
    ),
    csvSection(
      'Attendance by status',
      ['status', 'count'],
      [
        { status: 'Present', count: att.present },
        { status: 'Half Present', count: att.halfPresent },
        { status: 'Quarter Present', count: att.quarterPresent },
        { status: 'Absent', count: att.absent },
        { status: 'Rate', count: att.rate },
      ],
    ),
    csvSection(
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
    ),
    csvSection(
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
    ),
    csvSection(
      'Services',
      ['date', 'name', 'day', 'status'],
      report.schedule?.services ?? [],
    ),
    csvSection(
      'Choir frequency',
      ['choir', 'count'],
      report.schedule?.choirFrequency ?? [],
    ),
    csvSection(
      'Choir assignments',
      ['date', 'service', 'choirCount', 'choirs', 'status'],
      (report.schedule?.choirAssignments ?? []).map((c) => ({
        date: c.date,
        service: c.service,
        choirCount: c.choirCount,
        choirs: c.choirs,
        status: c.status,
      })),
    ),
    csvSection(
      'Team fill',
      ['date', 'service', 'kind', 'size', 'target', 'teamLeader', 'viceTeamLeader', 'status'],
      report.schedule?.teamFill ?? [],
    ),
    csvSection(
      'Member duty load',
      ['member', 'assignments', 'asLeader'],
      report.schedule?.memberDutyLoad ?? [],
    ),
    csvSection(
      'Leadership tally',
      ['member', 'teamLeader', 'viceLeader'],
      report.schedule?.leadershipTally ?? [],
    ),
    csvSection(
      'Leadership detail',
      ['date', 'teamLeader', 'viceLeader', 'status'],
      report.schedule?.leadershipDetail ?? [],
    ),
    csvSection(
      'Validation',
      ['rule', 'severity', 'issue', 'service', 'status'],
      report.schedule?.validation?.rows ?? [],
    ),
    csvSection(
      'Members by choir',
      ['choir', 'count'],
      report.members?.byChoir ?? [],
    ),
    csvSection(
      'Schedule history',
      ['version_label', 'status', 'month_key', 'published_at', 'created_at'],
      report.schedule?.history ?? [],
    ),
    csvSection(
      'Activity',
      ['time', 'summary', 'action'],
      (report.activity ?? []).map((a) => ({
        time: a.time,
        summary: a.summary,
        action: a.action,
      })),
    ),
  ]

  downloadBlob(new Blob(['\uFEFF', chunks.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename)
}

export function downloadReportsExcel(report, filename = 'pmss-ministry-report.xls') {
  const o = report.overview ?? {}
  const att = report.attendance?.monthly ?? {}

  const table = (title, headers, rows) => {
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
    const body = rows
      .map(
        (r) =>
          `<tr>${headers.map((h) => `<td>${escapeHtml(r[h])}</td>`).join('')}</tr>`,
      )
      .join('')
    return `<h3>${escapeHtml(title)}</h3><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
  }

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>PMSS Ministry Report</title></head>
<body>
  <h1>PMSS Ministry Report</h1>
  <p>${escapeHtml(o.monthLabel ?? '')} · Generated ${escapeHtml(report.generatedAt ?? '')}</p>
  ${table('Overview', ['metric', 'value'], [
    { metric: 'Attendance rate', value: o.attendanceRate },
    { metric: 'Attendance marks', value: o.attendanceMarks },
    { metric: 'Sessions submitted', value: o.sessionsSubmitted },
    { metric: 'Active members', value: o.activeMembers },
    { metric: 'Protocol members', value: o.protocolMembers },
    { metric: 'Services', value: o.servicesScheduled },
    { metric: 'Teams', value: o.teamsBuilt },
    { metric: 'Full roster teams', value: o.fullRosterTeams },
    { metric: 'Underfilled teams', value: o.underfilledTeams },
    { metric: 'Unique choirs', value: o.uniqueChoirs },
    { metric: 'Validation warnings', value: o.validationWarnings },
    { metric: 'Validation errors', value: o.validationErrors },
    { metric: 'Published', value: o.publishedVersion },
  ])}
  ${table('Attendance', ['status', 'count'], [
    { status: 'Present', count: att.present },
    { status: 'Half Present', count: att.halfPresent },
    { status: 'Quarter Present', count: att.quarterPresent },
    { status: 'Absent', count: att.absent },
    { status: 'Rate', count: att.rate },
  ])}
  ${table(
    'Sessions',
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
  )}
  ${table(
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
  )}
  ${table('Services', ['date', 'name', 'day', 'status'], report.schedule?.services ?? [])}
  ${table('Choir frequency', ['choir', 'count'], report.schedule?.choirFrequency ?? [])}
  ${table(
    'Choir assignments',
    ['date', 'service', 'choirCount', 'choirs', 'status'],
    (report.schedule?.choirAssignments ?? []).map((c) => ({
      date: c.date,
      service: c.service,
      choirCount: c.choirCount,
      choirs: c.choirs,
      status: c.status,
    })),
  )}
  ${table(
    'Teams',
    ['date', 'service', 'kind', 'size', 'target', 'teamLeader', 'viceTeamLeader', 'status'],
    report.schedule?.teamFill ?? [],
  )}
  ${table('Member duty load', ['member', 'assignments', 'asLeader'], report.schedule?.memberDutyLoad ?? [])}
  ${table('Leadership', ['member', 'teamLeader', 'viceLeader'], report.schedule?.leadershipTally ?? [])}
  ${table(
    'Validation',
    ['rule', 'severity', 'issue', 'service'],
    (report.schedule?.validation?.rows ?? []).map((r) => ({
      rule: r.rule,
      severity: r.severity,
      issue: r.issue,
      service: r.service,
    })),
  )}
  ${table('Members by choir', ['choir', 'count'], report.members?.byChoir ?? [])}
  ${table(
    'Activity',
    ['time', 'summary', 'action'],
    (report.activity ?? []).map((a) => ({ time: a.time, summary: a.summary, action: a.action })),
  )}
</body></html>`

  downloadBlob(new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8' }), filename)
}

export function downloadReportsPdf(report) {
  const o = report.overview ?? {}
  const att = report.attendance?.monthly ?? {}
  const pub = report.schedule?.published ?? {}

  const rows = (arr) =>
    arr
      .map(
        (cells) =>
          `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`,
      )
      .join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>PMSS Ministry Report</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { color: #555; margin-bottom: 16px; }
  .kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
  .kpi div { border: 1px solid #ddd; padding: 8px; border-radius: 6px; }
  .kpi strong { display: block; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eef2f6; }
  @media print { body { padding: 8px; } .kpi { grid-template-columns: repeat(4, 1fr); } }
</style></head>
<body>
  <h1>PMSS Ministry Report</h1>
  <p class="meta">${escapeHtml(o.monthLabel ?? '')} · ${escapeHtml(pub.version ?? o.publishedVersion ?? '')} · ${escapeHtml(report.generatedAt?.slice(0, 19) ?? '')}</p>
  <div class="kpi">
    <div><span>Attendance</span><strong>${escapeHtml(o.attendanceRate)}</strong></div>
    <div><span>Active members</span><strong>${escapeHtml(o.activeMembers)}</strong></div>
    <div><span>Services</span><strong>${escapeHtml(o.servicesScheduled)}</strong></div>
    <div><span>Teams full</span><strong>${escapeHtml(o.fullRosterTeams)}/${escapeHtml(o.teamsBuilt)}</strong></div>
  </div>
  <h2>Attendance</h2>
  <table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>
    ${rows([
      ['Present', att.present],
      ['Half Present', att.halfPresent],
      ['Quarter Present', att.quarterPresent],
      ['Absent', att.absent],
      ['Rate', att.rate],
    ])}
  </tbody></table>
  <h2>Sessions</h2>
  <table><thead><tr><th>Date</th><th>Service</th><th>Status</th><th>Rate</th><th>Absent</th></tr></thead><tbody>
    ${rows((report.attendance?.sessions ?? []).map((s) => [s.date, s.service, s.status, s.rate, s.absent]))}
  </tbody></table>
  <h2>Member attendance</h2>
  <table><thead><tr><th>Member</th><th>Choir</th><th>Marks</th><th>Present</th><th>Absent</th><th>Rate</th></tr></thead><tbody>
    ${rows((report.attendance?.members ?? []).slice(0, 40).map((m) => [m.name, m.choir, m.marks, m.present, m.absent, m.rate]))}
  </tbody></table>
  <h2>Services</h2>
  <table><thead><tr><th>Date</th><th>Name</th><th>Day</th><th>Status</th></tr></thead><tbody>
    ${rows((report.schedule?.services ?? []).map((s) => [s.date, s.name, s.day, s.status]))}
  </tbody></table>
  <h2>Choir frequency</h2>
  <table><thead><tr><th>Choir</th><th>Assignments</th></tr></thead><tbody>
    ${rows((report.schedule?.choirFrequency ?? []).map((c) => [c.choir, c.count]))}
  </tbody></table>
  <h2>Choir assignments</h2>
  <table><thead><tr><th>Date</th><th>Service</th><th>Choirs</th></tr></thead><tbody>
    ${rows((report.schedule?.choirAssignments ?? []).map((c) => [c.date, c.service, c.choirs]))}
  </tbody></table>
  <h2>Leadership load</h2>
  <table><thead><tr><th>Member</th><th>TL</th><th>VTL</th></tr></thead><tbody>
    ${rows((report.schedule?.leadershipTally ?? []).map((r) => [r.member, r.teamLeader, r.viceLeader]))}
  </tbody></table>
  <h2>Team fill</h2>
  <table><thead><tr><th>Service</th><th>Kind</th><th>Size</th><th>Target</th><th>TL</th><th>VTL</th></tr></thead><tbody>
    ${rows((report.schedule?.teamFill ?? []).map((t) => [t.service, t.kind, t.size, t.target, t.teamLeader, t.viceTeamLeader]))}
  </tbody></table>
  <h2>Member duty load</h2>
  <table><thead><tr><th>Member</th><th>Slots</th><th>As TL/VTL</th></tr></thead><tbody>
    ${rows((report.schedule?.memberDutyLoad ?? []).slice(0, 40).map((r) => [r.member, r.assignments, r.asLeader]))}
  </tbody></table>
  <h2>Validation</h2>
  <table><thead><tr><th>Rule</th><th>Severity</th><th>Issue</th><th>Service</th></tr></thead><tbody>
    ${rows((report.schedule?.validation?.rows ?? []).map((r) => [r.rule, r.severity, r.issue, r.service]))}
  </tbody></table>
  <h2>Members by choir</h2>
  <table><thead><tr><th>Choir</th><th>Count</th></tr></thead><tbody>
    ${rows((report.members?.byChoir ?? []).map((r) => [r.choir, r.count]))}
  </tbody></table>
</body></html>`

  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) throw new Error('Pop-up blocked — allow pop-ups to export PDF')
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

/** Demo / offline report built from schedule payload + mock attendance. */
export function buildDemoReport({ payload, members = [], attendanceMonthly, leadership, publishInfo, recentAttendance }) {
  const services = payload?.services ?? []
  const teams = payload?.teamAssignments ?? []
  const choirs = payload?.choirAssignments ?? []
  const validationRows = payload?.validationRows ?? []

  const choirUsage = new Map()
  const choirAssignments = choirs.map((row) => {
    const list = parseChoirList(row.choirs)
    for (const name of list) choirUsage.set(name, (choirUsage.get(name) ?? 0) + 1)
    return {
      service: row.service,
      date: row.date,
      status: row.status ?? 'Assigned',
      choirCount: list.length,
      choirs: list.join('; '),
    }
  })

  const teamFill = teams.map((t) => ({
    service: t.serviceName ?? t.date,
    date: t.date,
    kind: t.kind ?? '—',
    size: t.size ?? t.members?.length ?? 0,
    target: t.kind === 'sunday' || t.kind === 'igaburo' ? 10 : 6,
    teamLeader: t.teamLeader ?? '—',
    viceTeamLeader: t.viceTeamLeader ?? '—',
    status: t.status ?? 'Assigned',
  }))

  const byChoir = new Map()
  for (const m of members.filter((x) => x.role === 'Member' && x.status === 'Active')) {
    const key = m.choir?.trim() || 'Unassigned'
    byChoir.set(key, (byChoir.get(key) ?? 0) + 1)
  }

  const dutyLoad = new Map()
  for (const t of teams) {
    for (const raw of t.members ?? []) {
      const name = typeof raw === 'string' ? raw : raw?.name
      if (!name) continue
      const cur = dutyLoad.get(name) ?? { member: name, assignments: 0, asLeader: 0 }
      cur.assignments += 1
      dutyLoad.set(name, cur)
    }
    if (t.teamLeader) {
      const cur = dutyLoad.get(t.teamLeader) ?? { member: t.teamLeader, assignments: 0, asLeader: 0 }
      cur.asLeader += 1
      dutyLoad.set(t.teamLeader, cur)
    }
    if (t.viceTeamLeader) {
      const cur = dutyLoad.get(t.viceTeamLeader) ?? {
        member: t.viceTeamLeader,
        assignments: 0,
        asLeader: 0,
      }
      cur.asLeader += 1
      dutyLoad.set(t.viceTeamLeader, cur)
    }
  }

  const byKind = { sunday: 0, weekday: 0, igaburo: 0, other: 0 }
  for (const t of teams) {
    const k = t.kind && byKind[t.kind] != null ? t.kind : 'other'
    byKind[k] += 1
  }

  const att = attendanceMonthly ?? { present: 0, halfPresent: 0, quarterPresent: 0, absent: 0, rate: '—' }
  const totalMarks = (att.present ?? 0) + (att.halfPresent ?? 0) + (att.quarterPresent ?? 0) + (att.absent ?? 0)

  return {
    generatedAt: new Date().toISOString(),
    filters: { service: 'All services', start: null, end: null },
    serviceOptions: ['All services', ...new Set(services.map((s) => s.name))],
    overview: {
      attendanceRate: att.rate,
      attendanceMarks: totalMarks,
      sessionsSubmitted: recentAttendance?.length ?? 0,
      activeMembers: members.filter((m) => m.status === 'Active').length,
      protocolMembers: members.filter((m) => m.role === 'Member' && m.status === 'Active').length,
      servicesScheduled: services.length,
      teamsBuilt: teams.length,
      fullRosterTeams: teamFill.filter((t) => t.size >= t.target).length,
      underfilledTeams: teamFill.filter((t) => t.size < t.target).length,
      uniqueChoirs: choirUsage.size,
      leadershipAssignments: (leadership ?? []).length,
      validationWarnings: validationRows.filter((r) => r.severity === 'Warning').length,
      validationErrors: validationRows.filter((r) => r.severity === 'Error').length,
      publishedVersion: publishInfo?.version ?? '—',
      monthLabel: payload?.monthLabel ?? 'August 2026',
    },
    attendance: {
      monthly: { ...att, total: totalMarks },
      sessions: (recentAttendance ?? []).map((r) => ({
        id: r.id,
        service: r.service,
        date: r.date,
        status: r.status,
        recorded: '—',
        present: '—',
        absent: '—',
        rate: r.rate,
      })),
      members: members
        .filter((m) => m.role === 'Member' && m.attendanceRate != null)
        .slice(0, 20)
        .map((m) => ({
          id: m.id,
          name: m.name,
          choir: m.choir,
          marks: '—',
          present: '—',
          absent: '—',
          halfPresent: '—',
          quarterPresent: '—',
          rate: `${m.attendanceRate}%`,
        })),
    },
    members: {
      total: members.length,
      active: members.filter((m) => m.status === 'Active').length,
      protocol: members.filter((m) => m.role === 'Member' && m.status === 'Active').length,
      leadership: members.filter((m) => m.role !== 'Member' && m.status === 'Active').length,
      withChoir: members.filter((m) => m.choir).length,
      byChoir: [...byChoir.entries()].map(([choir, count]) => ({ choir, count })),
    },
    users: { total: '—', active: '—', invited: '—', deactivated: '—' },
    schedule: {
      serviceCount: services.length,
      services,
      teamCount: teams.length,
      teamsByKind: byKind,
      teamFill,
      fullRosterTeams: teamFill.filter((t) => t.size >= t.target).length,
      underfilledTeams: teamFill.filter((t) => t.size < t.target).length,
      choirAssignments,
      choirFrequency: [...choirUsage.entries()]
        .map(([choir, count]) => ({ choir, count }))
        .sort((a, b) => b.count - a.count),
      uniqueChoirs: choirUsage.size,
      leadershipTally: leadership ?? [],
      leadershipDetail: (payload?.leadershipReview ?? []).map((r) => ({
        date: r.date,
        teamLeader: r.tl,
        viceLeader: r.vtl,
        status: r.status,
      })),
      memberDutyLoad: [...dutyLoad.values()].sort(
        (a, b) => b.assignments + b.asLeader - (a.assignments + a.asLeader),
      ),
      validation: {
        rows: validationRows,
        passed: validationRows.filter((r) => r.severity === 'Passed').length,
        warnings: validationRows.filter((r) => r.severity === 'Warning').length,
        errors: validationRows.filter((r) => r.severity === 'Error').length,
      },
      published: {
        version: publishInfo?.version ?? '—',
        status: publishInfo?.status ?? '—',
        publishedBy: publishInfo?.publishedBy ?? null,
        publishedAt: publishInfo?.publishedDate ?? null,
      },
      history: [],
      monthLabel: payload?.monthLabel ?? 'August 2026',
    },
    activity: [],
  }
}
