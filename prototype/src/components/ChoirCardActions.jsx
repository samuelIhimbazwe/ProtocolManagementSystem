import { Pencil, RefreshCw, Repeat2, Shuffle } from 'lucide-react'

const actions = [
  { id: 'edit', label: 'Edit', icon: Pencil, style: 'primary' },
  { id: 'replace', label: 'Replace choir', icon: Repeat2, style: 'secondary' },
  { id: 'swap', label: 'Swap', icon: Shuffle, style: 'secondary' },
  { id: 'regenerate', label: 'Regenerate', icon: RefreshCw, style: 'accent' },
]

export default function ChoirCardActions({ onAction }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ id, label, icon: Icon, style }) => (
        <button
          key={id}
          type="button"
          onClick={() => onAction(id)}
          className={`pmss-btn-chip pmss-btn-chip-${style}`}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
          {label}
        </button>
      ))}
    </div>
  )
}

export function parseChoirList(choirs) {
  return choirs
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinChoirList(list) {
  return list.join(', ')
}

export function shuffleCopy(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Demo auto-assign choirs for a service slot */
export function regenerateChoirsForService(service, choirsCatalog) {
  const { primary, secondary, special } = choirsCatalog
  const pickN = (pool, n) => shuffleCopy(pool).slice(0, Math.min(n, pool.length))

  if (service === 'Sunday Service 1') {
    const pool = primary.filter((c) => c !== 'Hope Choir')
    return joinChoirList(['Hope Choir', ...pickN(pool, 2)])
  }
  if (service === 'Sunday Service 2') {
    return joinChoirList(pickN([...primary, ...secondary], 3))
  }
  if (service === 'Igaburo Service') {
    return joinChoirList(pickN(primary, 2))
  }
  if (service === 'Tuesday Service' || service === 'Friday Service') {
    return joinChoirList(pickN(primary, 1))
  }
  return joinChoirList(pickN(primary, 2))
}

export function allChoirOptions(choirsCatalog) {
  return [...choirsCatalog.special, ...choirsCatalog.primary, ...choirsCatalog.secondary]
}
