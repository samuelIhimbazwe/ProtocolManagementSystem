import { useState } from 'react'

function cardMemberClass(m, teamLeader, viceTeamLeader) {
  if (m === teamLeader) return 'bg-primary-50 text-primary-800 ring-1 ring-primary-200'
  if (m === viceTeamLeader) return 'bg-violet-50 text-violet-800 ring-1 ring-violet-200'
  return 'bg-neutral-100 text-neutral-800'
}

function memberLabel(m, teamLeader, viceTeamLeader) {
  let text = m
  if (m === teamLeader) text += ' · TL'
  if (m === viceTeamLeader && m !== teamLeader) text += ' · VTL'
  return text
}

/**
 * Original card roster chips (+ list tags). Click a name when editing → Replace / Remove.
 */
export default function TeamMemberItems({
  members,
  teamLeader,
  viceTeamLeader,
  canEdit = false,
  onRemove,
  onReplace,
  listMax = 0,
}) {
  const [active, setActive] = useState(null)

  if (!members?.length) {
    return null
  }

  const pick = (name) => setActive((prev) => (prev === name ? null : name))

  const actionRow =
    canEdit && active ? (
      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
        <button type="button" className="font-semibold text-link hover:text-link-hover" onClick={() => { onReplace?.(active); setActive(null) }}>
          Replace
        </button>
        <span className="text-neutral-300">|</span>
        <button type="button" className="font-semibold text-red-600 hover:text-red-700" onClick={() => { onRemove?.(active); setActive(null) }}>
          Remove
        </button>
      </div>
    ) : null

  if (listMax > 0) {
    const visible = members.length > listMax ? members.slice(0, listMax) : members
    const rest = members.length - visible.length
    return (
      <div>
        <div className="pmss-list-tags">
          {visible.map((label) =>
            canEdit ? (
              <button
                key={label}
                type="button"
                className={`pmss-list-tag border-0 font-normal${active === label ? ' ring-2 ring-primary-400 ring-offset-1' : ''}`}
                onClick={() => pick(label)}
              >
                {label}
              </button>
            ) : (
              <span key={label} className="pmss-list-tag">
                {label}
              </span>
            ),
          )}
          {rest > 0 && <span className="pmss-list-tag pmss-list-tag-more">+{rest} more</span>}
        </div>
        {actionRow}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {members.map((m) => {
          const cls = `text-xs px-2 py-1 rounded-lg ${cardMemberClass(m, teamLeader, viceTeamLeader)}`
          const label = memberLabel(m, teamLeader, viceTeamLeader)
          if (canEdit) {
            return (
              <button
                key={m}
                type="button"
                className={`${cls} border-0 font-normal leading-snug${active === m ? ' ring-2 ring-primary-400 ring-offset-1' : ''}`}
                onClick={() => pick(m)}
              >
                {label}
              </button>
            )
          }
          return (
            <span key={m} className={cls}>
              {label}
            </span>
          )
        })}
      </div>
      {actionRow}
    </div>
  )
}
