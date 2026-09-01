import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

function absolutizeUrl(href) {
  if (!href) return href
  try {
    return new URL(href, window.location.href).href
  } catch {
    return href
  }
}

function slugify(title) {
  return (
    String(title ?? 'bulletin')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'bulletin'
  )
}

function prepareBulletinClone(el) {
  const clone = el.cloneNode(true)
  clone.querySelectorAll('.pmss-no-print, .pmss-bulletin-edit-hint').forEach((n) => n.remove())
  clone.querySelectorAll('[contenteditable]').forEach((n) => {
    n.removeAttribute('contenteditable')
    n.classList.remove('pmss-bulletin-editable')
  })
  clone.querySelectorAll('img[src]').forEach((img) => {
    img.setAttribute('src', absolutizeUrl(img.getAttribute('src')))
  })
  Object.assign(clone.style, {
    position: 'static',
    left: 'auto',
    top: 'auto',
    width: '100%',
    maxWidth: 'none',
    margin: '0',
    boxShadow: 'none',
    border: 'none',
    background: '#ffffff',
    overflow: 'visible',
  })
  return clone
}

async function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.onload = resolve
              img.onerror = resolve
            }),
    ),
  )
}

function addCanvasAsSinglePage(pdf, canvas, { marginMm = 6 } = {}) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const usableWidth = pageWidth - marginMm * 2
  const usableHeight = pageHeight - marginMm * 2
  const ratio = canvas.height / Math.max(canvas.width, 1)
  let imgWidthMm = usableWidth
  let imgHeightMm = imgWidthMm * ratio
  if (imgHeightMm > usableHeight) {
    imgHeightMm = usableHeight
    imgWidthMm = imgHeightMm / ratio
  }
  const x = marginMm + (usableWidth - imgWidthMm) / 2
  const y = marginMm
  const pageData = canvas.toDataURL('image/jpeg', 0.92)
  pdf.addImage(pageData, 'JPEG', x, y, imgWidthMm, imgHeightMm)
}

function addCanvasPagesToPdf(pdf, canvas, { marginMm = 8, singlePage = false } = {}) {
  if (singlePage) {
    addCanvasAsSinglePage(pdf, canvas, { marginMm })
    return
  }
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const usableWidth = pageWidth - marginMm * 2
  const usableHeight = pageHeight - marginMm * 2
  const imgWidthMm = usableWidth
  const pxPerMm = canvas.width / imgWidthMm
  const pageHeightPx = Math.floor(usableHeight * pxPerMm)

  let y = 0
  let page = 0
  while (y < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - y)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = sliceHeight
    const ctx = pageCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    ctx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
    const pageData = pageCanvas.toDataURL('image/jpeg', 0.92)
    const sliceMm = sliceHeight / pxPerMm
    if (page > 0) pdf.addPage()
    pdf.addImage(pageData, 'JPEG', marginMm, marginMm, imgWidthMm, sliceMm)
    y += sliceHeight
    page += 1
  }
}

/**
 * Renders arbitrary HTML in an offscreen host and downloads a real PDF file.
 */
export async function downloadHtmlDocumentAsPdf(html, { fileName = 'document.pdf', widthPx = 794 } = {}) {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${widthPx}px`,
    padding: '16px',
    background: '#ffffff',
    zIndex: '-1',
    pointerEvents: 'none',
    color: '#111111',
  })
  host.innerHTML = html
  document.body.appendChild(host)

  try {
    await waitForImages(host)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const canvas = await html2canvas(host, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(host.scrollWidth, widthPx),
      windowHeight: Math.max(host.scrollHeight, 200),
    })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    addCanvasPagesToPdf(pdf, canvas, { marginMm: 8 })
    pdf.save(fileName)
    return { fileName }
  } finally {
    host.remove()
  }
}

/** Full HTML documents (with &lt;style&gt; / &lt;body&gt;) → real PDF download. */
export async function downloadDocumentHtmlAsPdf(fullHtml, { fileName = 'document.pdf', widthPx = 794 } = {}) {
  const styles = (String(fullHtml).match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join('\n')
  const body = String(fullHtml).match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? fullHtml
  return downloadHtmlDocumentAsPdf(`${styles}${body}`, { fileName, widthPx })
}

function bulletinCaptureStyles({ landscape = false, protocol = false } = {}) {
  if (protocol && landscape) {
    return `
    .pmss-bulletin-week-row,
    .pmss-bulletin-service-row {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
    }
    .pmss-bulletin-week-row--protocol {
      grid-template-columns: repeat(var(--pmss-protocol-week-cols, 4), minmax(0, 1fr)) !important;
    }
    .pmss-bulletin-week-col + .pmss-bulletin-week-col,
    .pmss-bulletin-service-cell + .pmss-bulletin-service-cell {
      border-top: none !important;
      border-left: 1px solid #333 !important;
    }
    .pmss-bulletin-week-col--blank,
    .pmss-bulletin-service-cell--blank { display: none !important; }
    .pmss-bulletin-week-col--empty { display: none !important; }
    .pmss-no-print { display: none !important; }
    .pmss-bulletin-member-list { list-style: none !important; padding-left: 0 !important; margin: 0 !important; font-size: 10.5px !important; line-height: 1.45 !important; }
    .pmss-bulletin-member-list > li { display: flex !important; align-items: baseline !important; gap: 0.35em !important; padding: 1px 0 !important; }
    .pmss-bulletin-member-index { flex: 0 0 1.2rem !important; text-align: right !important; line-height: inherit !important; }
    .pmss-bulletin-logo-img { height: 2.4rem !important; }
    .pmss-bulletin-masthead { padding-bottom: 6px !important; margin-bottom: 8px !important; }
    .pmss-bulletin-church-line { font-size: 11px !important; margin-top: 2px !important; }
    .pmss-bulletin-main-title { font-size: 13px !important; margin-top: 4px !important; }
    .pmss-bulletin-week-col { padding: 8px 10px 10px !important; }
    .pmss-bulletin-service-cell { padding: 6px 8px 8px !important; }
    .pmss-bulletin-service-block { margin-bottom: 10px !important; }
    .pmss-bulletin-service-bar { font-size: 10px !important; padding: 4px 8px !important; margin-bottom: 4px !important; }
    .pmss-bulletin-service-bar--igaburo { background-color: #b8ddb8 !important; }
    .pmss-bulletin-week-heading { font-size: 10.5px !important; padding: 4px 6px !important; margin-bottom: 8px !important; }
    .pmss-bulletin-signatures { font-size: 8px !important; margin-top: 6px !important; padding: 5px 8px !important; }
  `
  }

  return `
    .pmss-bulletin-week-row,
    .pmss-bulletin-service-row {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
    }
    .pmss-bulletin-week-row--protocol {
      grid-template-columns: repeat(var(--pmss-protocol-week-cols, 4), minmax(0, 1fr)) !important;
    }
    .pmss-bulletin-week-col + .pmss-bulletin-week-col,
    .pmss-bulletin-service-cell + .pmss-bulletin-service-cell {
      border-top: none !important;
      border-left: 1px solid #333 !important;
    }
    .pmss-bulletin-week-col--blank,
    .pmss-bulletin-service-cell--blank { display: none !important; }
    .pmss-bulletin-week-col--empty { display: none !important; }
    .pmss-no-print { display: none !important; }
    .pmss-bulletin-member-list { list-style: none !important; padding-left: 0 !important; margin: 0 !important; font-size: 8px !important; line-height: 1.12 !important; }
    .pmss-bulletin-member-list > li { display: flex !important; align-items: baseline !important; gap: 0.25em !important; padding: 0 !important; }
    .pmss-bulletin-member-index { flex: 0 0 1.05rem !important; text-align: right !important; line-height: inherit !important; }
    .pmss-bulletin-logo-img { height: 2.1rem !important; }
    .pmss-bulletin-masthead { padding-bottom: 4px !important; margin-bottom: 4px !important; }
    .pmss-bulletin-church-line { font-size: 10px !important; margin-top: 1px !important; }
    .pmss-bulletin-main-title { font-size: 11px !important; margin-top: 2px !important; }
    .pmss-bulletin-service-cell { padding: 3px 5px 4px !important; }
    .pmss-bulletin-service-block { margin-bottom: 0 !important; }
    .pmss-bulletin-service-bar { font-size: 8px !important; padding: 2px 4px !important; margin-bottom: 1px !important; }
    .pmss-bulletin-service-bar--igaburo { background-color: #b8ddb8 !important; }
    .pmss-bulletin-week-heading { font-size: 8px !important; padding: 2px 4px !important; margin-bottom: 2px !important; }
    .pmss-bulletin-protocol-note { font-size: 7.5px !important; margin-top: 4px !important; padding: 4px 6px !important; background-color: #f5e6a8 !important; }
    .pmss-bulletin-signatures { font-size: 7.5px !important; margin-top: 4px !important; padding: 4px 6px !important; }
  `
}

/**
 * Renders the on-screen bulletin and downloads a real PDF file.
 */
export async function downloadBulletinPdf(
  elementId,
  { title = 'Bulletin', fileName, orientation = 'portrait' } = {},
) {
  const el = document.getElementById(elementId)
  if (!el) {
    throw new Error('Bulletin not found — switch to Bulletin view first')
  }

  const landscape = orientation === 'landscape'
  const protocol = el.classList.contains('pmss-bulletin--protocol')
  const captureWidth = landscape ? 1120 : 794

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${captureWidth}px`,
    padding: landscape ? '12px 16px' : '6px',
    background: '#ffffff',
    zIndex: '-1',
    pointerEvents: 'none',
  })

  const style = document.createElement('style')
  style.textContent = bulletinCaptureStyles({ landscape, protocol })
  const clone = prepareBulletinClone(el)
  host.appendChild(style)
  host.appendChild(clone)
  document.body.appendChild(host)

  try {
    await waitForImages(clone)
    // Let layout settle after clone + absolute image URLs
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(clone.scrollWidth, captureWidth),
      windowHeight: Math.max(clone.scrollHeight, 200),
    })

    const pdf = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    })
    addCanvasPagesToPdf(pdf, canvas, { marginMm: landscape ? 8 : 6, singlePage: true })
    const name = fileName ?? `pmss-${slugify(title)}.pdf`
    pdf.save(name)
    return { fileName: name }
  } finally {
    host.remove()
  }
}
