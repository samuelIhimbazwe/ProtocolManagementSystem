import { useEffect, useMemo, useState } from 'react'
import BulletinChurchHeader from './BulletinChurchHeader'
import BulletinEditable from './BulletinEditable'
import {
  groupTeamsByProtocolWeek,
  protocolServiceTitle,
  teamBulletinDate,
} from '../../lib/bulletinWeeks'
import { FULL_ROSTER_TEAM_SIZE, isFullRosterKind, maxTeamSizeForRow } from '../../data/teamEngine'

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

const RW_WEEK = [
  '',
  'ICYUMWERU CYA MBERE',
  'ICYUMWERU CYA KABIRI',
  'ICYUMWERU CYA GATATU',
  'ICYUMWERU CYA KANE',
  'ICYUMWERU CYA GATANU',
]

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
  if (index === 0) return ' (Team Lead)'
  if (index === 1) return ' (V/s Team Lead)'
  return ''
}

function isIgaburoTeam(team) {
  return /Igaburo/i.test(team.serviceName ?? team.date ?? '')
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
  const ordered = orderedBulletinMembers(team)
  const slotCount = isFullRosterKind(team.kind) ? FULL_ROSTER_TEAM_SIZE : Math.max(ordered.length, 1)
  const slots = Array.from({ length: slotCount }, (_, i) => ordered[i] ?? '')

  return (
    <div className="pmss-bulletin-service-block">
      <div
        className={`pmss-bulletin-service-bar${isIgaburoTeam(team) ? ' pmss-bulletin-service-bar--igaburo' : ''}`}
      >
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
              <span className="pmss-bulletin-member-index">{i + 1}.</span>
              <span className="pmss-bulletin-member-line">
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
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * ADEPR-style protocol bulletin — weekly columns (Tue → Igaburo → Sun 1 → Sun 2).
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
  const [titleOverrides, setTitleOverrides] = useState({})
  const [memberOverrides, setMemberOverrides] = useState({})
  const [roleOverrides, setRoleOverrides] = useState({})

  useEffect(() => {
    setTitle(defaultTitle)
  }, [defaultTitle])

  const protocolWeeks = useMemo(() => groupTeamsByProtocolWeek(teams), [teams])
  const weekCount = Math.max(protocolWeeks.length, 1)

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
    <article
      id={id}
      className="pmss-bulletin pmss-bulletin--protocol"
      style={{ '--pmss-protocol-week-cols': weekCount }}
    >
      {canEdit && (
        <p className="pmss-bulletin-edit-hint pmss-no-print">
          Click any text to edit — church name, title, service lines, names, and footer.
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
        {protocolWeeks.length === 0 ? (
          <p className="pmss-bulletin-week-empty px-3 py-2">No services</p>
        ) : (
          <div className="pmss-bulletin-week-row pmss-bulletin-week-row--protocol">
            {protocolWeeks.map(({ weekNum, items }) => (
              <div key={weekNum} className="pmss-bulletin-week-col">
                <div className="pmss-bulletin-week-heading">
                  {RW_WEEK[weekNum] ?? `ICYUMWERU ${weekNum}`} ({weekNum})
                </div>
                {items.length === 0 ? (
                  <p className="pmss-bulletin-week-empty">—</p>
                ) : (
                  items.map((team) => {
                    const key = team._key ?? team.date
                    return (
                      <ServiceBlock
                        key={key}
                        team={team}
                        titleOverride={titleOverrides[key]}
                        memberOverrides={memberOverrides[key]}
                        roleOverrides={roleOverrides[key]}
                        canEdit={canEdit}
                        onTitleChange={(v) => setTitleOverrides((t) => ({ ...t, [key]: v }))}
                        onMemberChange={(slot, v) => patchTeamMembers(key, team, slot, v)}
                        onRoleChange={(slot, v) =>
                          setRoleOverrides((prev) => ({
                            ...prev,
                            [key]: { ...(prev[key] ?? {}), [slot]: v },
                          }))
                        }
                      />
                    )
                  })
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
