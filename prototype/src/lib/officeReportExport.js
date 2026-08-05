import { downloadBlob } from './choirScheduleExport'
import { formatRwf } from './money'
import { ROLE_LABELS } from './officeReportBuilder'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
    return String(iso).slice(0, 16).replace('T', ' ')
  }
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDay(iso) {
  if (!iso) return '—'
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return formatDisplayDate(iso).slice(0, 10)
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

/** Formal TMS office report document HTML (preview + PDF/Excel). */
export function buildOfficeReportPreviewHtml(payload) {
  const sections = buildSections(payload).filter((s) => s.id !== 'cover')
  const title = payload.title || 'Office Report'
  const subtitle = payload.subtitle || 'Office Report'
  const meta = payload.meta ?? {}
  const generatedAt = meta.generatedAt ?? new Date().toISOString()
  const generatedLabel = formatDisplayDate(generatedAt)
  const period = inferPeriod(payload)
  const reportType = reportTypeLabel(payload)
  const reportId =
    meta.reportId ||
    `RPT-${new Date().getFullYear()}-${String(Math.abs(hashCode(title + generatedAt)) % 100000).padStart(5, '0')}`
  const jurisdictionLabel = ROLE_LABELS[meta.jurisdiction] ?? meta.jurisdiction ?? 'Protocol Ministry'
  const authorName = meta.authorName ?? '—'
  const authorRole = (ROLE_LABELS[meta.authorRole] ?? meta.authorRole ?? 'OFFICE').toUpperCase()
  const authorEmail = meta.authorEmail ?? ''
  const recipientName = meta.recipientName ?? '—'
  const recipientRole = (ROLE_LABELS[meta.recipientRole] ?? meta.recipientRole ?? 'LEADER').toUpperCase()
  const sectionCount = sections.length

  const body = sections.map((s, i) => renderSectionHtml(s, i)).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --ink: #14261c;
    --green: #0f5c3a;
    --green-dark: #0a3f28;
    --muted: #5b6b62;
    --line: #d7e0da;
    --wash: #f4f7f5;
    --ok-bg: #e7f5ec;
    --ok-fg: #0f5c3a;
    --warn-bg: #fff4e0;
    --warn-fg: #9a6700;
    --bad-bg: #fde8e8;
    --bad-fg: #b42318;
    --accent: #c27803;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 32px 36px;
    color: var(--ink);
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    background: #fff;
  }
  .doc-header {
    display: grid;
    grid-template-columns: 1fr 2.2fr 1.2fr;
    gap: 16px;
    align-items: start;
    margin-bottom: 18px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand-mark {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: linear-gradient(135deg, #0f5c3a, #1d7a52 45%, #c27803);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.04em;
  }
  .brand-name {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--green-dark);
  }
  .brand-sub {
    font-size: 10px;
    color: var(--muted);
    margin-top: 2px;
  }
  .titles { text-align: center; padding-top: 2px; }
  .titles .product {
    margin: 0;
    font-size: 26px;
    font-weight: 800;
    color: var(--green);
    letter-spacing: 0.04em;
  }
  .titles .doc-kind {
    margin: 4px 0 0;
    font-size: 15px;
    font-weight: 600;
    color: #1a1a1a;
  }
  .titles .place {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .titles .type-line {
    margin: 4px 0 0;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .meta-right {
    text-align: right;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.55;
  }
  .meta-right strong { color: var(--ink); font-weight: 600; }
  .meta-right .rid { color: var(--accent); font-weight: 700; }
  .summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border-top: 3px solid var(--green);
    background: var(--wash);
    margin: 8px 0 22px;
  }
  .summary > div {
    padding: 12px 14px;
    border-right: 1px solid var(--line);
  }
  .summary > div:last-child { border-right: 0; }
  .summary .lbl {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .summary .val {
    font-size: 15px;
    font-weight: 800;
    color: var(--green);
  }
  .section-title {
    margin: 22px 0 10px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #111;
  }
  .text-block {
    background: var(--wash);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 12px 14px;
    white-space: pre-wrap;
    line-height: 1.5;
    margin-bottom: 8px;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }
  .data-table th {
    background: var(--green);
    color: #fff;
    text-align: left;
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .data-table td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  .data-table tbody tr:nth-child(even) td { background: #fafcfb; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }
  .badge-ok { background: var(--ok-bg); color: var(--ok-fg); }
  .badge-warn { background: var(--warn-bg); color: var(--warn-fg); }
  .badge-bad { background: var(--bad-bg); color: var(--bad-fg); }
  .section-total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 6px 0 4px;
    font-size: 12px;
  }
  .section-total strong {
    font-size: 20px;
    color: var(--green);
    font-weight: 800;
  }
  .signoff {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 36px;
    padding-top: 8px;
  }
  .signoff h3 {
    margin: 0 0 18px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .sign-line {
    border-bottom: 1px solid #222;
    height: 28px;
    margin-bottom: 10px;
  }
  .signoff .name { font-weight: 800; font-size: 13px; }
  .signoff .role {
    margin-top: 2px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .signoff .when {
    margin-top: 4px;
    font-size: 11px;
    color: var(--muted);
  }
  .doc-footer {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: 10px;
    color: var(--muted);
    line-height: 1.45;
  }
  @media print {
    body { padding: 12px; }
    .summary, .data-table th, .badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <header class="doc-header">
    <div class="brand">
      <div class="brand-mark">PM</div>
      <div>
        <div class="brand-name">TMS</div>
        <div class="brand-sub">Protocol Ministry</div>
      </div>
    </div>
    <div class="titles">
      <p class="product">TMS</p>
      <p class="doc-kind">${escapeHtml(title)}</p>
      <p class="place">${escapeHtml(jurisdictionLabel)} — ADEPR Kacyiru</p>
      <p class="type-line">Type: ${escapeHtml(reportType)}</p>
    </div>
    <div class="meta-right">
      <div>Reporting period: <strong>${escapeHtml(period)}</strong></div>
      <div>Generated: <strong>${escapeHtml(generatedLabel)}</strong></div>
      <div>Report ID: <span class="rid">${escapeHtml(reportId)}</span></div>
    </div>
  </header>

  <div class="summary">
    <div>
      <div class="lbl">Report type</div>
      <div class="val">${escapeHtml(reportType)}</div>
    </div>
    <div>
      <div class="lbl">Period</div>
      <div class="val" style="font-size:14px">${escapeHtml(period)}</div>
    </div>
    <div>
      <div class="lbl">Sections included</div>
      <div class="val">${escapeHtml(sectionCount)}</div>
    </div>
  </div>

  ${subtitle ? `<p style="margin:-8px 0 18px;color:var(--muted)">${escapeHtml(subtitle)}</p>` : ''}

  ${body || '<p style="color:var(--muted)"><em>No sections selected.</em></p>'}

  <div class="signoff">
    <div>
      <h3>Prepared by</h3>
      <div class="sign-line"></div>
      <div class="name">${escapeHtml(authorName)}</div>
      <div class="role">${escapeHtml(authorRole)}</div>
      <div class="when">${escapeHtml(generatedLabel)}</div>
    </div>
    <div>
      <h3>Approved by</h3>
      <div class="sign-line"></div>
      <div class="name">${escapeHtml(recipientName)}</div>
      <div class="role">${escapeHtml(recipientRole)}</div>
      <div class="when">Date: _______________</div>
    </div>
  </div>

  <footer class="doc-footer">
    Generated on: ${escapeHtml(generatedLabel)}
    ${authorEmail ? ` | Generated by: ${escapeHtml(authorEmail)}` : ''}
    | © ${new Date().getFullYear()} TMS — Time Table Management System, ADEPR Kacyiru. Confidential.
  </footer>
</body>
</html>`
}

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return h
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
