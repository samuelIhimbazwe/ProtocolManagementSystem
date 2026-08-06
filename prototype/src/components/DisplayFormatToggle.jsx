import { useEffect, useState } from 'react'
import { LayoutGrid, List, Newspaper } from 'lucide-react'
import BulletinEditable from './bulletin/BulletinEditable'

export default function DisplayFormatToggle({ format, onChange }) {
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
    </div>
  )
}

export function BulletinDocument({ id, title, subtitle, children, footer, canEdit = false }) {
  const [docTitle, setDocTitle] = useState(title)
  const [docSubtitle, setDocSubtitle] = useState(subtitle ?? '')
  const [docFooter, setDocFooter] = useState(footer ?? '')
  const [brand, setBrand] = useState('Protocol Ministry')

  useEffect(() => setDocTitle(title), [title])
  useEffect(() => setDocSubtitle(subtitle ?? ''), [subtitle])
  useEffect(() => setDocFooter(footer ?? ''), [footer])

  return (
    <article id={id} className="pmss-bulletin">
      {canEdit && (
        <p className="pmss-bulletin-edit-hint pmss-no-print">
          Click any text to edit — titles, section headings, table cells, and footer.
        </p>
      )}
      <header className="pmss-bulletin-header text-center border-b-2 border-neutral-900 pb-4 mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-semibold">
          <BulletinEditable
            value={brand}
            onChange={canEdit ? setBrand : undefined}
            disabled={!canEdit}
          />
        </p>
        <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mt-1 font-serif">
          <BulletinEditable
            value={docTitle}
            onChange={canEdit ? setDocTitle : undefined}
            disabled={!canEdit}
          />
        </h2>
        {(docSubtitle || canEdit) && (
          <p className="text-sm text-neutral-600 mt-2">
            <BulletinEditable
              value={docSubtitle}
              onChange={canEdit ? setDocSubtitle : undefined}
              disabled={!canEdit}
              placeholder="Subtitle"
            />
          </p>
        )}
      </header>
      <div className="pmss-bulletin-body">{children}</div>
      {(docFooter || canEdit) && (
        <footer className="pmss-bulletin-footer mt-8 pt-4 border-t border-neutral-300 text-xs text-neutral-500 text-center">
          <BulletinEditable
            value={docFooter}
            onChange={canEdit ? setDocFooter : undefined}
            disabled={!canEdit}
            placeholder="Footer"
          />
        </footer>
      )}
    </article>
  )
}

export function BulletinSection({ title, children, canEdit = false }) {
  const [sectionTitle, setSectionTitle] = useState(title)
  useEffect(() => setSectionTitle(title), [title])

  return (
    <section className="mb-6 break-inside-avoid">
      <h3 className="text-sm font-bold uppercase tracking-wide border-b border-neutral-400 pb-1 mb-3 font-serif">
        <BulletinEditable
          value={sectionTitle}
          onChange={canEdit ? setSectionTitle : undefined}
          disabled={!canEdit}
        />
      </h3>
      {children}
    </section>
  )
}
