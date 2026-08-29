import { Pencil, RefreshCw } from 'lucide-react'

export default function ChoirServiceToolbar({ onRegenerate, onEdit, compact = false }) {
  const btnClass = compact
    ? 'pmss-btn-chip pmss-btn-chip-secondary text-[10px] h-7 px-2 w-full justify-center'
    : 'pmss-btn-chip pmss-btn-chip-secondary'
  const regenClass = compact
    ? 'pmss-btn-chip pmss-btn-chip-accent text-[10px] h-7 px-2 w-full justify-center'
    : 'pmss-btn-chip pmss-btn-chip-accent'

  return (
    <div
      className={`flex gap-1.5 ${compact ? 'flex-col items-stretch mt-2 pt-2 border-t border-neutral-200' : 'flex-wrap justify-end'}`}
    >
      <button type="button" className={btnClass} onClick={onEdit}>
        <Pencil className="w-3 h-3 shrink-0" strokeWidth={2.25} />
        Edit
      </button>
      <button type="button" className={regenClass} onClick={onRegenerate}>
        <RefreshCw className="w-3 h-3 shrink-0" strokeWidth={2.25} />
        Regenerate
      </button>
    </div>
  )
}
