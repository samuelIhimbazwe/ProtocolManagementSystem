import { useState } from 'react'
import { Repeat2, Trash2 } from 'lucide-react'
import { parseChoirList } from './ChoirCardActions'

/**
 * One choir per row; tap/click a choir to show Remove and Replace.
 */
export default function ChoirAssignmentItems({
  choirs,
  canEdit = false,
  onRemove,
  onReplace,
  compact = false,
}) {
  const list = parseChoirList(choirs)
  const [active, setActive] = useState(null)

  if (list.length === 0) {
    return <p className="text-sm text-neutral-400">No choirs assigned</p>
  }

  return (
    <ul className={`pmss-choir-items ${compact ? 'pmss-choir-items--compact' : ''}`}>
      {list.map((name) => {
        const isOpen = canEdit && active === name
        return (
          <li key={name} className="pmss-choir-item">
            {canEdit ? (
              <button
                type="button"
                onClick={() => setActive(isOpen ? null : name)}
                className={`pmss-choir-item-label${isOpen ? ' is-active' : ''} is-clickable`}
                aria-expanded={isOpen}
              >
                {name}
              </button>
            ) : (
              <span className="pmss-choir-item-label">{name}</span>
            )}
            {isOpen && (
              <div className="pmss-choir-item-actions" role="group" aria-label={`Actions for ${name}`}>
                <button
                  type="button"
                  className="pmss-btn-chip pmss-btn-chip-secondary"
                  onClick={() => {
                    onReplace?.(name)
                    setActive(null)
                  }}
                >
                  <Repeat2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
                  Replace
                </button>
                <button
                  type="button"
                  className="pmss-btn-chip pmss-btn-chip-danger"
                  onClick={() => {
                    onRemove?.(name)
                    setActive(null)
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
                  Remove
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
