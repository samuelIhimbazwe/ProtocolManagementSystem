import { downloadBlob } from './choirScheduleExport'
import { formatRwf } from './money'
import { ROLE_LABELS } from './officeReportBuilder'
import {
  buildFormalReportHtml,
  escapeHtml,
  formatReportDay,
  formatReportStamp,
  makeReportReference,
  normalizeSignatories,
} from './reportDocument.js'

function escapeCsvCell(value) {
  const s = String(value ?? '')
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function included(include, id) {
  if (!include || typeof include !== 'object') return true
  const keys = Object.keys(include)
  if (!keys.length) return true
  return include[id] === true
}

function kpiRows(obj) {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj).map(([metric, value]) => ({ metric, value }))
}

function formatDisplayDate(iso) {
  return formatReportStamp(iso)
}

function formatDay(iso) {
  return formatReportDay(iso)
}

function headerLabel(key) {
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase()
}

function statusCell(value) {
  const v = String(value ?? '—')
  const upper = v.toUpperCase()
  if (
    ['PRESENT', 'CONFIRMED', 'SUBMITTED', 'APPROVED', 'PASSED', 'ACTIVE', 'ASSESSED', 'TL', 'VTL'].includes(
      upper,
    ) ||
    upper.includes('PRESENT')
  ) {
    return `<span class="badge badge-ok">${escapeHtml(upper)}</span>`
  }
  if (['ABSENT', 'DECLINED', 'ERROR', 'FAILED'].includes(upper)) {
    return `<span class="badge badge-bad">${escapeHtml(upper)}</span>`
  }
  if (['PENDING', 'PARTIAL', 'WARNING', 'DRAFT'].includes(upper)) {
    return `<span class="badge badge-warn">${escapeHtml(upper)}</span>`
  }
  return escapeHtml(v)
}

function buildSections({ title, subtitle, meta, include, narrative, snapshot }) {
  const sections = []
  const snap = snapshot ?? {}

  // Cover is rendered in the formal header — skip as a body section.

  const narrativeMap = [
    ['narrativeHow', 'How it went', narrative?.howItWent],
    ['narrativeIssues', 'Issues & challenges', narrative?.issuesChallenges],
    ['narrativeSolutions', 'Solutions used', narrative?.solutions],
    ['narrativeRecs', 'Recommendations', narrative?.recommendations],
    ['narrativeNotes', 'Notes', narrative?.notes],
  ]
  for (const [id, label, text] of narrativeMap) {
    if (included(include, id)) {
      sections.push({ id, title: label, kind: 'text', text: text || '—' })
    }
  }

  if (included(include, 'dutyMeta') && snap.dutyMeta) {
    const duties = snap.dutyMeta.activeDuties ?? snap.dutyMeta.duties ?? []
    sections.push({
      id: 'dutyMeta',
      title: 'Duty assignment',
      kind: 'table',
      headers: ['service', 'date', 'role', 'window'],
      rows: duties.map((d) => ({
        service: d.serviceName,
        date: d.serviceDate,
        role: d.dutyRole,
        window: `${d.dutyStarts ?? ''} → ${d.dutyEnds ?? ''}`,
      })),
      totalLabel: 'Total duty assignments',
      totalValue: duties.length,
    })
  }

  if (included(include, 'dutyTeam') && snap.dutyTeam) {
    const rows = []
    for (const d of snap.dutyTeam.duties ?? []) {
      for (const name of d.members ?? []) {
        let role = 'Member'
        if (name === d.teamLeader) role = 'TL'
        else if (name === d.viceTeamLeader) role = 'VTL'
        rows.push({ service: d.serviceName, member: name, role })
      }
    }
    if (Array.isArray(snap.dutyTeam.members)) {
      for (const m of snap.dutyTeam.members) {
        rows.push({
          service: m.serviceName,
          member: m.name,
          role: m.role || 'Member',
        })
      }
    }
    sections.push({
      id: 'dutyTeam',
      title: 'Team roster',
      kind: 'table',
      headers: ['#', 'member', 'service', 'role'],
      rows: rows.map((r, i) => ({ '#': i + 1, ...r })),
      totalLabel: 'Total team members listed',
      totalValue: rows.length,
    })
  }

  if (included(include, 'overview') && snap.overview) {
    sections.push({
      id: 'overview',
      title: 'Ministry overview',
      kind: 'table',
      headers: ['metric', 'value'],
      rows: kpiRows(snap.overview),
    })
  }

  if (included(include, 'attendance') && snap.attendance) {
    const att = snap.attendance.monthly ?? snap.attendance
    sections.push({
      id: 'attendance',
      title: 'Attendance summary',
      kind: 'table',
      headers: ['metric', 'value'],
      rows: kpiRows(att),
    })
  }

  if (included(include, 'sessions') && snap.sessions) {
    const rows = (snap.sessions ?? []).map((s, i) => ({
      '#': i + 1,
      date: s.date ?? s.serviceDate,
      service: s.service ?? s.serviceName,
      status: s.status,
      rate: s.rate ?? '—',
    }))
    sections.push({
      id: 'sessions',
      title: 'Attendance sessions',
      kind: 'table',
      headers: ['#', 'date', 'service', 'status', 'rate'],
      rows,
      totalLabel: 'Total sessions',
      totalValue: rows.length,
    })
  }

  if (included(include, 'services') && snap.services) {
    const rows = (snap.services ?? []).map((s, i) => ({
      '#': i + 1,
      date: s.date,
      name: s.name,
      day: s.day,
      status: s.status,
    }))
    sections.push({
      id: 'services',
      title: 'Services calendar',
      kind: 'table',
      headers: ['#', 'date', 'name', 'day', 'status'],
      rows,
      totalLabel: 'Total services',
      totalValue: rows.length,
    })
  }

  if (included(include, 'teams') && snap.teams) {
    const rows = (snap.teams ?? []).map((t, i) => ({
      '#': i + 1,
      date: t.date ?? t.serviceDate,
      service: t.service ?? t.serviceName,
      size: t.size,
      teamLeader: t.teamLeader,
      viceTeamLeader: t.viceTeamLeader,
    }))
    sections.push({
      id: 'teams',
      title: 'Team fill',
      kind: 'table',
      headers: ['#', 'date', 'service', 'size', 'teamLeader', 'viceTeamLeader'],
      rows,
      totalLabel: 'Total teams',
      totalValue: rows.length,
    })
  }

  if (included(include, 'choirs') && snap.choirs) {
    const rows = (snap.choirs.assignments ?? snap.choirs ?? []).map((c, i) => ({
      '#': i + 1,
      date: c.date,
      service: c.service,
      choirs: c.choirs,
    }))
    sections.push({
      id: 'choirs',
      title: 'Choir assignments',
      kind: 'table',
      headers: ['#', 'date', 'service', 'choirs'],
      rows,
      totalLabel: 'Total choir assignments',
      totalValue: rows.length,
    })
  }

  if (included(include, 'validation') && snap.validation) {
    const rows = (snap.validation.rows ?? snap.validation ?? []).map((r, i) => ({
      '#': i + 1,
      rule: r.rule,
      severity: r.severity,
      issue: r.issue,
      service: r.service,
    }))
    sections.push({
      id: 'validation',
      title: 'Validation findings',
      kind: 'table',
      headers: ['#', 'rule', 'severity', 'issue', 'service'],
      rows,
      totalLabel: 'Total findings',
      totalValue: rows.length,
    })
  }

  if (included(include, 'membersOverview') && snap.membersOverview) {
    sections.push({
      id: 'membersOverview',
      title: 'Member roster KPIs',
      kind: 'table',
      headers: ['metric', 'value'],
      rows: kpiRows(snap.membersOverview),
    })
  }

  if (included(include, 'financeOverview') && snap.financeOverview) {
    const fo = snap.financeOverview
    sections.push({
      id: 'financeOverview',
      title: 'Finance KPIs',
      kind: 'table',
      headers: ['metric', 'value'],
      rows: [
        { metric: 'Collected', value: formatRwf(fo.totalCollected ?? fo.collected ?? 0) },
        { metric: 'Pending verification', value: fo.pendingVerification ?? fo.pending ?? '—' },
        { metric: 'Outstanding', value: formatRwf(fo.outstandingBalances ?? fo.outstanding ?? 0) },
        {
          metric: 'Goal achievement',
          value: fo.goalAchievement != null ? `${fo.goalAchievement}%` : '—',
        },
      ],
    })
  }

  if (included(include, 'collection') && snap.collection) {
    const rows = (snap.collection ?? []).map((r, i) => ({
      '#': i + 1,
      name: r.name,
      goal: formatRwf(r.ministryGoal ?? 0),
      collected: formatRwf(r.collected ?? 0),
      progress: r.progressPct != null ? `${r.progressPct}%` : '—',
    }))
    sections.push({
      id: 'collection',
      title: 'Collection by type',
      kind: 'table',
      headers: ['#', 'name', 'goal', 'collected', 'progress'],
      rows,
      totalLabel: 'Contribution types',
      totalValue: rows.length,
    })
  }

  if (included(include, 'outstanding') && snap.outstanding) {
    const rows = (snap.outstanding ?? []).map((r, i) => ({
      '#': i + 1,
      member: r.member_name ?? r.memberName,
      type: r.contribution_name ?? r.contributionName,
      amount: formatRwf(r.outstanding_amount ?? r.outstandingAmount ?? 0),
      status: r.status,
    }))
    sections.push({
      id: 'outstanding',
      title: 'Outstanding balances',
      kind: 'table',
      headers: ['#', 'member', 'type', 'amount', 'status'],
      rows,
      totalLabel: 'Outstanding cases',
      totalValue: rows.length,
    })
  }

  if (included(include, 'exceptions') && snap.exceptions) {
    const raw = [
      ...(snap.exceptions.partials ?? []),
      ...(snap.exceptions.declined ?? []),
      ...(Array.isArray(snap.exceptions) ? snap.exceptions : []),
    ]
    const rows = raw.map((r, i) => ({
      '#': i + 1,
      member: r.memberName ?? r.member_name,
      type: r.contributionName ?? r.contribution_name,
      status: r.status,
      claimed: formatRwf(r.claimedAmount ?? r.claimed_amount ?? 0),
    }))
    sections.push({
      id: 'exceptions',
      title: 'Partial & declined',
      kind: 'table',
      headers: ['#', 'member', 'type', 'status', 'claimed'],
      rows,
      totalLabel: 'Exception rows',
      totalValue: rows.length,
    })
  }

  if (included(include, 'publication') && snap.publication) {
    sections.push({
      id: 'publication',
      title: 'Publication status',
      kind: 'table',
      headers: ['metric', 'value'],
      rows: kpiRows(snap.publication),
    })
  }

  if (included(include, 'memberAttendance') && snap.memberAttendance) {
    const rows = (snap.memberAttendance ?? []).map((r, i) => ({
      '#': i + 1,
      member: r.member,
      marks: r.marks,
      present: r.present,
      absent: r.absent,
      rate: r.rate,
    }))
    sections.push({
      id: 'memberAttendance',
      title: 'Member attendance detail',
      kind: 'table',
      headers: ['#', 'member', 'marks', 'present', 'absent', 'rate'],
      rows,
      totalLabel: 'Members listed',
      totalValue: rows.length,
    })
  }

  if (included(include, 'teamsByKind') && snap.teamsByKind) {
    sections.push({
      id: 'teamsByKind',
      title: 'Teams by service kind',
      kind: 'table',
      headers: ['metric', 'value'],
      rows: kpiRows(snap.teamsByKind),
    })
  }

  if (included(include, 'choirFrequency') && snap.choirFrequency) {
    const rows = (snap.choirFrequency ?? []).map((r, i) => ({
      '#': i + 1,
      choir: r.choir,
      count: r.count,
    }))
    sections.push({
      id: 'choirFrequency',
      title: 'Choir frequency',
      kind: 'table',
      headers: ['#', 'choir', 'count'],
      rows,
      totalLabel: 'Choirs',
      totalValue: rows.length,
    })
  }

  if (included(include, 'dutyLoad') && snap.dutyLoad) {
    const rows = (snap.dutyLoad ?? []).map((r, i) => ({
      '#': i + 1,
      member: r.member,
      slots: r.slots,
      leadership: r.leadership,
    }))
    sections.push({
      id: 'dutyLoad',
      title: 'Member duty load',
      kind: 'table',
      headers: ['#', 'member', 'slots', 'leadership'],
      rows,
      totalLabel: 'Members',
      totalValue: rows.length,
    })
  }

  if (included(include, 'leadershipTally') && snap.leadershipTally) {
    const rows = (snap.leadershipTally ?? []).map((r, i) => ({
      '#': i + 1,
      member: r.member,
      tl: r.tl,
      vtl: r.vtl,
      total: r.total,
    }))
    sections.push({
      id: 'leadershipTally',
      title: 'Leadership tally',
      kind: 'table',
      headers: ['#', 'member', 'tl', 'vtl', 'total'],
      rows,
      totalLabel: 'Leaders',
      totalValue: rows.length,
    })
  }

  if (included(include, 'leadershipDetail') && snap.leadershipDetail) {
    const rows = (snap.leadershipDetail ?? []).map((r, i) => ({
      '#': i + 1,
      date: r.date,
      service: r.service,
      teamLeader: r.teamLeader,
      viceTeamLeader: r.viceTeamLeader,
    }))
    sections.push({
      id: 'leadershipDetail',
      title: 'Leadership by date',
      kind: 'table',
      headers: ['#', 'date', 'service', 'teamLeader', 'viceTeamLeader'],
      rows,
      totalLabel: 'Services',
      totalValue: rows.length,
    })
  }

  if (included(include, 'history') && snap.history) {
    const rows = (snap.history ?? []).map((r, i) => ({
      '#': i + 1,
      label: r.label,
      status: r.status,
      month: r.month,
      publishedBy: r.publishedBy ?? '—',
    }))
    sections.push({
      id: 'history',
      title: 'Schedule version history',
      kind: 'table',
      headers: ['#', 'label', 'status', 'month', 'publishedBy'],
      rows,
      totalLabel: 'Versions',
      totalValue: rows.length,
    })
  }

  if (included(include, 'membersByChoir') && snap.membersByChoir) {
    const rows = (snap.membersByChoir ?? []).map((r, i) => ({
      '#': i + 1,
      choir: r.choir,
      members: r.members,
    }))
    sections.push({
      id: 'membersByChoir',
      title: 'Members by choir',
      kind: 'table',
      headers: ['#', 'choir', 'members'],
      rows,
      totalLabel: 'Choir groups',
      totalValue: rows.length,
    })
  }

  if (included(include, 'usersOverview') && snap.usersOverview) {
    sections.push({
      id: 'usersOverview',
      title: 'User account KPIs',
      kind: 'table',
      headers: ['metric', 'value'],
      rows: kpiRows(snap.usersOverview),
    })
  }

  if (included(include, 'publicGoals') && snap.publicGoals) {
    const rows = (snap.publicGoals ?? []).map((r, i) => ({
      '#': i + 1,
      name: r.name,
      goal: formatRwf(r.goal ?? 0),
      collected: formatRwf(r.collected ?? 0),
      progress: r.progressPct != null ? `${r.progressPct}%` : '—',
    }))
    sections.push({
      id: 'publicGoals',
      title: 'Public ministry goals',
      kind: 'table',
      headers: ['#', 'name', 'goal', 'collected', 'progress'],
      rows,
      totalLabel: 'Public goals',
      totalValue: rows.length,
    })
  }

  if (included(include, 'typesCatalog') && snap.typesCatalog) {
    const rows = (snap.typesCatalog ?? []).map((r, i) => ({
      '#': i + 1,
      name: r.name,
      goal: formatRwf(r.ministry_goal ?? 0),
      frequency: r.frequency,
      status: r.status,
      visibility: r.visibility,
    }))
    sections.push({
      id: 'typesCatalog',
      title: 'Contribution types catalog',
      kind: 'table',
      headers: ['#', 'name', 'goal', 'frequency', 'status', 'visibility'],
      rows,
      totalLabel: 'Types',
      totalValue: rows.length,
    })
  }

  if (included(include, 'methodsCatalog') && snap.methodsCatalog) {
    const rows = (snap.methodsCatalog ?? []).map((r, i) => ({
      '#': i + 1,
      name: r.name,
      channel: r.channel,
      status: r.status,
    }))
    sections.push({
      id: 'methodsCatalog',
      title: 'Payment methods',
      kind: 'table',
      headers: ['#', 'name', 'channel', 'status'],
      rows,
      totalLabel: 'Methods',
      totalValue: rows.length,
    })
  }

  if (included(include, 'memberFinance') && snap.memberFinance) {
    const rows = (snap.memberFinance ?? []).map((r, i) => ({
      '#': i + 1,
      member: r.member,
      claimed: formatRwf(r.claimed ?? 0),
      confirmed: formatRwf(r.confirmed ?? 0),
    }))
    sections.push({
      id: 'memberFinance',
      title: 'Member contribution performance',
      kind: 'table',
      headers: ['#', 'member', 'claimed', 'confirmed'],
      rows,
      totalLabel: 'Members',
      totalValue: rows.length,
    })
  }

  if (included(include, 'followups') && snap.followups) {
    const rows = (snap.followups ?? []).map((r, i) => ({
      '#': i + 1,
      member: r.member_name,
      type: r.contribution_name,
      amount: formatRwf(r.outstanding_amount ?? 0),
      status: r.status,
    }))
    sections.push({
      id: 'followups',
      title: 'Follow-up cases',
      kind: 'table',
      headers: ['#', 'member', 'type', 'amount', 'status'],
      rows,
      totalLabel: 'Follow-ups',
      totalValue: rows.length,
    })
  }

  if (included(include, 'pending') && snap.pending) {
    const rows = (snap.pending ?? []).map((r, i) => ({
      '#': i + 1,
      member: r.member_name,
      type: r.contribution_name,
      claimed: formatRwf(r.claimed_amount ?? 0),
      status: r.status,
    }))
    sections.push({
      id: 'pending',
      title: 'Pending verification',
      kind: 'table',
      headers: ['#', 'member', 'type', 'claimed', 'status'],
      rows,
      totalLabel: 'Pending',
      totalValue: rows.length,
    })
  }

  if (included(include, 'confirmed') && snap.confirmed) {
    const rows = (snap.confirmed ?? []).map((r, i) => ({
      '#': i + 1,
      member: r.member_name,
      type: r.contribution_name,
      confirmed: formatRwf(r.confirmed_amount ?? r.claimed_amount ?? 0),
      status: r.status,
    }))
    sections.push({
      id: 'confirmed',
      title: 'Confirmed payments',
      kind: 'table',
      headers: ['#', 'member', 'type', 'confirmed', 'status'],
      rows,
      totalLabel: 'Confirmed',
      totalValue: rows.length,
    })
  }

  if (included(include, 'activity') && snap.activity) {
    const rows = (snap.activity ?? []).map((r, i) => ({
      '#': i + 1,
      action: r.action,
      actor: r.actor ?? '—',
      when: r.created_at,
    }))
    sections.push({
      id: 'activity',
      title: 'System activity',
      kind: 'table',
      headers: ['#', 'action', 'actor', 'when'],
      rows,
      totalLabel: 'Events',
      totalValue: rows.length,
    })
  }

  return sections
}

function reportTypeLabel(payload) {
  const j = payload.meta?.jurisdiction
  if (j === 'team_duty') return 'TEAM LEADERSHIP REPORT'
  if (j === 'treasurer') return 'FINANCE OFFICE REPORT'
  if (j === 'secretary') return 'SECRETARY OFFICE REPORT'
  if (j === 'coordinator') return 'COORDINATOR OFFICE REPORT'
  if (j === 'president' || j === 'vice_president') return 'LEADERSHIP OFFICE REPORT'
  return 'OFFICE REPORT'
}

function inferPeriod(payload) {
  const duties = payload.snapshot?.dutyMeta?.activeDuties ?? []
  if (duties.length) {
    const dates = duties.map((d) => d.serviceDate).filter(Boolean).sort()
    if (dates.length === 1) return formatDay(dates[0])
    if (dates.length > 1) return `${formatDay(dates[0])} – ${formatDay(dates[dates.length - 1])}`
  }
  const month = payload.snapshot?.overview?.monthLabel
  if (month) return month
  return formatDay(new Date().toISOString())
}

function renderSectionHtml(s, index) {
  const n = index + 1
  const heading = `<h2 class="section-title">${n}. ${escapeHtml(String(s.title).toUpperCase())}</h2>`

  if (s.kind === 'text') {
    return `${heading}<div class="text-block">${escapeHtml(s.text).replace(/\n/g, '<br/>')}</div>`
  }

  const headers = s.headers ?? []
  const head = headers.map((h) => `<th>${escapeHtml(headerLabel(h))}</th>`).join('')
  const body = (s.rows ?? [])
    .map((r) => {
      const cells = headers
        .map((h) => {
          const val = r[h]
          if (h === 'status' || h === 'severity' || h === 'role') return `<td>${statusCell(val)}</td>`
          return `<td>${escapeHtml(val)}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  const total =
    s.totalLabel != null
      ? `<div class="section-total"><span>${escapeHtml(s.totalLabel)}</span><strong>${escapeHtml(s.totalValue)}</strong></div>`
      : ''

  return `${heading}
  <table class="data-table">
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${Math.max(headers.length, 1)}"><em>No rows</em></td></tr>`}</tbody>
  </table>
  ${total}`
}

/** Formal ADEPR Kacyiru office report document HTML (preview + PDF/Excel). */
export function buildOfficeReportPreviewHtml(payload) {
  const sections = buildSections(payload).filter((s) => s.id !== 'cover')
  const title = payload.title || 'Office Report'
  const subtitle = payload.subtitle || ''
  const meta = payload.meta ?? {}
  const generatedAt = meta.generatedAt ?? new Date().toISOString()
  const period = inferPeriod(payload)
  const reportType = reportTypeLabel(payload)
  const reportId = meta.reportId || makeReportReference(title + generatedAt)
  const jurisdictionLabel = ROLE_LABELS[meta.jurisdiction] ?? meta.jurisdiction ?? 'ADEPR Kacyiru'
  const sectionCount = sections.length
  const body = [
    subtitle ? `<p style="margin:-8px 0 18px;color:var(--muted)">${escapeHtml(subtitle)}</p>` : '',
    sections.map((s, i) => renderSectionHtml(s, i)).join('\n'),
  ].join('\n')

  const signatories = normalizeSignatories({
    preparedByName: meta.preparedByName ?? '',
    preparedByRole: meta.preparedByRole ?? '',
    approvedByName: meta.approvedByName ?? '',
    approvedByRole: meta.approvedByRole ?? '',
  })

  return buildFormalReportHtml({
    title,
    productName: 'Time table Management System',
    place: jurisdictionLabel,
    reportType,
    period,
    generatedAt,
    reportId,
    summary: [
      { label: 'Report type', value: reportType },
      { label: 'Period', value: period },
      { label: 'Sections included', value: String(sectionCount) },
    ],
    bodyHtml: body,
    signatories,
    footerExtra: meta.authorEmail ? `Contact: ${meta.authorEmail}` : '',
  })
}

export async function downloadOfficeReportPdf(payload) {
  const { downloadDocumentHtmlAsPdf } = await import('./bulletinPdf.js')
  const html = buildOfficeReportPreviewHtml(payload)
  const safe = String(payload?.title || 'office-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return downloadDocumentHtmlAsPdf(html, { fileName: `pmss-${safe || 'office-report'}.pdf` })
}

export function downloadOfficeReportCsv(payload, filename = 'pmss-office-report.csv') {
  const sections = buildSections(payload)
  const chunks = [`# ${payload.title}`, payload.subtitle ? `# ${payload.subtitle}` : '', '']
  for (const s of sections) {
    chunks.push(`# ${s.title}`)
    if (s.kind === 'text') {
      chunks.push(escapeCsvCell(s.text))
      chunks.push('')
      continue
    }
    chunks.push((s.headers ?? []).join(','))
    for (const r of s.rows ?? []) {
      chunks.push((s.headers ?? []).map((h) => escapeCsvCell(r[h])).join(','))
    }
    chunks.push('')
  }
  downloadBlob(new Blob(['\ufeff' + chunks.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename)
}

export function downloadOfficeReportExcel(payload, filename = 'pmss-office-report.xls') {
  const html = buildOfficeReportPreviewHtml(payload)
  downloadBlob(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }), filename)
}

export { buildSections }
