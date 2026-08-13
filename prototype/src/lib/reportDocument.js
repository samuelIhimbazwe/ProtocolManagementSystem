/**
 * Shared formal ADEPR Kacyiru report chrome — used by ministry, finance, and office PDFs.
 * Matches the printed campaign-style layout: logo + church, title block, meta, summary, sign-off.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Public ADEPR triangle logo (dove / cross / book). */
export function reportLogoSrc() {
  const base = import.meta.env.BASE_URL || '/'
  const path = `${base}images/adepr-kacyiru-logo.png`.replace(/\/{2,}/g, '/')
  if (typeof window === 'undefined') return path
  try {
    return new URL(path, window.location.href).href
  } catch {
    return path
  }
}

export function formatReportStamp(iso = new Date().toISOString()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
    return String(iso).slice(0, 16).replace('T', ' ')
  }
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatReportDay(iso) {
  if (!iso) return '—'
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return formatReportStamp(iso).slice(0, 10)
}

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return h
}

export function makeReportReference(seed = '') {
  const year = new Date().getFullYear()
  const n = String(Math.abs(hashCode(String(seed) + Date.now())) % 100000).padStart(5, '0')
  return `RPT-${year}-${n}`
}

/** Empty signatory bag used by report builders. */
export function emptySignatories() {
  return {
    preparedByName: '',
    preparedByRole: '',
    approvedByName: '',
    approvedByRole: '',
  }
}

/**
 * Normalize signatory options from export payloads / ReportBuilder.
 * Never invent fixed people — blank fields stay blank for the user to fill.
 */
export function normalizeSignatories(options = {}) {
  const s = options.signatories ?? options
  return {
    preparedByName: String(s.preparedByName ?? s.authorName ?? '').trim(),
    preparedByRole: String(s.preparedByRole ?? s.authorRole ?? '').trim(),
    approvedByName: String(s.approvedByName ?? s.recipientName ?? '').trim(),
    approvedByRole: String(s.approvedByRole ?? s.recipientRole ?? '').trim(),
  }
}

export const FORMAL_REPORT_CSS = `
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
    grid-template-columns: 1.15fr 2fr 1.25fr;
    gap: 16px;
    align-items: start;
    margin-bottom: 18px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand-logo {
    width: 56px;
    height: 56px;
    object-fit: contain;
    display: block;
  }
  .brand-name {
    font-size: 16px;
    font-weight: 800;
    color: #1a1a1a;
    letter-spacing: 0.01em;
  }
  .brand-sub {
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }
  .titles { text-align: center; padding-top: 2px; }
  .titles .product {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: var(--green);
    letter-spacing: 0.01em;
  }
  .titles .doc-kind {
    margin: 6px 0 0;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #111;
  }
  .titles .type-line {
    margin: 6px 0 0;
    font-size: 11px;
    color: var(--muted);
  }
  .meta-right {
    text-align: right;
    font-size: 11px;
    color: #222;
    line-height: 1.55;
  }
  .meta-right .rid {
    color: var(--accent);
    font-weight: 800;
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: var(--wash);
    border: 1px solid var(--line);
    border-radius: 6px;
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
    border-top: 2px solid var(--green);
    padding-top: 8px;
  }
  .section-total strong {
    font-size: 20px;
    color: var(--green);
    font-weight: 800;
  }
  .signoff {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    margin-top: 40px;
    padding-top: 8px;
  }
  .signoff h3 {
    margin: 0 0 18px;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--green);
    font-weight: 800;
  }
  .sign-line {
    border-bottom: 1px solid #222;
    height: 32px;
    margin-bottom: 10px;
  }
  .signoff .name {
    font-weight: 800;
    font-size: 13px;
    min-height: 1.2em;
  }
  .signoff .role {
    margin-top: 2px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink);
    min-height: 1.2em;
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
`

/**
 * Wrap report body HTML in the formal ADEPR document shell.
 *
 * @param {object} opts
 * @param {string} opts.title - Main document title (center)
 * @param {string} [opts.productName='Time table Management System']
 * @param {string} [opts.place='ADEPR Kacyiru']
 * @param {string} [opts.reportType]
 * @param {string} [opts.period]
 * @param {string} [opts.generatedAt]
 * @param {string} [opts.reportId]
 * @param {{label:string,value:string}[]} [opts.summary] - up to 3 summary cells
 * @param {string} opts.bodyHtml
 * @param {{preparedByName?:string,preparedByRole?:string,approvedByName?:string,approvedByRole?:string}} [opts.signatories]
 * @param {string} [opts.footerExtra]
 */
export function buildFormalReportHtml(opts) {
  const title = opts.title || 'Report'
  const productName = opts.productName || 'Time table Management System'
  const place = opts.place || 'ADEPR Kacyiru'
  const reportType = opts.reportType || title
  const generatedAt = opts.generatedAt || new Date().toISOString()
  const generatedLabel = formatReportStamp(generatedAt)
  const period = opts.period || generatedLabel.slice(0, 10)
  const reportId = opts.reportId || makeReportReference(title)
  const logo = reportLogoSrc()
  const sig = normalizeSignatories(opts.signatories ?? {})

  const summary = (opts.summary ?? [
    { label: 'Report type', value: reportType },
    { label: 'Period', value: period },
    { label: 'Sections', value: '—' },
  ]).slice(0, 3)

  while (summary.length < 3) {
    summary.push({ label: '—', value: '—' })
  }

  const summaryHtml = summary
    .map(
      (cell) => `
    <div>
      <div class="lbl">${escapeHtml(cell.label)}</div>
      <div class="val">${escapeHtml(cell.value)}</div>
    </div>`,
    )
    .join('')

  const preparedName = sig.preparedByName || '________________'
  const preparedRole = sig.preparedByRole || '________________'
  const approvedName = sig.approvedByName || '________________'
  const approvedRole = sig.approvedByRole || '________________'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>${FORMAL_REPORT_CSS}</style>
</head>
<body>
  <header class="doc-header">
    <div class="brand">
      <img class="brand-logo" src="${escapeHtml(logo)}" alt="ADEPR Kacyiru" width="56" height="56" />
      <div>
        <div class="brand-name">ADEPR Kacyiru</div>
        <div class="brand-sub">Time table Management</div>
      </div>
    </div>
    <div class="titles">
      <p class="product">${escapeHtml(productName)}</p>
      <p class="doc-kind">${escapeHtml(title)}</p>
      <p class="type-line">Type: ${escapeHtml(reportType)} · ${escapeHtml(place)}</p>
    </div>
    <div class="meta-right">
      <div>Reporting period: <strong>${escapeHtml(period)}</strong></div>
      <div>Generated: <strong>${escapeHtml(generatedLabel)}</strong></div>
      <div>Report Reference: <span class="rid">${escapeHtml(reportId)}</span></div>
    </div>
  </header>

  <div class="summary">
    ${summaryHtml}
  </div>

  ${opts.bodyHtml || '<p style="color:var(--muted)"><em>No content selected.</em></p>'}

  <div class="signoff">
    <div>
      <h3>Prepared by</h3>
      <div class="sign-line"></div>
      <div class="name">${escapeHtml(preparedName)}</div>
      <div class="role">${escapeHtml(preparedRole)}</div>
      <div class="when">${escapeHtml(generatedLabel)}</div>
    </div>
    <div>
      <h3>Approved by</h3>
      <div class="sign-line"></div>
      <div class="name">${escapeHtml(approvedName)}</div>
      <div class="role">${escapeHtml(approvedRole)}</div>
      <div class="when">Date: _______________</div>
    </div>
  </div>

  <footer class="doc-footer">
    Generated on: ${escapeHtml(generatedLabel)}
    ${opts.footerExtra ? ` | ${escapeHtml(opts.footerExtra)}` : ''}
    | © ${new Date().getFullYear()} Time table Management System — ADEPR Kacyiru. Confidential.
  </footer>
</body>
</html>`
}

/** Simple table section HTML for ministry/finance formal PDFs. */
export function formalTableSection(sectionTitle, headers, rows, { index, totalLabel, totalValue } = {}) {
  const heading = `<h2 class="section-title">${index != null ? `${index}. ` : ''}${escapeHtml(sectionTitle)}</h2>`
  if (!headers?.length) {
    return `${heading}<div class="text-block">${escapeHtml(rows?.[0]?.text ?? '—')}</div>`
  }
  const head = headers.map((h) => `<th>${escapeHtml(String(h).toUpperCase())}</th>`).join('')
  const body = (rows ?? [])
    .map((r) => {
      const cells = headers.map((h) => `<td>${escapeHtml(r[h])}</td>`).join('')
      return `<tr>${cells}</tr>`
    })
    .join('')
  const total =
    totalLabel != null
      ? `<div class="section-total"><span>${escapeHtml(totalLabel)}</span><strong>${escapeHtml(totalValue)}</strong></div>`
      : ''
  return `${heading}
  <table class="data-table">
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${Math.max(headers.length, 1)}"><em>No rows</em></td></tr>`}</tbody>
  </table>
  ${total}`
}
