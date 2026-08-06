import { useEffect, useMemo, useState } from 'react'
import BulletinChurchHeader from './BulletinChurchHeader'
import BulletinEditable from './BulletinEditable'
import {
  groupTeamsByWeek,
  protocolServiceTitle,
  teamBulletinDate,
} from '../../lib/bulletinWeeks'
import { maxTeamSizeForRow } from '../../data/teamEngine'

const RW_WEEK = [
  '',
  'ICYUMWERU CYA MBERE (1)',
  'ICYUMWERU CYA KABIRI (2)',
  'ICYUMWERU CYA GATATU (3)',
  'ICYUMWERU CYA KANE (4)',
  'ICYUMWERU CYA GATANU (5)',
]

const MONTH_NUM = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

function monthNumberFromLabel(monthLabel) {
  const iso = String(monthLabel).match(/(\d{4})-(\d{1,2})/)
  if (iso) return Number(iso[2])
  const named = String(monthLabel)
    .toLowerCase()
    .match(/january|february|march|april|may|june|july|august|september|october|november|december/)
  if (named) return MONTH_NUM[named[0]]
  return 8
}

export { BulletinEditable }

/** TL first, V/s TL second, then remaining members — matches printed ADEPR bulletins. */
export function orderedBulletinMembers(team) {
  const members = [...(team.members ?? [])]
  const tl = team.teamLeader && members.includes(team.teamLeader) ? team.teamLeader : null
  const vtl =
    team.viceTeamLeader &&
    team.viceTeamLeader !== tl &&
    members.includes(team.viceTeamLeader)
      ? team.viceTeamLeader
      : null
  const rest = members.filter((m) => m !== tl && m !== vtl)
  const ordered = []
  if (tl) ordered.push(tl)
  if (vtl) ordered.push(vtl)
  ordered.push(...rest)
  return ordered
}

function roleLabelForSlot(index) {
  if (index === 0) return ' (Team lead)'
  if (index === 1) return ' (V/s Team lead)'
  return ''
}

function ServiceBlock({
  team,
  titleOverride,
  memberOverrides,
  roleOverrides,
  canEdit,
  onTitleChange,
  onMemberChange,
  onRoleChange,
}) {
  const parts = teamBulletinDate(team)
  const defaultTitle = protocolServiceTitle(team, parts)
  const title = titleOverride ?? defaultTitle
  const target = maxTeamSizeForRow(team)
  const ordered = orderedBulletinMembers(team)
  const slots = Array.from({ length: Math.max(target, ordered.length) }, (_, i) => ordered[i] ?? '')

  return (
    <div className="pmss-bulletin-service-block">
      <div className="pmss-bulletin-service-bar">
        <span aria-hidden>➤</span>{' '}
        <BulletinEditable
          value={title}
          onChange={canEdit ? onTitleChange : undefined}
          disabled={!canEdit}
          className="pmss-bulletin-service-title"
        />
      </div>
      <ol className="pmss-bulletin-member-list">
        {slots.map((name, i) => {
          const display = memberOverrides?.[i] ?? name
          const role = roleOverrides?.[i] ?? roleLabelForSlot(i)
          return (
            <li key={`${team._key ?? team.date}-${i}`}>
              <BulletinEditable
                value={display}
                placeholder={role ? 'Name' : '—'}
                onChange={canEdit ? (v) => onMemberChange(i, v) : undefined}
                disabled={!canEdit}
                className="pmss-bulletin-member-name"
              />
              {(role || canEdit) && (
                <strong className="pmss-bulletin-role">
                  <BulletinEditable
                    value={role}
                    placeholder=" "
                    onChange={canEdit ? (v) => onRoleChange(i, v) : undefined}
                    disabled={!canEdit}
                  />
                </strong>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function WeekColumn({
  weekIndex,
  items,
  headingOverride,
  canEdit,
  onHeadingChange,
  titleOverrides,
  memberOverrides,
  roleOverrides,
  onTitleChange,
  onMemberChange,
  onRoleChange,
}) {
  const defaultLabel = RW_WEEK[weekIndex + 1] ?? `ICYUMWERU ${(weekIndex + 1)}`
  const label = headingOverride ?? defaultLabel

  return (
    <div className="pmss-bulletin-week-col">
      <h3 className="pmss-bulletin-week-heading">
        <BulletinEditable
          value={label}
          onChange={canEdit ? onHeadingChange : undefined}
          disabled={!canEdit}
        />
      </h3>
      {items.length === 0 ? (
        <p className="pmss-bulletin-week-empty">No services this week</p>
      ) : (
        items.map(({ team }) => {
          const key = team._key ?? team.date
          return (
            <ServiceBlock
              key={key}
              team={team}
              titleOverride={titleOverrides[key]}
              memberOverrides={memberOverrides[key]}
              roleOverrides={roleOverrides[key]}
              canEdit={canEdit}
              onTitleChange={(v) => onTitleChange(key, v)}
              onMemberChange={(slot, v) => onMemberChange(key, team, slot, v)}
              onRoleChange={(slot, v) => onRoleChange(key, slot, v)}
            />
          )
        })
      )}
    </div>
  )
}

/**
 * ADEPR-style protocol bulletin: consecutive Monday weeks in fixed 2 columns,
 * services strictly by date, fully editable when canEdit.
 */
export default function ServiceTeamsBulletin({
  id,
  teams,
  monthLabel = 'August 2026',
  canEdit = false,
  onTeamsChange,
}) {
  const monthNum = monthNumberFromLabel(monthLabel)
  const defaultTitle = `GAHUNDA YA PROTOCOLE Y'UKWEZI KWA ${monthNum}`

  const [churchLine, setChurchLine] = useState('ADEPR KACYIRU')
  const [title, setTitle] = useState(defaultTitle)
  const [headings, setHeadings] = useState({})
  const [titleOverrides, setTitleOverrides] = useState({})
  const [memberOverrides, setMemberOverrides] = useState({})
  const [roleOverrides, setRoleOverrides] = useState({})
  const [footerLines, setFooterLines] = useState([
    `Byateguwe na Minisiteri ya Protocole · ${monthLabel}`,
    "Byagenzuwe n'Umuyobozi w'Itorero",
    "Byemejwe n'Umushumba w'Itorero",
  ])

  useEffect(() => {
    setTitle(defaultTitle)
  }, [defaultTitle])

  useEffect(() => {
    setFooterLines((prev) => {
      const next = [...prev]
      next[0] = `Byateguwe na Minisiteri ya Protocole · ${monthLabel}`
      return next
    })
  }, [monthLabel])

  /** Include every team (empty slots editable); never skip services by date. */
  const weeks = useMemo(() => groupTeamsByWeek(teams ?? []), [teams])

  const weekEntries = weeks.map(([weekKey, items], weekIndex) => ({
    weekKey,
    items,
    weekIndex,
  }))

  const pairs = []
  for (let i = 0; i < weekEntries.length; i += 2) {
    pairs.push([
      weekEntries[i] ?? null,
      weekEntries[i + 1] ?? null,
    ])
  }
  if (pairs.length === 0) {
    pairs.push([null, null])
  }

  const patchTeamMembers = (teamKey, team, slotIndex, newName) => {
    setMemberOverrides((prev) => {
      const cur = { ...(prev[teamKey] ?? {}) }
      cur[slotIndex] = newName
      return { ...prev, [teamKey]: cur }
    })

    if (!onTeamsChange) return

    const ordered = orderedBulletinMembers(team)
    const target = maxTeamSizeForRow(team)
    const slots = Array.from({ length: Math.max(target, ordered.length, slotIndex + 1) }, (_, i) => {
      if (i === slotIndex) return newName.trim()
      return ordered[i] ?? ''
    })
    const members = slots.map((n) => n.trim()).filter(Boolean)
    const tl = members[0] ?? null
    const vtl = members[1] ?? null

    onTeamsChange((prev) =>
      prev.map((row) => {
        const key = row._key ?? row.date
        if (key !== teamKey) return row
        return {
          ...row,
          members,
          size: members.length,
          teamLeader: tl,
          viceTeamLeader: vtl,
        }
      }),
    )
  }

  return (
    <article id={id} className="pmss-bulletin pmss-bulletin--protocol">
      {canEdit && (
        <p className="pmss-bulletin-edit-hint pmss-no-print">
          Click any text to edit — church name, title, week labels, service lines, names, and footer.
        </p>
      )}
      <BulletinChurchHeader
        churchLine={
          <BulletinEditable
            value={churchLine}
            onChange={canEdit ? setChurchLine : undefined}
            disabled={!canEdit}
          />
        }
        title={
          <BulletinEditable
            value={title}
            onChange={canEdit ? setTitle : undefined}
            disabled={!canEdit}
          />
        }
      />

      <div className="pmss-bulletin-protocol-frame">
        {pairs.map((pair, idx) => (
          <div key={idx} className="pmss-bulletin-week-row">
            {pair.map((entry, col) => {
              if (!entry) {
                return <div key={`empty-${col}`} className="pmss-bulletin-week-col pmss-bulletin-week-col--blank" />
              }
              const { weekKey, items, weekIndex } = entry
              return (
                <WeekColumn
                  key={weekKey}
                  weekIndex={weekIndex}
                  items={items}
                  headingOverride={headings[weekKey]}
                  canEdit={canEdit}
                  onHeadingChange={(v) => setHeadings((h) => ({ ...h, [weekKey]: v }))}
                  titleOverrides={titleOverrides}
                  memberOverrides={memberOverrides}
                  roleOverrides={roleOverrides}
                  onTitleChange={(key, v) => setTitleOverrides((t) => ({ ...t, [key]: v }))}
                  onMemberChange={patchTeamMembers}
                  onRoleChange={(key, slot, v) =>
                    setRoleOverrides((prev) => ({
                      ...prev,
                      [key]: { ...(prev[key] ?? {}), [slot]: v },
                    }))
                  }
                />
              )
            })}
          </div>
        ))}
      </div>

      <footer className="pmss-bulletin-signatures">
        {footerLines.map((line, i) => (
          <p key={i}>
            <BulletinEditable
              value={line}
              onChange={
                canEdit
                  ? (v) =>
                      setFooterLines((lines) => {
                        const next = [...lines]
                        next[i] = v
                        return next
                      })
                  : undefined
              }
              disabled={!canEdit}
            />
          </p>
        ))}
      </footer>
    </article>
  )
}
