import { parseChoirList } from '../components/ChoirCardActions'

export {
  downloadReportsCsv,
  downloadReportsExcel,
  downloadReportsPdf,
} from './ministryReportExport'

/** Demo / offline report built from schedule payload + mock attendance. */
export function buildDemoReport({ payload, members = [], attendanceMonthly, leadership, publishInfo, recentAttendance }) {
  const services = payload?.services ?? []
  const teams = payload?.teamAssignments ?? []
  const choirs = payload?.choirAssignments ?? []
  const validationRows = payload?.validationRows ?? []

  const choirUsage = new Map()
  const choirAssignments = choirs.map((row) => {
    const list = parseChoirList(row.choirs)
    for (const name of list) choirUsage.set(name, (choirUsage.get(name) ?? 0) + 1)
    return {
      service: row.service,
      date: row.date,
      status: row.status ?? 'Assigned',
      choirCount: list.length,
      choirs: list.join('; '),
    }
  })

  const teamFill = teams.map((t) => ({
    service: t.serviceName ?? t.date,
    date: t.date,
    kind: t.kind ?? '—',
    size: t.size ?? t.members?.length ?? 0,
    target: t.kind === 'sunday' || t.kind === 'igaburo' ? 10 : 6,
    teamLeader: t.teamLeader ?? '—',
    viceTeamLeader: t.viceTeamLeader ?? '—',
    status: t.status ?? 'Assigned',
  }))

  const byChoir = new Map()
  for (const m of members.filter((x) => x.role === 'Member' && x.status === 'Active')) {
    const key = m.choir?.trim() || 'Unassigned'
    byChoir.set(key, (byChoir.get(key) ?? 0) + 1)
  }

  const dutyLoad = new Map()
  for (const t of teams) {
    for (const raw of t.members ?? []) {
      const name = typeof raw === 'string' ? raw : raw?.name
      if (!name) continue
      const cur = dutyLoad.get(name) ?? { member: name, assignments: 0, asLeader: 0 }
      cur.assignments += 1
      dutyLoad.set(name, cur)
    }
    if (t.teamLeader) {
      const cur = dutyLoad.get(t.teamLeader) ?? { member: t.teamLeader, assignments: 0, asLeader: 0 }
      cur.asLeader += 1
      dutyLoad.set(t.teamLeader, cur)
    }
    if (t.viceTeamLeader) {
      const cur = dutyLoad.get(t.viceTeamLeader) ?? {
        member: t.viceTeamLeader,
        assignments: 0,
        asLeader: 0,
      }
      cur.asLeader += 1
      dutyLoad.set(t.viceTeamLeader, cur)
    }
  }

  const byKind = { sunday: 0, weekday: 0, igaburo: 0, other: 0 }
  for (const t of teams) {
    const k = t.kind && byKind[t.kind] != null ? t.kind : 'other'
    byKind[k] += 1
  }

  const att = attendanceMonthly ?? { present: 0, halfPresent: 0, quarterPresent: 0, absent: 0, rate: '—' }
  const totalMarks = (att.present ?? 0) + (att.halfPresent ?? 0) + (att.quarterPresent ?? 0) + (att.absent ?? 0)

  return {
    generatedAt: new Date().toISOString(),
    filters: { service: 'All services', start: null, end: null },
    serviceOptions: ['All services', ...new Set(services.map((s) => s.name))],
    overview: {
      attendanceRate: att.rate,
      attendanceMarks: totalMarks,
      sessionsSubmitted: recentAttendance?.length ?? 0,
      activeMembers: members.filter((m) => m.status === 'Active').length,
      protocolMembers: members.filter((m) => m.role === 'Member' && m.status === 'Active').length,
      servicesScheduled: services.length,
      teamsBuilt: teams.length,
      fullRosterTeams: teamFill.filter((t) => t.size >= t.target).length,
      underfilledTeams: teamFill.filter((t) => t.size < t.target).length,
      uniqueChoirs: choirUsage.size,
      leadershipAssignments: (leadership ?? []).length,
      validationWarnings: validationRows.filter((r) => r.severity === 'Warning').length,
      validationErrors: validationRows.filter((r) => r.severity === 'Error').length,
      publishedVersion: publishInfo?.version ?? '—',
      monthLabel: payload?.monthLabel ?? 'August 2026',
    },
    attendance: {
      monthly: { ...att, total: totalMarks },
      sessions: (recentAttendance ?? []).map((r) => ({
        id: r.id,
        service: r.service,
        date: r.date,
        status: r.status,
        recorded: '—',
        present: '—',
        absent: '—',
        rate: r.rate,
      })),
      members: members
        .filter((m) => m.role === 'Member' && m.attendanceRate != null)
        .slice(0, 20)
        .map((m) => ({
          id: m.id,
          name: m.name,
          choir: m.choir,
          marks: '—',
          present: '—',
          absent: '—',
          halfPresent: '—',
          quarterPresent: '—',
          rate: `${m.attendanceRate}%`,
        })),
    },
    members: {
      total: members.length,
      active: members.filter((m) => m.status === 'Active').length,
      protocol: members.filter((m) => m.role === 'Member' && m.status === 'Active').length,
      leadership: members.filter((m) => m.role !== 'Member' && m.status === 'Active').length,
      withChoir: members.filter((m) => m.choir).length,
      byChoir: [...byChoir.entries()].map(([choir, count]) => ({ choir, count })),
    },
    users: { total: '—', active: '—', invited: '—', deactivated: '—' },
    schedule: {
      serviceCount: services.length,
      services,
      teamCount: teams.length,
      teamsByKind: byKind,
      teamFill,
      fullRosterTeams: teamFill.filter((t) => t.size >= t.target).length,
      underfilledTeams: teamFill.filter((t) => t.size < t.target).length,
      choirAssignments,
      choirFrequency: [...choirUsage.entries()]
        .map(([choir, count]) => ({ choir, count }))
        .sort((a, b) => b.count - a.count),
      uniqueChoirs: choirUsage.size,
      leadershipTally: leadership ?? [],
      leadershipDetail: (payload?.leadershipReview ?? []).map((r) => ({
        date: r.date,
        teamLeader: r.tl,
        viceLeader: r.vtl,
        status: r.status,
      })),
      memberDutyLoad: [...dutyLoad.values()].sort(
        (a, b) => b.assignments + b.asLeader - (a.assignments + a.asLeader),
      ),
      validation: {
        rows: validationRows,
        passed: validationRows.filter((r) => r.severity === 'Passed').length,
        warnings: validationRows.filter((r) => r.severity === 'Warning').length,
        errors: validationRows.filter((r) => r.severity === 'Error').length,
      },
      published: {
        version: publishInfo?.version ?? '—',
        status: publishInfo?.status ?? '—',
        publishedBy: publishInfo?.publishedBy ?? null,
        publishedAt: publishInfo?.publishedDate ?? null,
      },
      history: [],
      monthLabel: payload?.monthLabel ?? 'August 2026',
    },
    activity: [],
  }
}
