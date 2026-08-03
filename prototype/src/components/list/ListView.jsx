/**
 * Styled table layout for Cards | List | Bulletin “List” mode.
 */
export function ListView({ title, description, count, children, className = '' }) {
  return (
    <section className={`pmss-list-view space-y-3 ${className}`}>
      {(title || description || count != null) && (
        <header className="flex flex-wrap items-end justify-between gap-2 px-0.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>}
            {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
          </div>
          {count != null && (
            <span className="text-xs font-medium text-neutral-500 tabular-nums">
              {count} {count === 1 ? 'row' : 'rows'}
            </span>
          )}
        </header>
      )}
      <div className="pmss-list-view-table-wrap">{children}</div>
    </section>
  )
}

export function ListViewTable({ columns, rows, emptyMessage = 'No items to show.' }) {
  if (!rows.length) {
    return (
      <div className="pmss-list-view-empty">
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="pmss-list-view-table w-full">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.headerClassName ?? ''}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((col) => (
                <td key={col.key} className={[col.cellClassName, col.align === 'right' ? 'text-right' : ''].filter(Boolean).join(' ')}>
                  {col.render ? col.render(row, i) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ListViewTags({ items, max = 0 }) {
  const visible = max > 0 && items.length > max ? items.slice(0, max) : items
  const rest = max > 0 ? items.length - visible.length : 0

  return (
    <div className="pmss-list-tags">
      {visible.map((label) => (
        <span key={label} className="pmss-list-tag">
          {label}
        </span>
      ))}
      {rest > 0 && <span className="pmss-list-tag pmss-list-tag-more">+{rest} more</span>}
    </div>
  )
}

export function ListViewLeaderCell({ teamLeader, viceTeamLeader }) {
  if (!teamLeader && !viceTeamLeader) {
    return <span className="text-neutral-400 text-sm">—</span>
  }

  return (
    <div className="pmss-list-leaders">
      {teamLeader && (
        <div className="pmss-list-leader-row">
          <span className="pmss-list-leader-badge pmss-list-leader-badge-tl">TL</span>
          <span className="text-sm text-neutral-800">{teamLeader}</span>
        </div>
      )}
      {viceTeamLeader && (
        <div className="pmss-list-leader-row">
          <span className="pmss-list-leader-badge pmss-list-leader-badge-vtl">VTL</span>
          <span className="text-sm text-neutral-800">{viceTeamLeader}</span>
        </div>
      )}
    </div>
  )
}

export function ListViewSizeBadge({ size, max }) {
  const full = max != null && size >= max
  return (
    <span className={`pmss-list-size ${full ? 'pmss-list-size-full' : ''}`}>
      <span className="pmss-list-size-value">{size}</span>
      {max != null && <span className="pmss-list-size-max">/{max}</span>}
    </span>
  )
}

export function ListViewSummaryGrid({ items }) {
  return (
    <div className="pmss-list-summary-grid">
      {items.map((item, i) => (
        <div key={item.label} className={`pmss-list-summary-item pmss-list-summary-tone-${item.tone ?? i}`}>
          <p className="pmss-list-summary-label">{item.label}</p>
          <p className="pmss-list-summary-value">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

const STATUS_TONE = {
  Present: 'present',
  'Half Present': 'half',
  'Quarter Present': 'quarter',
  Absent: 'absent',
}

export function ListViewStatusPicker({ statuses, value, onChange }) {
  return (
    <div className="pmss-list-status-picker" role="group" aria-label="Attendance status">
      {statuses.map((st) => {
        const active = value === st
        const tone = STATUS_TONE[st] ?? 'neutral'
        return (
          <button
            key={st}
            type="button"
            onClick={() => onChange(st)}
            className={`pmss-list-status-option pmss-list-status-${tone}${active ? ' is-active' : ''}`}
          >
            {st}
          </button>
        )
      })}
    </div>
  )
}
