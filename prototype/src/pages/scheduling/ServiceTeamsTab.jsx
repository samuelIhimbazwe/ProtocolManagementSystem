import { useMemo, useState } from 'react'
import DisplayFormatToggle from '../../components/DisplayFormatToggle'
import ServiceTeamsBulletin from '../../components/bulletin/ServiceTeamsBulletin'
import ServiceTeamsList from '../../components/list/ServiceTeamsList'
import { useDisplayFormat } from '../../hooks/useDisplayFormat'
import { RefreshCw } from 'lucide-react'
import { ServiceCard, Badge } from '../../layouts/AppShell'
import Modal from '../../components/Modal'
import TeamCardActions, { normalizeTeam } from '../../components/TeamCardActions'
import TeamMemberItems from '../../components/TeamMemberItems'
import { MEMBERS, SERVICES, TEAM_ASSIGNMENTS } from '../../data/mock'
import {
  FULL_ROSTER_TEAM_SIZE,
  buildMonthlyServiceTeams,
  isFullRosterKind,
  maxTeamSizeForRow,
  minTeamSizeForRow,
} from '../../data/teamEngine'

function teamKey(t) {
  return t.serviceId ?? t.date
}

function initTeams() {
  return TEAM_ASSIGNMENTS.map((t) => ({ ...normalizeTeam(t), _key: teamKey(t) }))
}

export default function ServiceTeamsTab({
  canEdit,
  showToast,
  controlledTeams,
  onTeamsChange,
  services: servicesProp,
  protocolPool: protocolPoolProp,
  monthLabel = 'August 2026',
}) {
  const [format, setFormat] = useDisplayFormat('pmss-view-teams', 'cards')
  const protocolPool = useMemo(
    () =>
      protocolPoolProp ??
      MEMBERS.filter((m) => m.role === 'Member' && m.status === 'Active').map((m) => m.name),
    [protocolPoolProp],
  )

  const services = servicesProp ?? SERVICES

  const [internalTeams, setInternalTeams] = useState(initTeams)
  const teams = controlledTeams ?? internalTeams
  const setTeams = onTeamsChange ?? setInternalTeams
  const [modal, setModal] = useState(null)
  const [pickMember, setPickMember] = useState('')
  const [replaceFrom, setReplaceFrom] = useState('')
  const [replaceTo, setReplaceTo] = useState('')

  const active = modal != null ? teams[modal.index] : null

  const runEngine = (shuffle) => {
    try {
      const built = buildMonthlyServiceTeams(protocolPool, services, { shuffle })
      const fullRoster = built.filter((t) => isFullRosterKind(t.kind)).length
      setTeams(built.map((t) => ({ ...normalizeTeam(t), _key: teamKey(t) })))
      showToast(
        shuffle
          ? `Teams rebuilt — ${fullRoster} full-roster services @ ${FULL_ROSTER_TEAM_SIZE} members`
          : `Teams built — Sundays + Igaburo (${FULL_ROSTER_TEAM_SIZE} each, incl. TL & VTL)`,
      )
    } catch {
      showToast('Not enough protocol members to build teams')
    }
  }

  const updateTeam = (index, updater) => {
    setTeams((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row
        const next = typeof updater === 'function' ? updater(row) : { ...row, ...updater }
        return { ...normalizeTeam(next), _key: row._key }
      }),
    )
  }

  const availableForTeam = (team) => protocolPool.filter((name) => !team.members.includes(name))

  const openReplaceModal = (index, memberName) => {
    const team = teams[index]
    const avail = availableForTeam(team)
    const from = memberName ?? team.members[0] ?? ''
    setModal({ index, type: 'replace' })
    setReplaceFrom(from)
    setReplaceTo(avail[0] ?? protocolPool.find((n) => n !== from) ?? '')
  }

  const openModal = (index, type) => {
    const team = teams[index]
    setModal({ index, type })
    const avail = availableForTeam(team)
    if (type === 'add') setPickMember(avail[0] ?? '')
    if (type === 'remove') setPickMember(team.members[0] ?? '')
    if (type === 'replace') openReplaceModal(index)
  }

  const removeMember = (index, memberName) => {
    const team = teams[index]
    if (!memberName) return
    const min = minTeamSizeForRow(team)
    if (team.members.length <= min) {
      showToast(
        isFullRosterKind(team.kind)
          ? `This service requires ${FULL_ROSTER_TEAM_SIZE} members`
          : `Minimum team size is ${min}`,
      )
      return
    }
    updateTeam(index, (t) => ({
      ...t,
      members: t.members.filter((m) => m !== memberName),
      teamLeader: t.teamLeader === memberName ? null : t.teamLeader,
      viceTeamLeader: t.viceTeamLeader === memberName ? null : t.viceTeamLeader,
    }))
    showToast(`${memberName} removed from team`)
  }

  const closeModal = () => setModal(null)

  const handleAction = (index, actionId) => openModal(index, actionId)

  const saveAdd = () => {
    const team = teams[modal.index]
    if (!pickMember) {
      showToast('No member selected')
      return
    }
    const max = maxTeamSizeForRow(team)
    if (team.members.length >= max) {
      showToast(
        isFullRosterKind(team.kind)
          ? `Full roster services are fixed at ${FULL_ROSTER_TEAM_SIZE} members`
          : `Maximum team size is ${max}`,
      )
      return
    }
    if (team.members.includes(pickMember)) {
      showToast('Member already on this team')
      return
    }
    updateTeam(modal.index, (t) => ({ ...t, members: [...t.members, pickMember] }))
    showToast(`${pickMember} added to team`)
    closeModal()
  }

  const saveRemove = () => {
    removeMember(modal.index, pickMember)
    closeModal()
  }

  const saveReplace = () => {
    const team = teams[modal.index]
    if (!replaceFrom || !replaceTo) return
    if (replaceFrom === replaceTo) {
      showToast('Pick a different replacement member')
      return
    }
    if (!team.members.includes(replaceFrom)) {
      showToast('Member not on this team')
      return
    }
    if (team.members.includes(replaceTo)) {
      showToast('Replacement is already on the team')
      return
    }
    updateTeam(modal.index, (t) => ({
      ...t,
      members: t.members.map((m) => (m === replaceFrom ? replaceTo : m)),
      teamLeader: t.teamLeader === replaceFrom ? replaceTo : t.teamLeader,
      viceTeamLeader: t.viceTeamLeader === replaceFrom ? replaceTo : t.viceTeamLeader,
    }))
    showToast(`Replaced ${replaceFrom} with ${replaceTo}`)
    closeModal()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pmss-no-print">
        <DisplayFormatToggle format={format} onChange={setFormat} bulletinId="teams-bulletin" />
      </div>
      <p className="text-sm text-neutral-600 bg-primary-50 border border-primary-100 rounded-card px-4 py-3 pmss-no-print">
        <strong className="text-neutral-900">{protocolPool.length} protocol members</strong> in roster. Build engine
        fills <strong>all Sunday services and Igaburo</strong> with <strong>{FULL_ROSTER_TEAM_SIZE} members</strong>{' '}
        each (team leader + vice included), then other weekday services.
      </p>
      <div className="flex flex-wrap gap-2 pmss-no-print">
        {canEdit && (
          <>
            <button type="button" className="pmss-btn-primary" onClick={() => runEngine(false)}>
              Build service teams
            </button>
            <button type="button" className="pmss-btn-secondary" onClick={() => runEngine(true)}>
              <RefreshCw className="w-4 h-4" /> Rebuild teams
            </button>
          </>
        )}
      </div>

      {format === 'bulletin' ? (
        <ServiceTeamsBulletin
          id="teams-bulletin"
          teams={teams}
          monthLabel={monthLabel}
          canEdit={canEdit}
          onTeamsChange={setTeams}
        />
      ) : format === 'list' ? (
        <ServiceTeamsList
          teams={teams}
          canEdit={canEdit}
          onAction={handleAction}
          onRemoveMember={removeMember}
          onReplaceMember={openReplaceModal}
        />
      ) : (
      <div className="grid md:grid-cols-2 gap-4">
        {teams.map((t, i) => (
          <ServiceCard
            key={t._key}
            title={t.date}
            date={
              isFullRosterKind(t.kind)
                ? `${t.kind === 'igaburo' ? 'Igaburo' : 'Sunday'} · ${t.size}/${FULL_ROSTER_TEAM_SIZE} members`
                : `Weekday · Team size: ${t.size}`
            }
            actions={
              canEdit ? (
                <TeamCardActions onAction={(actionId) => handleAction(i, actionId)} />
              ) : null
            }
          >
            <div className="flex flex-wrap gap-2 mb-1">
              {t.kind === 'sunday' && <Badge variant="primary">Sunday priority</Badge>}
              {t.kind === 'igaburo' && <Badge variant="primary">Igaburo</Badge>}
              {isFullRosterKind(t.kind) && t.size === FULL_ROSTER_TEAM_SIZE && (
                <Badge variant="success">Full roster</Badge>
              )}
            </div>
            {t.teamLeader && (
              <p className="text-xs text-neutral-500">
                TL: <span className="font-medium text-neutral-800">{t.teamLeader}</span>
                {t.viceTeamLeader && (
                  <>
                    {' '}
                    · VTL: <span className="font-medium text-neutral-800">{t.viceTeamLeader}</span>
                  </>
                )}
              </p>
            )}
            <TeamMemberItems
              members={t.members}
              teamLeader={t.teamLeader}
              viceTeamLeader={t.viceTeamLeader}
              canEdit={canEdit}
              onRemove={(name) => removeMember(i, name)}
              onReplace={(name) => openReplaceModal(i, name)}
            />
          </ServiceCard>
        ))}
      </div>
      )}

      <Modal
        open={modal?.type === 'add'}
        onClose={closeModal}
        title="Add member"
        description={active?.date}
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveAdd} disabled={!pickMember}>
              Add to team
            </button>
          </>
        }
      >
        {active && isFullRosterKind(active) && active.members.length >= FULL_ROSTER_TEAM_SIZE ? (
          <p className="text-sm text-neutral-600">
            Roster is full ({FULL_ROSTER_TEAM_SIZE} members). Use Replace instead.
          </p>
        ) : active && availableForTeam(active).length === 0 ? (
          <p className="text-sm text-neutral-600">All active protocol members are already on this team.</p>
        ) : (
          <>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Member</label>
            <select className="pmss-input" value={pickMember} onChange={(e) => setPickMember(e.target.value)}>
              {active &&
                availableForTeam(active).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </select>
          </>
        )}
      </Modal>

      <Modal
        open={modal?.type === 'remove'}
        onClose={closeModal}
        title="Remove member"
        description={active?.date}
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-chip pmss-btn-chip-danger h-10 px-5" onClick={saveRemove}>
              Remove from team
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Member to remove</label>
        <select className="pmss-input" value={pickMember} onChange={(e) => setPickMember(e.target.value)}>
          {active?.members.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-400 mt-2">
          {active && isFullRosterKind(active)
            ? `This service must keep ${FULL_ROSTER_TEAM_SIZE} members.`
            : `Minimum ${minTeamSizeForRow(active ?? { kind: 'weekday' })} members.`}
        </p>
      </Modal>

      <Modal
        open={modal?.type === 'replace'}
        onClose={closeModal}
        title="Replace member"
        description={active?.date}
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveReplace}>
              Replace
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">On team</label>
            <select className="pmss-input" value={replaceFrom} onChange={(e) => setReplaceFrom(e.target.value)}>
              {active?.members.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Replace with</label>
            <select className="pmss-input" value={replaceTo} onChange={(e) => setReplaceTo(e.target.value)}>
              {active &&
                availableForTeam(active).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </select>
          </div>
          <p className="text-xs text-neutral-400">Team leader / vice labels update if you replace them.</p>
        </div>
      </Modal>
    </div>
  )
}
