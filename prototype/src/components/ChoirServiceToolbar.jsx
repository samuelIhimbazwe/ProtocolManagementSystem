import { Pencil, RefreshCw } from 'lucide-react'

export default function ChoirServiceToolbar({ onRegenerate, onEdit }) {
  return (
    <div className="flex flex-wrap gap-2 justify-end">
      <button type="button" className="pmss-btn-chip pmss-btn-chip-secondary" onClick={onEdit}>
        <Pencil className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
        Edit
      </button>
      <button type="button" className="pmss-btn-chip pmss-btn-chip-accent" onClick={onRegenerate}>
        <RefreshCw className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
        Regenerate
      </button>
    </div>
  )
}
