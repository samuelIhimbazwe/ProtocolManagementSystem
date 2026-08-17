import { useEffect, useMemo, useState } from 'react'
import BulletinChurchHeader from './BulletinChurchHeader'
import BulletinEditable from './BulletinEditable'
import {
  protocolServiceTitle,
  teamBulletinDate,
} from '../../lib/bulletinWeeks'
import { maxTeamSizeForRow } from '../../data/teamEngine'

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

function serviceSortKey(team) {
  const name = team.serviceName ?? team.date ?? ''
  if (/Tuesday/i.test(name)) return 1
  if (/Friday/i.test(name)) return 2
  if (/Sunday Service 1/i.test(name)) return 3
  if (/Sunday Service 2/i.test(name)) return 4
  if (/Igaburo/i.test(name)) return 5
  return 9
}

function sortTeamsForBulletin(teams) {
  return [...(teams ?? [])].sort((a, b) => {
    const pa = teamBulletinDate(a)
    const pb = teamBulletinDate(b)
    const ta = pa ? Date.UTC(pa.year, pa.month, pa.day) : 0
    const tb = pb ? Date.UTC(pb.year, pb.month, pb.day) : 0
    if (ta !== tb) return ta - tb
    return serviceSortKey(a) - serviceSortKey(b)
  })
}

function pairItems(items) {
  const rows = []
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i] ?? null, items[i + 1] ?? null])
  }
  return rows
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
  const ordered = orderedBulletinMembers(team)
  const slots = canEdit
    ? Array.from({ length: Math.max(ordered.length, 1) }, (_, i) => ordered[i] ?? '')
    : ordered

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
 * ADEPR-style protocol bulletin: services packed 2-up by date (no empty week columns).
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
  const [footerLines, setFooterLines] = useState([
    `Byateguwe na Minisiteri y' Abadiyakoni · ${monthLabel}`,
    "Byagenzuwe n'Umuyobozi w'Itorero",
    "Byemejwe n'Umushumba w'Itorero",
  ])

  useEffect(() => {
    setTitle(defaultTitle)
  }, [defaultTitle])

  useEffect(() => {
    setFooterLines((prev) => {
      const next = [...prev]
      next[0] = `Byateguwe na Minisiteri y' Abadiyakoni · ${monthLabel}`
      return next
    })
  }, [monthLabel])

  const orderedTeams = useMemo(() => sortTeamsForBulletin(teams), [teams])
  const pairs = useMemo(() => pairItems(orderedTeams), [orderedTeams])

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
        {pairs.length === 0 ? (
          <p className="pmss-bulletin-week-empty px-3 py-2">No services</p>
        ) : (
          pairs.map((pair, idx) => (
            <div key={idx} className="pmss-bulletin-service-row">
              {pair.map((team, col) => {
                if (!team) {
                  return <div key={`empty-${col}`} className="pmss-bulletin-service-cell pmss-bulletin-service-cell--blank" />
                }
                const key = team._key ?? team.date
                return (
                  <div key={key} className="pmss-bulletin-service-cell">
                    <ServiceBlock
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
                  </div>
                )
              })}
            </div>
          ))
        )}
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
