import { LEADERSHIP_ROLE_IDS } from './roles'

/** Prototype “today” — change to demo past/future duty windows. */
export const DEMO_TODAY = '2026-08-02'

/** Office unlocks this many days before the service through this many days after. */
export const OFFICE_DUTY_DAYS_BEFORE = 2
export const OFFICE_DUTY_DAYS_AFTER = 1

export const MEMBER_STORAGE_KEY = 'pmss-demo-member-id'

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isLeadershipRole(roleId) {
  return LEADERSHIP_ROLE_IDS.includes(roleId)
}

export function dutyWindowForService(serviceDate) {
  return {
    starts: addDays(serviceDate, -OFFICE_DUTY_DAYS_BEFORE),
    ends: addDays(serviceDate, OFFICE_DUTY_DAYS_AFTER),
  }
}

export function isDutyWindowActive(serviceDate, today = DEMO_TODAY) {
  const { starts, ends } = dutyWindowForService(serviceDate)
  return today >= starts && today <= ends
}

/**
 * TL/VTL assignments where the temporary Office tab should be visible.
 */
export function getActiveTeamLeadershipDuties(memberName, teamAssignments, today = DEMO_TODAY) {
  if (!memberName) return []
  return teamAssignments
    .filter(
      (t) =>
        (t.teamLeader === memberName || t.viceTeamLeader === memberName) &&
        isDutyWindowActive(t.serviceDate, today),
    )
    .map((t) => {
      const { starts, ends } = dutyWindowForService(t.serviceDate)
      return {
        serviceId: t.serviceId,
        serviceName: t.serviceName,
        serviceDate: t.serviceDate,
        dateLabel: t.date,
        dutyRole: t.teamLeader === memberName ? 'TL' : 'VTL',
        teamLeader: t.teamLeader,
        viceTeamLeader: t.viceTeamLeader,
        members: t.members ?? [],
        kind: t.kind,
        dutyStarts: starts,
        dutyEnds: ends,
      }
    })
}

export function getMemberTeamAssignments(memberName, teamAssignments, today = DEMO_TODAY) {
  if (!memberName) return []
  return teamAssignments.filter(
    (t) => (t.members ?? []).includes(memberName) && t.serviceDate >= today,
  )
}

export function resolveOfficeAccess({ roleId, memberName, teamAssignments, today = DEMO_TODAY }) {
  const permanent = isLeadershipRole(roleId)
  const activeDuties = permanent ? [] : getActiveTeamLeadershipDuties(memberName, teamAssignments, today)
  const showOffice = permanent || activeDuties.length > 0

  return {
    showOffice,
    kind: permanent ? 'leadership' : activeDuties.length ? 'team_duty' : null,
    activeDuties,
    today,
  }
}

export function mergePermissionsWithDuty(basePermissions, officeAccess) {
  if (!officeAccess?.activeDuties?.length) return basePermissions
  return {
    ...basePermissions,
    recordAttendance: true,
    teamDutyActive: true,
  }
}
