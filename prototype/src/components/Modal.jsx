import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, description, open, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pmss-modal-title"
        className="relative w-full max-w-md pmss-card p-0 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2 border-b border-neutral-100">
          <div>
            <h2 id="pmss-modal-title" className="font-semibold text-neutral-900">
              {title}
            </h2>
            {description && <p className="text-sm text-neutral-500 mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 pb-5 flex flex-wrap gap-2 justify-end border-t border-neutral-100 pt-4">{footer}</div>}
      </div>
    </div>
  )
}
