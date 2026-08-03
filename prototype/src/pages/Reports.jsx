import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FileText,
  Calendar,
  Crown,
  Layers,
  Users,
  Music,
  ShieldCheck,
  Activity,
  RefreshCw,
} from 'lucide-react'
import { PageHeader, StatCard, DataTable, Badge } from '../layouts/AppShell'
import {
  ATTENDANCE_MONTHLY,
  LEADERSHIP_REPORT,
  PUBLISH_INFO,
  RECENT_ATTENDANCE,
} from '../data/mock'
import { USE_API } from '../api/config'
import { fetchReportsSummary } from '../api/schedule'
import { useSchedule } from '../context/ScheduleContext'
import { useMembers } from '../context/MembersContext'
import {
  buildDemoReport,
  downloadReportsCsv,
  downloadReportsExcel,
  downloadReportsPdf,
} from '../lib/reportsExport'
import ScheduleDownloadMenu from '../components/ScheduleDownloadMenu'

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'attendance', label: 'Attendance', icon: Activity },
  { id: 'scheduling', label: 'Scheduling', icon: Calendar },
  { id: 'choirs', label: 'Choirs', icon: Music },
  { id: 'leadership', label: 'Leadership', icon: Crown },
  { id: 'teams', label: 'Teams', icon: Layers },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'validation', label: 'Validation', icon: ShieldCheck },
  { id: 'activity', label: 'Activity', icon: RefreshCw },
]

function SectionNav({ section, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 mb-6 p-1 rounded-xl bg-neutral-100/80 border border-neutral-200/80 pmss-no-print">
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            section === id
              ? 'bg-white text-primary-800 shadow-sm ring-1 ring-neutral-200/80'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

function EmptyNote({ children }) {
  return <p className="text-sm text-neutral-500 py-4">{children}</p>
}

export default function ReportsPage() {
  const { payload } = useSchedule()
  const { members } = useMembers()
  const [section, setSection] = useState('overview')
  const [service, setService] = useState('All services')
  const [start, setStart] = useState('2026-08-01')
  const [end, setEnd] = useState('2026-08-31')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (USE_API) {
        const data = await fetchReportsSummary({
          service: service === 'All services' ? undefined : service,
          start: start || undefined,
          end: end || undefined,
        })
        setReport(data)
      } else {
        setReport(
          buildDemoReport({
            payload,
            members,
            attendanceMonthly: ATTENDANCE_MONTHLY,
            leadership: LEADERSHIP_REPORT,
            publishInfo: PUBLISH_INFO,
            recentAttendance: RECENT_ATTENDANCE,
          }),
        )
      }
    } catch (err) {
      setError(err.message ?? 'Failed to load report')
      setReport(
        buildDemoReport({
          payload,
          members,
          attendanceMonthly: ATTENDANCE_MONTHLY,
          leadership: LEADERSHIP_REPORT,
          publishInfo: PUBLISH_INFO,
          recentAttendance: RECENT_ATTENDANCE,
        }),
      )
    } finally {
      setLoading(false)
    }
  }, [service, start, end, payload, members])

  useEffect(() => {
    load()
  }, [load])

  const serviceOptions = useMemo(() => {
    const fromApi = report?.serviceOptions
    if (fromApi?.length) return fromApi
    return ['All services', ...new Set((payload?.services ?? []).map((s) => s.name))]
  }, [report, payload])

  const o = report?.overview ?? {}
  const att = report?.attendance?.monthly ?? {}
  const pub = report?.schedule?.published ?? {}

  const exportReport = (format) => {
    if (!report) {
      showToast('Report not loaded yet')
      return
    }
    try {
      const stamp = (report.overview?.monthLabel ?? 'report').replace(/\s+/g, '-').toLowerCase()
      if (format === 'csv') {
        downloadReportsCsv(report, `pmss-ministry-report-${stamp}.csv`)
        showToast('Report downloaded (CSV)')
      } else if (format === 'excel') {
        downloadReportsExcel(report, `pmss-ministry-report-${stamp}.xls`)
        showToast('Report downloaded (Excel)')
      } else if (format === 'pdf') {
        downloadReportsPdf(report)
        showToast('Use Print → Save as PDF')
      }
    } catch (err) {
      showToast(err.message ?? 'Export failed')
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Reports"
        description={
          o.monthLabel
            ? `${o.monthLabel} · attendance, schedule, choir, leadership, and roster`
            : 'Attendance, schedule, choir, leadership, and roster analytics'
        }
        actions={
          <button type="button" className="pmss-btn-secondary text-sm h-9" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="pmss-card p-4 mb-6 flex flex-col lg:flex-row flex-wrap gap-3 pmss-no-print">
        <select
          className="pmss-input w-full lg:w-44"
          value={o.monthLabel ?? 'August 2026'}
          onChange={() => {}}
          aria-label="Report month"
        >
          <option>{o.monthLabel ?? 'August 2026'}</option>
        </select>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="pmss-input w-full lg:w-40"
          aria-label="Start date"
        />
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="pmss-input w-full lg:w-40"
          aria-label="End date"
        />
        <select
          className="pmss-input flex-1 min-w-[160px]"
          value={service}
          onChange={(e) => setService(e.target.value)}
          aria-label="Service filter"
        >
          {serviceOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div className="flex gap-2 lg:ml-auto">
          <ScheduleDownloadMenu label="Export report" onExport={exportReport} disabled={!report} />
        </div>
      </div>

      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-card px-4 py-2 mb-4">
          {error} — showing best available data.
        </p>
      )}

      <SectionNav section={section} onChange={setSection} />

      {loading && !report ? (
        <p className="text-sm text-neutral-500">Loading comprehensive report…</p>
      ) : (
        <>
          {section === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Attendance rate" value={String(o.attendanceRate ?? '—')} sub={`${o.attendanceMarks ?? 0} marks`} icon={Activity} />
                <StatCard label="Active members" value={String(o.activeMembers ?? '—')} sub={`${o.protocolMembers ?? 0} protocol`} icon={Users} />
                <StatCard label="Services scheduled" value={String(o.servicesScheduled ?? '—')} sub={`${o.teamsBuilt ?? 0} teams`} icon={Calendar} />
                <StatCard
                  label="Published schedule"
                  value={String(o.publishedVersion ?? '—')}
                  sub={pub.status ?? '—'}
                  icon={FileText}
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Full roster teams" value={String(o.fullRosterTeams ?? 0)} sub={`${o.underfilledTeams ?? 0} underfilled`} icon={Layers} />
                <StatCard label="Unique choirs used" value={String(o.uniqueChoirs ?? 0)} sub="This schedule" icon={Music} />
                <StatCard label="Validation warnings" value={String(o.validationWarnings ?? 0)} sub={`${o.validationErrors ?? 0} errors`} icon={ShieldCheck} />
                <StatCard label="Sessions submitted" value={String(o.sessionsSubmitted ?? 0)} sub="Attendance" icon={Activity} />
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-3">Schedule publication</h2>
                  <dl className="text-sm space-y-2 text-neutral-700">
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">Version</dt>
                      <dd className="font-medium">{pub.version ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">Status</dt>
                      <dd>
                        <Badge variant={pub.status === 'Published' ? 'success' : 'warning'}>{pub.status ?? '—'}</Badge>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">Published by</dt>
                      <dd>{pub.publishedBy ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">Published at</dt>
                      <dd className="tabular-nums">{pub.publishedAt?.slice?.(0, 19) ?? pub.publishedAt ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">Report generated</dt>
                      <dd className="tabular-nums">{report?.generatedAt?.slice(0, 19) ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-3">Roster snapshot</h2>
                  <dl className="text-sm space-y-2 text-neutral-700">
                    <div className="flex justify-between"><dt className="text-neutral-500">Total members</dt><dd>{report?.members?.total ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">Active</dt><dd>{report?.members?.active ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">Protocol</dt><dd>{report?.members?.protocol ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">With choir</dt><dd>{report?.members?.withChoir ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">User accounts</dt><dd>{report?.users?.total ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">Active logins</dt><dd>{report?.users?.active ?? '—'}</dd></div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {section === 'attendance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard label="Rate" value={String(att.rate ?? '—')} icon={Activity} />
                <StatCard label="Present" value={String(att.present ?? 0)} icon={Activity} />
                <StatCard label="Half present" value={String(att.halfPresent ?? 0)} />
                <StatCard label="Quarter present" value={String(att.quarterPresent ?? 0)} />
                <StatCard label="Absent" value={String(att.absent ?? 0)} />
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">Attendance by status</h2>
                  <DataTable
                    columns={[
                      { key: 'status', label: 'Status' },
                      { key: 'count', label: 'Count' },
                    ]}
                    rows={[
                      { id: 1, status: 'Present', count: att.present },
                      { id: 2, status: 'Half Present', count: att.halfPresent },
                      { id: 3, status: 'Quarter Present', count: att.quarterPresent },
                      { id: 4, status: 'Absent', count: att.absent },
                      { id: 5, status: 'Total marks', count: att.total ?? o.attendanceMarks },
                    ]}
                  />
                </div>
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">Sessions ({report?.attendance?.sessions?.length ?? 0})</h2>
                  {(report?.attendance?.sessions?.length ?? 0) === 0 ? (
                    <EmptyNote>No attendance sessions in this filter range.</EmptyNote>
                  ) : (
                    <DataTable
                      columns={[
                        { key: 'date', label: 'Date' },
                        { key: 'service', label: 'Service' },
                        { key: 'status', label: 'Status' },
                        { key: 'rate', label: 'Present %' },
                        { key: 'absent', label: 'Absent' },
                      ]}
                      rows={(report?.attendance?.sessions ?? []).map((s) => ({ ...s, id: s.id }))}
                    />
                  )}
                </div>
              </div>
              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-1">Member attendance detail</h2>
                <p className="text-xs text-neutral-500 mb-4">
                  Weighted rate (Present=1, Half=0.5, Quarter=0.25). Sorted toward higher absence when session data exists.
                </p>
                {(report?.attendance?.members?.length ?? 0) === 0 ? (
                  <EmptyNote>No member-level attendance marks yet.</EmptyNote>
                ) : (
                  <DataTable
                    columns={[
                      { key: 'name', label: 'Member' },
                      { key: 'choir', label: 'Choir' },
                      { key: 'marks', label: 'Marks' },
                      { key: 'present', label: 'Present' },
                      { key: 'halfPresent', label: 'Half' },
                      { key: 'quarterPresent', label: 'Quarter' },
                      { key: 'absent', label: 'Absent' },
                      { key: 'rate', label: 'Rate' },
                    ]}
                    rows={(report?.attendance?.members ?? []).map((m) => ({ ...m, id: m.id }))}
                  />
                )}
              </div>
            </div>
          )}

          {section === 'scheduling' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Services" value={String(report?.schedule?.serviceCount ?? 0)} icon={Calendar} />
                <StatCard label="Teams" value={String(report?.schedule?.teamCount ?? 0)} icon={Layers} />
                <StatCard label="Choir slots" value={String(report?.schedule?.choirAssignments?.length ?? 0)} icon={Music} />
                <StatCard label="Published" value={String(pub.version ?? '—')} icon={FileText} />
              </div>
              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-4">All services</h2>
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date' },
                    { key: 'name', label: 'Service' },
                    { key: 'day', label: 'Day' },
                    { key: 'status', label: 'Status' },
                  ]}
                  rows={(report?.schedule?.services ?? []).map((s) => ({ ...s }))}
                />
              </div>
              {(report?.schedule?.history?.length ?? 0) > 0 && (
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">Schedule version history</h2>
                  <DataTable
                    columns={[
                      { key: 'version_label', label: 'Version' },
                      { key: 'status', label: 'Status' },
                      { key: 'month_key', label: 'Month' },
                      { key: 'published_at', label: 'Published' },
                      { key: 'created_at', label: 'Created' },
                    ]}
                    rows={(report?.schedule?.history ?? []).map((h, i) => ({
                      id: i,
                      ...h,
                      published_at: h.published_at?.slice?.(0, 19) ?? h.published_at ?? '—',
                      created_at: h.created_at?.slice?.(0, 19) ?? h.created_at ?? '—',
                    }))}
                  />
                </div>
              )}
            </div>
          )}

          {section === 'choirs' && (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">Choir usage frequency</h2>
                  {(report?.schedule?.choirFrequency?.length ?? 0) === 0 ? (
                    <EmptyNote>No choir assignments.</EmptyNote>
                  ) : (
                    <DataTable
                      columns={[
                        { key: 'choir', label: 'Choir' },
                        { key: 'count', label: 'Assignments' },
                      ]}
                      rows={(report?.schedule?.choirFrequency ?? []).map((r, i) => ({ id: i, ...r }))}
                    />
                  )}
                </div>
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">Members by home choir</h2>
                  <DataTable
                    columns={[
                      { key: 'choir', label: 'Choir' },
                      { key: 'count', label: 'Members' },
                    ]}
                    rows={(report?.members?.byChoir ?? []).map((r, i) => ({ id: i, ...r }))}
                  />
                </div>
              </div>
              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-4">Per-service choir assignments</h2>
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date' },
                    { key: 'service', label: 'Service' },
                    { key: 'choirCount', label: '# Choirs' },
                    { key: 'choirs', label: 'Choirs' },
                    { key: 'status', label: 'Status' },
                  ]}
                  rows={(report?.schedule?.choirAssignments ?? []).map((r, i) => ({ id: i, ...r }))}
                />
              </div>
            </div>
          )}

          {section === 'leadership' && (
            <div className="space-y-6">
              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-1">Leadership load (TL / VTL counts)</h2>
                <p className="text-xs text-neutral-500 mb-4">How often each person served as Team Leader or Vice Team Leader this month.</p>
                <DataTable
                  columns={[
                    { key: 'member', label: 'Member' },
                    { key: 'teamLeader', label: 'As TL' },
                    { key: 'viceLeader', label: 'As VTL' },
                  ]}
                  rows={(report?.schedule?.leadershipTally ?? []).map((r, i) => ({ id: i, ...r }))}
                />
              </div>
              {(report?.schedule?.leadershipDetail?.length ?? 0) > 0 && (
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">Leadership review board</h2>
                  <DataTable
                    columns={[
                      { key: 'date', label: 'Service' },
                      { key: 'teamLeader', label: 'Team Leader' },
                      { key: 'viceLeader', label: 'Vice Leader' },
                      { key: 'status', label: 'Status' },
                    ]}
                    rows={(report?.schedule?.leadershipDetail ?? []).map((r, i) => ({ id: i, ...r }))}
                  />
                </div>
              )}
            </div>
          )}

          {section === 'teams' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Teams built" value={String(report?.schedule?.teamCount ?? 0)} icon={Layers} />
                <StatCard label="At target size" value={String(report?.schedule?.fullRosterTeams ?? 0)} />
                <StatCard label="Underfilled" value={String(report?.schedule?.underfilledTeams ?? 0)} />
                <StatCard
                  label="By kind"
                  value={`${report?.schedule?.teamsByKind?.sunday ?? 0}S / ${report?.schedule?.teamsByKind?.weekday ?? 0}W`}
                  sub={`${report?.schedule?.teamsByKind?.igaburo ?? 0} Igaburo`}
                />
              </div>
              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-4">Teams by service kind</h2>
                <DataTable
                  columns={[
                    { key: 'kind', label: 'Kind' },
                    { key: 'count', label: 'Teams' },
                  ]}
                  rows={[
                    { id: 1, kind: 'Sunday', count: report?.schedule?.teamsByKind?.sunday ?? 0 },
                    { id: 2, kind: 'Weekday', count: report?.schedule?.teamsByKind?.weekday ?? 0 },
                    { id: 3, kind: 'Igaburo', count: report?.schedule?.teamsByKind?.igaburo ?? 0 },
                    { id: 4, kind: 'Other', count: report?.schedule?.teamsByKind?.other ?? 0 },
                  ]}
                />
              </div>
              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-4">Team fill by service</h2>
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date / service' },
                    { key: 'kind', label: 'Kind' },
                    { key: 'size', label: 'Size' },
                    { key: 'target', label: 'Target' },
                    { key: 'teamLeader', label: 'TL' },
                    { key: 'viceTeamLeader', label: 'VTL' },
                    { key: 'status', label: 'Status' },
                  ]}
                  rows={(report?.schedule?.teamFill ?? []).map((r, i) => ({
                    id: i,
                    ...r,
                    date: r.service || r.date,
                  }))}
                />
              </div>
              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-1">Member duty load</h2>
                <p className="text-xs text-neutral-500 mb-4">
                  How often each person appears on a service team this month (plus leadership stints).
                </p>
                {(report?.schedule?.memberDutyLoad?.length ?? 0) === 0 ? (
                  <EmptyNote>No team rosters to analyze yet.</EmptyNote>
                ) : (
                  <DataTable
                    columns={[
                      { key: 'member', label: 'Member' },
                      { key: 'assignments', label: 'Team slots' },
                      { key: 'asLeader', label: 'As TL/VTL' },
                    ]}
                    rows={(report?.schedule?.memberDutyLoad ?? []).map((r, i) => ({ id: i, ...r }))}
                  />
                )}
              </div>
            </div>
          )}

          {section === 'members' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total" value={String(report?.members?.total ?? 0)} icon={Users} />
                <StatCard label="Active" value={String(report?.members?.active ?? 0)} />
                <StatCard label="Protocol" value={String(report?.members?.protocol ?? 0)} />
                <StatCard label="Leadership roles" value={String(report?.members?.leadership ?? 0)} />
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">Protocol members by choir</h2>
                  <DataTable
                    columns={[
                      { key: 'choir', label: 'Choir' },
                      { key: 'count', label: 'Count' },
                    ]}
                    rows={(report?.members?.byChoir ?? []).map((r, i) => ({ id: i, ...r }))}
                  />
                </div>
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">User accounts</h2>
                  <dl className="text-sm space-y-2">
                    <div className="flex justify-between"><dt className="text-neutral-500">Total accounts</dt><dd>{report?.users?.total ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">Active</dt><dd>{report?.users?.active ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">Invited</dt><dd>{report?.users?.invited ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">Deactivated</dt><dd>{report?.users?.deactivated ?? '—'}</dd></div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {section === 'validation' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Passed" value={String(report?.schedule?.validation?.passed ?? 0)} />
                <StatCard label="Warnings" value={String(report?.schedule?.validation?.warnings ?? 0)} />
                <StatCard label="Errors" value={String(report?.schedule?.validation?.errors ?? 0)} />
              </div>
              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-4">Validation findings</h2>
                {(report?.schedule?.validation?.rows?.length ?? 0) === 0 ? (
                  <EmptyNote>No validation rows on the current schedule.</EmptyNote>
                ) : (
                  <DataTable
                    columns={[
                      { key: 'rule', label: 'Rule' },
                      { key: 'severity', label: 'Severity' },
                      { key: 'issue', label: 'Issue' },
                      { key: 'service', label: 'Service' },
                      { key: 'status', label: 'Status' },
                    ]}
                    rows={(report?.schedule?.validation?.rows ?? []).map((r, i) => ({ id: i, ...r }))}
                  />
                )}
              </div>
              {(report?.activity?.length ?? 0) > 0 && (
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">Related system activity</h2>
                  <DataTable
                    columns={[
                      { key: 'time', label: 'When' },
                      { key: 'summary', label: 'Event' },
                      { key: 'action', label: 'Action' },
                    ]}
                    rows={(report?.activity ?? []).slice(0, 15).map((a, i) => ({
                      id: i,
                      time: a.time?.slice?.(0, 19) ?? a.time,
                      summary: a.summary,
                      action: a.action,
                    }))}
                  />
                </div>
              )}
            </div>
          )}

          {section === 'activity' && (
            <div className="space-y-6">
              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-1">Recent ministry activity</h2>
                <p className="text-xs text-neutral-500 mb-4">
                  Schedule publishes, attendance submissions, and other non-login audit events.
                </p>
                {(report?.activity?.length ?? 0) === 0 ? (
                  <EmptyNote>No activity recorded yet.</EmptyNote>
                ) : (
                  <DataTable
                    columns={[
                      { key: 'time', label: 'When' },
                      { key: 'summary', label: 'Event' },
                      { key: 'action', label: 'Action' },
                    ]}
                    rows={(report?.activity ?? []).map((a, i) => ({
                      id: i,
                      time: a.time?.slice?.(0, 19) ?? a.time,
                      summary: a.summary,
                      action: a.action,
                    }))}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
