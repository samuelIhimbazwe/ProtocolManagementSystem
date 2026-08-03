/** Duty window logic — mirrors prototype officeAccess.js */
export const DEFAULT_TODAY = '2026-08-02'

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function dutyWindowForService(serviceDate) {
  return {
    starts: addDays(serviceDate, -2),
    ends: addDays(serviceDate, 1),
  }
}

export function isDutyWindowActive(serviceDate, today = DEFAULT_TODAY) {
  const { starts, ends } = dutyWindowForService(serviceDate)
  return today >= starts && today <= ends
}

export function getActiveTeamLeadershipDuties(memberName, teamAssignments, today = DEFAULT_TODAY) {
  if (!memberName || !teamAssignments?.length) return []
  const duties = []
  for (const team of teamAssignments) {
    const isTl = team.teamLeader === memberName
    const isVtl = team.viceTeamLeader === memberName
    if (!isTl && !isVtl) continue
    const serviceDate = team.serviceDate ?? team.service_date
    if (!serviceDate || !isDutyWindowActive(serviceDate, today)) continue
    const { starts, ends } = dutyWindowForService(serviceDate)
    const dateLabel = team.date?.includes(' — ') ? team.date.split(' — ')[0] : team.date ?? serviceDate
    duties.push({
      serviceId: team.serviceId,
      serviceName: team.serviceName,
      serviceDate,
      dateLabel,
      dutyRole: isTl ? 'TL' : 'VTL',
      teamLeader: team.teamLeader,
      viceTeamLeader: team.viceTeamLeader,
      members: team.members ?? [],
      kind: team.kind,
      dutyStarts: starts,
      dutyEnds: ends,
    })
  }
  return duties
}

export function resolveOfficeAccess({ roleId, memberName, teamAssignments, today = DEFAULT_TODAY }) {
  const leadership = ['president', 'vice_president', 'secretary', 'treasurer', 'coordinator']
  if (leadership.includes(roleId)) {
    return { showOffice: true, kind: 'leadership', activeDuties: [], today }
  }
  const activeDuties = getActiveTeamLeadershipDuties(memberName, teamAssignments, today)
  if (activeDuties.length) {
    return { showOffice: true, kind: 'team_duty', activeDuties, today }
  }
  return { showOffice: false, kind: null, activeDuties: [], today }
}
