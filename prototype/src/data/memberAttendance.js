import { MEMBERS, SERVICES, TEAM_ASSIGNMENTS } from './mock'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatServiceDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`)
  const day = d.getUTCDate()
  const mon = MONTH_LABELS[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${String(day).padStart(2, '0')} ${mon} ${year}`
}

function hashSeed(input) {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function statusForMemberService(memberId, serviceId) {
  const bucket = hashSeed(`${memberId}:${serviceId}`) % 100
  if (bucket < 62) return 'Present'
  if (bucket < 78) return 'Half Present'
  if (bucket < 88) return 'Quarter Present'
  return 'Absent'
}

function countStatus(rows, status) {
  return rows.filter((r) => r.status === status).length
}

/** Full per-service attendance rows for a protocol member (demo: August 2026 roster). */
export function getMemberAttendanceHistory(memberId) {
  const member = MEMBERS.find((m) => m.id === memberId)
  if (!member || member.role !== 'Member') return []

  const rows = []
  for (const svc of SERVICES) {
    const team = TEAM_ASSIGNMENTS.find((t) => t.serviceId === svc.id)
    if (!team?.members?.includes(member.name)) continue

    let teamRole = 'Protocol team'
    if (team.teamLeader === member.name) teamRole = 'Team Leader'
    else if (team.viceTeamLeader === member.name) teamRole = 'Vice Team Leader'

    rows.push({
      id: `${memberId}-${svc.id}`,
      service: svc.name,
      serviceDate: svc.date,
      date: formatServiceDate(svc.date),
      day: svc.day,
      status: statusForMemberService(memberId, svc.id),
      teamRole,
    })
  }

  return rows.sort((a, b) => b.serviceDate.localeCompare(a.serviceDate) || a.service.localeCompare(b.service))
}

export function summarizeMemberAttendance(history) {
  const total = history.length
  if (total === 0) {
    return {
      present: 0,
      halfPresent: 0,
      quarterPresent: 0,
      absent: 0,
      total: 0,
      rate: '—',
    }
  }

  const present = countStatus(history, 'Present')
  const halfPresent = countStatus(history, 'Half Present')
  const quarterPresent = countStatus(history, 'Quarter Present')
  const absent = countStatus(history, 'Absent')
  const weighted = present + halfPresent * 0.5 + quarterPresent * 0.25
  const rate = `${Math.round((weighted / total) * 100)}%`

  return { present, halfPresent, quarterPresent, absent, total, rate }
}

/** Record attendance: leadership roles with flag, or member only during TL/VTL duty. */
export function canRecordAttendance(roleId, permissions) {
  if (!permissions?.recordAttendance) return false
  if (roleId === 'member') return Boolean(permissions.teamDutyActive)
  return true
}

export function attendanceStatusBadgeVariant(status) {
  if (status === 'Present') return 'success'
  if (status === 'Absent') return 'error'
  if (status === 'Half Present') return 'warning'
  return 'primary'
}
