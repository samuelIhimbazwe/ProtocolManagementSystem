import { Pencil, RefreshCw, Repeat2, Shuffle } from 'lucide-react'

export {
  allChoirOptions,
  buildMonthlyChoirAssignments,
  choirSlotKey,
  exclusiveSundayPartners,
  formatChoirSlotDate,
  joinChoirList,
  MUTUAL_EXCLUSIVE_SUNDAY_PAIRS,
  parseChoirList,
  regenerateChoirsForService,
  shuffleCopy,
  siblingSundayChoirs,
  sundayDayChoirs,
} from '../lib/choirEngine'

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
