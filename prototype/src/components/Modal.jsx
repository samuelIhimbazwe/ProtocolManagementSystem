import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, description, open, onClose, children, footer, wide, xl, dismissible = true }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, dismissible])

  if (!open) return null

  const widthClass = xl ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-md'

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom,0px)]">
      {dismissible ? (
        <button
          type="button"
          className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px]"
          aria-label="Close dialog"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-[2px]" aria-hidden="true" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pmss-modal-title"
        className={`relative w-full ${widthClass} pmss-card p-0 shadow-lg flex flex-col max-h-[min(92dvh,920px)] rounded-t-2xl sm:rounded-[var(--pmss-radius-card)]`}
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-2 border-b border-neutral-100 shrink-0">
          <div className="min-w-0">
            <h2 id="pmss-modal-title" className="font-semibold text-neutral-900 text-base sm:text-lg">
              {title}
            </h2>
            {description && <p className="text-sm text-neutral-500 mt-1">{description}</p>}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="px-4 sm:px-5 py-4 overflow-y-auto overscroll-contain min-h-0 flex-1">{children}</div>
        {footer && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col-reverse sm:flex-row flex-wrap gap-2 sm:justify-end border-t border-neutral-100 pt-4 shrink-0 bg-white [&_button]:w-full sm:[&_button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
