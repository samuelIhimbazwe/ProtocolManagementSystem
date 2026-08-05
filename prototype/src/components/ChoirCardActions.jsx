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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format ISO date as bulletin-style "06 Sep". */
export function formatChoirSlotDate(isoDate) {
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(isoDate)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTH_LABELS[d.getUTCMonth()]}`
}

/**
 * Build choir assignments for every service in the monthly calendar.
 * Works for any month once the calendar has been generated.
 */
export function buildMonthlyChoirAssignments(services, choirsCatalog) {
  return [...(services ?? [])]
    .filter((s) => s?.name && s?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.name).localeCompare(String(b.name)))
    .map((s) => ({
      service: s.name,
      date: formatChoirSlotDate(s.date),
      serviceDate: s.date,
      choirs: regenerateChoirsForService(s.name, choirsCatalog),
      status: 'Assigned',
    }))
}
