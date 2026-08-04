import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react'

const FORMATS = [
  { id: 'pdf', label: 'PDF', hint: 'Download .pdf file', icon: FileText },
  { id: 'excel', label: 'Excel', hint: '.xls spreadsheet', icon: FileSpreadsheet },
  { id: 'csv', label: 'CSV', hint: 'Comma-separated', icon: Sheet },
]

export default function ScheduleDownloadMenu({ onExport, disabled, label = 'Download schedule', className = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        className="pmss-btn-secondary inline-flex items-center gap-2 w-full justify-center"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Download className="w-4 h-4" />
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 min-w-[11rem] rounded-card border border-neutral-200 bg-white shadow-md py-1 pmss-no-print"
          role="menu"
        >
          {FORMATS.map(({ id, label: fmtLabel, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 flex items-start gap-2.5"
              onClick={() => {
                setOpen(false)
                onExport(id)
              }}
            >
              <Icon className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" strokeWidth={2} />
              <span>
                <span className="block text-sm font-semibold text-neutral-900">{fmtLabel}</span>
                <span className="block text-[11px] text-neutral-500">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
