import { useState } from 'react'
import { Download, LayoutGrid, List, Newspaper } from 'lucide-react'
import { downloadBulletinPdf } from '../lib/bulletinPdf'

export default function DisplayFormatToggle({
  format,
  onChange,
  bulletinId,
  showPrint = true,
  bulletinTitle = 'Bulletin',
  onToast,
}) {
  const [busy, setBusy] = useState(false)

  const handlePdf = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await downloadBulletinPdf(bulletinId, { title: bulletinTitle })
      onToast?.(`Downloaded ${result?.fileName ?? 'bulletin.pdf'}`)
    } catch (err) {
      onToast?.(err.message ?? 'PDF download failed')
      if (!onToast) window.alert(err.message ?? 'PDF download failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-neutral-500 mr-1 hidden sm:inline">View</span>
      <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50 max-w-full overflow-x-auto">
        <button
          type="button"
          onClick={() => onChange('cards')}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 ${
            format === 'cards' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cards</span>
        </button>
        <button
          type="button"
          onClick={() => onChange('list')}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 ${
            format === 'list' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">List</span>
        </button>
        <button
          type="button"
          onClick={() => onChange('bulletin')}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 ${
            format === 'bulletin' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Newspaper className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Bulletin</span>
        </button>
      </div>
      {showPrint && format === 'bulletin' && bulletinId && (
        <button
          type="button"
          className="pmss-btn-secondary h-8 px-3 text-xs"
          onClick={handlePdf}
          disabled={busy}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{busy ? 'Preparing PDF…' : 'Download PDF'}</span>
          <span className="sm:hidden">{busy ? '…' : 'PDF'}</span>
        </button>
      )}
    </div>
  )
}

export function BulletinDocument({ id, title, subtitle, children, footer }) {
  return (
    <article id={id} className="pmss-bulletin">
      <header className="pmss-bulletin-header text-center border-b-2 border-neutral-900 pb-4 mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-semibold">Protocol Ministry</p>
        <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mt-1 font-serif">{title}</h2>
        {subtitle && <p className="text-sm text-neutral-600 mt-2">{subtitle}</p>}
      </header>
      <div className="pmss-bulletin-body">{children}</div>
      {footer && (
        <footer className="pmss-bulletin-footer mt-8 pt-4 border-t border-neutral-300 text-xs text-neutral-500 text-center">
          {footer}
        </footer>
      )}
    </article>
  )
}

export function BulletinSection({ title, children }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h3 className="text-sm font-bold uppercase tracking-wide border-b border-neutral-400 pb-1 mb-3 font-serif">
        {title}
      </h3>
      {children}
    </section>
  )
}
