import { downloadBlob } from './choirScheduleExport'
import { formatRwf } from './money'
import { downloadDocumentHtmlAsPdf } from './bulletinPdf.js'

const DEFAULT_TITLE = 'TMS Finance Report'

const MONEY_HEADERS = new Set([
  'ministryGoal',
  'memberGoal',
  'claimed',
  'collected',
  'paid',
  'outstanding_amount',
  'outstandingAmount',
  'claimedAmount',
  'confirmedAmount',
  'totalCollected',
  'outstandingBalances',
])

const PCT_HEADERS = new Set(['progressPct', 'goalAchievement'])

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

/** When include is missing or has no keys, all sections export. */
function shouldIncludeSection(include, id) {
  if (!include || typeof include !== 'object') return true
  const keys = Object.keys(include)
  if (keys.length === 0) return true
  return include[id] === true
}

/** Legacy: include.exceptions → partials + declined. */
function normalizeInclude(include) {
  if (!include || typeof include !== 'object') return include
  if (include.exceptions !== true) return include
  return { ...include, partials: true, declined: true }
}

function normalizeOptions(options) {
  const opts = options ?? {}
  return {
    title: opts.title ?? DEFAULT_TITLE,
    subtitle: opts.subtitle ?? '',
    include: normalizeInclude(opts.include),
  }
}

function financeKpis(data) {
  return data?.overview ?? data?.leadership ?? {}
}

function pickFollowup(row, camel, snake) {
  return row[camel] ?? row[snake] ?? ''
}

function mapExceptionRow(r) {
  return {
    memberName: r.memberName ?? r.member_name ?? '',
    contributionName: r.contributionName ?? r.contribution_name ?? '',
    status: r.status ?? '',
    claimedAmount: r.claimedAmount ?? r.claimed_amount ?? '',
    confirmedAmount: r.confirmedAmount ?? r.confirmed_amount ?? '',
  }
}

function mapSubmissionLedgerRow(r, { confirmed = false } = {}) {
  const row = {
    memberName: r.memberName ?? r.member_name ?? '',
    contributionName: r.contributionName ?? r.contribution_name ?? '',
    paymentDate: r.paymentDate ?? r.payment_date ?? '',
    claimedAmount: r.claimedAmount ?? r.claimed_amount ?? '',
    paymentMethodLabel: r.paymentMethodLabel ?? r.payment_method_label ?? '',
    status: r.status ?? '',
  }
  if (confirmed) {
    row.confirmedAmount = r.confirmedAmount ?? r.confirmed_amount ?? ''
  }
  return row
}

/**
 * @returns {{ id: string, title: string, headers: string[], rows: Record<string, unknown>[] }[]}
 */
export function buildSections(data, include, title, subtitle) {
  const bundle = data ?? {}
  const inc = normalizeInclude(include)
  const sections = []
  const generatedAt = new Date().toLocaleString()

  if (shouldIncludeSection(inc, 'cover')) {
    sections.push({
      id: 'cover',
      title: 'Cover & meta',
      headers: ['field', 'value'],
      rows: [
        { field: 'Title', value: title ?? DEFAULT_TITLE },
        ...(subtitle ? [{ field: 'Subtitle', value: subtitle }] : []),
        { field: 'Generated', value: generatedAt },
      ],
    })
  }

  if (shouldIncludeSection(inc, 'financeOverview')) {
    const k = financeKpis(bundle)
    sections.push({
      id: 'financeOverview',
      title: 'Finance KPIs',
      headers: ['metric', 'value'],
      rows: [
        { metric: 'Total collected', value: k.totalCollected ?? '' },
        { metric: 'Pending verification', value: k.pendingVerification ?? '' },
        { metric: 'Outstanding balances', value: k.outstandingBalances ?? '' },
        { metric: 'Active contribution types', value: k.activeTypes ?? '' },
        {
          metric: 'Goal achievement',
          value: k.goalAchievement != null && k.goalAchievement !== '' ? k.goalAchievement : '',
        },
      ],
    })
  }

  if (shouldIncludeSection(inc, 'publicGoals')) {
    sections.push({
      id: 'publicGoals',
      title: 'Public ministry goals',
      headers: ['name', 'ministryGoal', 'collected', 'progressPct'],
      rows: (bundle.publicGoals ?? []).map((g) => ({
        name: g.name ?? '',
        ministryGoal: g.ministryGoal ?? g.ministry_goal ?? '',
        collected: g.collected ?? '',
        progressPct: g.progressPct ?? g.progress_pct ?? '',
      })),
    })
  }

  if (shouldIncludeSection(inc, 'collection')) {
    sections.push({
      id: 'collection',
      title: 'Collection by type',
      headers: ['name', 'ministryGoal', 'claimed', 'collected', 'progressPct'],
      rows: (bundle.collection ?? []).map((r) => ({
        name: r.name ?? '',
        ministryGoal: r.ministryGoal ?? r.ministry_goal ?? '',
        claimed: r.claimed ?? '',
        collected: r.collected ?? '',
        progressPct: r.progressPct ?? r.progress_pct ?? '',
      })),
    })
  }

  if (shouldIncludeSection(inc, 'typesCatalog')) {
    sections.push({
      id: 'typesCatalog',
      title: 'Contribution types catalog',
      headers: ['name', 'category', 'frequency', 'ministryGoal', 'memberGoal', 'status', 'visibility', 'deadline'],
      rows: (bundle.types ?? []).map((t) => ({
        name: t.name ?? '',
        category: t.category ?? '',
        frequency: t.frequency ?? '',
        ministryGoal: t.ministryGoal ?? t.ministry_goal ?? '',
        memberGoal: t.memberGoal ?? t.member_goal ?? '',
        status: t.status ?? '',
        visibility: t.visibility ?? '',
        deadline: t.deadline ?? '',
      })),
    })
  }

  if (shouldIncludeSection(inc, 'methodsCatalog')) {
    sections.push({
      id: 'methodsCatalog',
      title: 'Payment methods',
      headers: ['label', 'kind', 'provider', 'accountName', 'accountNumber', 'active'],
      rows: (bundle.methods ?? []).map((m) => ({
        label: m.label ?? '',
        kind: m.kind ?? '',
        provider: m.provider ?? '',
        accountName: m.accountName ?? m.account_name ?? '',
        accountNumber: m.accountNumber ?? m.account_number ?? '',
        active: m.active === false ? 'No' : m.active === true ? 'Yes' : m.active ?? '',
      })),
    })
  }

  if (shouldIncludeSection(inc, 'members')) {
    sections.push({
      id: 'members',
      title: 'Member contribution performance',
      headers: ['name', 'phone', 'claimed', 'paid'],
      rows: (bundle.members ?? []).map((r) => ({
        name: r.name ?? '',
        phone: r.phone ?? '',
        claimed: r.claimed ?? '',
        paid: r.paid ?? '',
      })),
    })
  }

  if (shouldIncludeSection(inc, 'outstanding')) {
    sections.push({
      id: 'outstanding',
      title: 'Outstanding balances',
      headers: ['member_name', 'contribution_name', 'outstanding_amount', 'status'],
      rows: (bundle.outstanding ?? []).map((r) => ({
        member_name: r.member_name ?? r.memberName ?? '',
        contribution_name: r.contribution_name ?? r.contributionName ?? '',
        outstanding_amount: r.outstanding_amount ?? r.outstandingAmount ?? '',
        status: r.status ?? '',
      })),
    })
  }

  if (shouldIncludeSection(inc, 'followups')) {
    sections.push({
      id: 'followups',
      title: 'Follow-up cases',
      headers: ['memberName', 'contributionName', 'outstandingAmount', 'status'],
      rows: (bundle.followups ?? []).map((r) => ({
        memberName: pickFollowup(r, 'memberName', 'member_name'),
        contributionName: pickFollowup(r, 'contributionName', 'contribution_name'),
        outstandingAmount: pickFollowup(r, 'outstandingAmount', 'outstanding_amount'),
        status: r.status ?? '',
      })),
    })
  }

  if (shouldIncludeSection(inc, 'pending')) {
    sections.push({
      id: 'pending',
      title: 'Pending verification',
      headers: ['memberName', 'contributionName', 'paymentDate', 'claimedAmount', 'paymentMethodLabel', 'status'],
      rows: (bundle.pending ?? []).map((r) => mapSubmissionLedgerRow(r)),
    })
  }

  if (shouldIncludeSection(inc, 'confirmed')) {
    sections.push({
      id: 'confirmed',
      title: 'Confirmed payments',
      headers: [
        'memberName',
        'contributionName',
        'paymentDate',
        'claimedAmount',
        'confirmedAmount',
        'paymentMethodLabel',
        'status',
      ],
      rows: (bundle.confirmed ?? []).map((r) => mapSubmissionLedgerRow(r, { confirmed: true })),
    })
  }

  if (shouldIncludeSection(inc, 'partials')) {
    sections.push({
      id: 'partials',
      title: 'Partial payments',
      headers: ['memberName', 'contributionName', 'status', 'claimedAmount', 'confirmedAmount'],
      rows: (bundle.partials ?? []).map(mapExceptionRow),
    })
  }

  if (shouldIncludeSection(inc, 'declined')) {
    sections.push({
      id: 'declined',
      title: 'Declined payments',
      headers: ['memberName', 'contributionName', 'status', 'claimedAmount', 'confirmedAmount'],
      rows: (bundle.declined ?? []).map(mapExceptionRow),
    })
  }

  return sections
}

function formatDisplayCell(sectionId, header, value, row) {
  if (value === '' || value == null) return '—'
  if (sectionId === 'cover') return String(value)
  if (sectionId === 'financeOverview' && header === 'value' && row?.metric) {
    const [, v] = formatOverviewDisplayRow(row)
    return v
  }
  if (header === 'metric') return String(value)
  if (PCT_HEADERS.has(header)) {
    const n = Number(value)
    return Number.isFinite(n) ? `${n}%` : String(value)
  }
  if (MONEY_HEADERS.has(header)) {
    const n = Number(value)
    if (Number.isFinite(n)) return formatRwf(n)
    return String(value)
  }
  if (header === 'value' && typeof value === 'number' && Number.isFinite(value)) {
    return formatRwf(value)
  }
  return String(value)
}

function formatOverviewDisplayRow(row) {
  const metric = String(row.metric ?? '')
  let raw = row.value
  if (raw === '' || raw == null) return [metric, '—']
  if (metric === 'Goal achievement') {
    const n = Number(raw)
    return [metric, Number.isFinite(n) ? `${n}%` : String(raw)]
  }
  if (metric === 'Pending verification' || metric === 'Active contribution types') {
    return [metric, String(raw)]
  }
  const n = Number(raw)
  if (Number.isFinite(n)) return [metric, formatRwf(n)]
  return [metric, String(raw)]
}

function buildCsvBody(sections) {
  return sections.map((s) => csvSection(s.title, s.headers, s.rows)).join('')
}

function buildPdfHtml(sections, title, subtitle) {
  const parts = []

  const coverSection = sections.find((s) => s.id === 'cover')
  if (coverSection) {
    parts.push(`<h1>${escapeHtml(title)}</h1>`)
    if (subtitle) parts.push(`<p class="subtitle">${escapeHtml(subtitle)}</p>`)
    const gen = coverSection.rows.find((r) => r.field === 'Generated')?.value
    parts.push(`<p class="meta">Generated ${escapeHtml(gen ?? new Date().toLocaleString())}</p>`)
  } else {
    parts.push(`<h1>${escapeHtml(title)}</h1>`)
    if (subtitle) parts.push(`<p class="subtitle">${escapeHtml(subtitle)}</p>`)
    parts.push(`<p class="meta">Generated ${escapeHtml(new Date().toLocaleString())}</p>`)
  }

  for (const section of sections) {
    if (section.id === 'cover') continue

    parts.push(`<h2>${escapeHtml(section.title)}</h2>`)

    if (section.id === 'financeOverview') {
      parts.push('<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>')
      for (const row of section.rows) {
        const [m, v] = formatOverviewDisplayRow(row)
        parts.push(`<tr><td>${escapeHtml(m)}</td><td>${escapeHtml(v)}</td></tr>`)
      }
      parts.push('</tbody></table>')
      continue
    }

    if (!section.rows.length) {
      parts.push('<p><em>No rows</em></p>')
      continue
    }

    parts.push('<table><thead><tr>')
    for (const h of section.headers) {
      parts.push(`<th>${escapeHtml(h)}</th>`)
    }
    parts.push('</tr></thead><tbody>')
    for (const row of section.rows) {
      parts.push('<tr>')
      for (const h of section.headers) {
        parts.push(`<td>${escapeHtml(formatDisplayCell(section.id, h, row[h], row))}</td>`)
      }
      parts.push('</tr>')
    }
    parts.push('</tbody></table>')
  }

  return parts.join('\n')
}

function buildExcelHtml(sections, title, subtitle) {
  const parts = [`<h1>${escapeHtml(title)}</h1>`]
  if (subtitle) parts.push(`<p>${escapeHtml(subtitle)}</p>`)

  for (const section of sections) {
    if (section.id === 'cover') continue

    parts.push(`<h3>${escapeHtml(section.title)}</h3>`)

    if (!section.rows.length) {
      parts.push('<p><em>No rows</em></p>')
      continue
    }

    const head = section.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
    const body = section.rows
      .map((row) => {
        const cells = section.headers.map((h) => {
          let cell
          if (section.id === 'financeOverview') {
            const [, v] = formatOverviewDisplayRow(row)
            cell = h === 'metric' ? row.metric : v
          } else {
            cell = formatDisplayCell(section.id, h, row[h], row)
          }
          return `<td>${escapeHtml(cell)}</td>`
        })
        return `<tr>${cells.join('')}</tr>`
      })
      .join('')

    parts.push(`<table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`)
  }

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body>
  ${parts.join('\n  ')}
</body></html>`
}

export function downloadFinanceReportsCsv(data, filename = 'pmss-finance-report.csv', options) {
  const { title, subtitle, include } = normalizeOptions(options)
  const sections = buildSections(data, include, title, subtitle)
  const preamble = `# ${title}\r\n${subtitle ? `# ${subtitle}\r\n` : ''}\r\n`
  const body = preamble + buildCsvBody(sections)
  const blob = new Blob(['\ufeff', body], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, filename)
}

export function downloadFinanceReportsExcel(data, filename = 'pmss-finance-report.xls', options) {
  const { title, subtitle, include } = normalizeOptions(options)
  const sections = buildSections(data, include, title, subtitle)
  const html = buildExcelHtml(sections, title, subtitle)
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  downloadBlob(blob, filename)
}

export async function downloadFinanceReportsPdf(data, options) {
  const { title, subtitle, include } = normalizeOptions(options)
  const sections = buildSections(data, include, title, subtitle)
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .subtitle { font-size: 13px; color: #333; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
    th { background: #f5f5f5; }
    p { font-size: 12px; color: #555; }
  </style>
</head>
<body>
  ${buildPdfHtml(sections, title, subtitle)}
</body>
</html>`
  const safe = String(title || 'finance-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return downloadDocumentHtmlAsPdf(html, { fileName: `pmss-${safe || 'finance-report'}.pdf` })
}
