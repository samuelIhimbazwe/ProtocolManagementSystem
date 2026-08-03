import { createContext, useContext, useMemo, useState } from 'react'
import { getPermissions, ROLE_STORAGE_KEY } from '../data/roles'
import { MEMBERS, TEAM_ASSIGNMENTS } from '../data/mock'
import { USE_API } from '../api/config'
import { useAuth } from './AuthContext'
import { useSchedule } from './ScheduleContext'
import { useMembers } from './MembersContext'
import {
  DEMO_TODAY,
  MEMBER_STORAGE_KEY,
  mergePermissionsWithDuty,
  resolveOfficeAccess,
} from '../data/officeAccess'

const RoleContext = createContext(null)

function readStoredRole() {
  try {
    const v = localStorage.getItem(ROLE_STORAGE_KEY)
    if (v && getPermissions(v)) return v
  } catch {
    /* ignore */
  }
  return 'coordinator'
}

function defaultMemberIdForDemo() {
  const protocol = MEMBERS.filter((m) => m.role === 'Member')
  const withDuty = protocol.find((m) => {
    const access = resolveOfficeAccess({
      roleId: 'member',
      memberName: m.name,
      teamAssignments: TEAM_ASSIGNMENTS,
      today: DEMO_TODAY,
    })
    return access.activeDuties.length > 0
  })
  return withDuty?.id ?? protocol[0]?.id ?? '6'
}

function readStoredMemberId() {
  try {
    const v = localStorage.getItem(MEMBER_STORAGE_KEY)
    if (v && (USE_API ? members.some((m) => m.id === v) : MEMBERS.some((m) => m.id === v))) return v
  } catch {
    /* ignore */
  }
  return defaultMemberIdForDemo()
}

export function RoleProvider({ children }) {
  const { user: authUser, pilotToday, officeAccess: apiOfficeAccess } = useAuth()
  const { teamAssignments: scheduleTeams } = useSchedule()
  const { members, getMemberById } = useMembers()
  const [roleId, setRoleIdState] = useState(readStoredRole)
  const [memberId, setMemberIdState] = useState(readStoredMemberId)

  const effectiveRoleId = USE_API && authUser ? authUser.appRole : roleId
  const effectiveMemberId =
    USE_API && authUser?.memberId ? String(authUser.memberId) : memberId

  const demoToday = USE_API && pilotToday ? pilotToday : DEMO_TODAY
  const teamAssignments = USE_API ? scheduleTeams : TEAM_ASSIGNMENTS

  const setRoleId = (id) => {
    if (USE_API && authUser) return
    setRoleIdState(id)
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
  }

  const setMemberId = (id) => {
    if (USE_API && authUser) return
    setMemberIdState(id)
    try {
      localStorage.setItem(MEMBER_STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
  }

  const value = useMemo(() => {
    const member = USE_API
      ? getMemberById(effectiveMemberId)
      : MEMBERS.find((m) => m.id === effectiveMemberId) ?? null
    const memberName = effectiveRoleId === 'member' ? member?.name ?? authUser?.displayName ?? null : null

    const officeAccess =
      USE_API && apiOfficeAccess
        ? {
            ...apiOfficeAccess,
            today: demoToday,
            kind: apiOfficeAccess.kind === 'duty' ? 'team_duty' : apiOfficeAccess.kind,
          }
        : resolveOfficeAccess({
            roleId: effectiveRoleId,
            memberName,
            teamAssignments,
            today: demoToday,
          })

    const basePermissions = getPermissions(effectiveRoleId)
    const permissions =
      effectiveRoleId === 'member'
        ? mergePermissionsWithDuty(basePermissions, officeAccess)
        : basePermissions

    return {
      roleId: effectiveRoleId,
      setRoleId,
      memberId: effectiveMemberId,
      setMemberId,
      member,
      authUser: USE_API ? authUser : null,
      demoToday,
      officeAccess,
      teamAssignments,
      permissions,
      demoMode: !USE_API,
    }
  }, [
    effectiveRoleId,
    effectiveMemberId,
    authUser,
    demoToday,
    apiOfficeAccess,
    teamAssignments,
    members,
  ])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}
