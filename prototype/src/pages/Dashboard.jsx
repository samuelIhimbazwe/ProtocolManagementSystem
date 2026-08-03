import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Music,
  UsersRound,
  ShieldCheck,
  Send,
  ClipboardCheck,
  UserCircle,
  Briefcase,
  Clock,
  Wallet,
  FileText,
} from 'lucide-react'
import { PageHeader, StatCard, Badge } from '../layouts/AppShell'
import { USE_API } from '../api/config'
import { useSchedule } from '../context/ScheduleContext'
import { useRole } from '../context/RoleContext'
import {
  fetchDashboardActivity,
  fetchDashboardSummary,
  fetchNotifications,
} from '../api/schedule'
import { DASHBOARD_STATS, NOTIFICATIONS, ACTIVITIES, SERVICES } from '../data/mock'
import { ROLES } from '../data/roles'
import { getMemberTeamAssignments, dutyWindowForService } from '../data/officeAccess'
import { canRecordAttendance } from '../data/memberAttendance'
import { formatRwf } from '../lib/money'
import { ServiceReportModal, SubmittedServiceReportsPanel } from '../components/ServiceReportModal'
import { fetchServiceReportForService } from '../api/serviceReports'
import { ROLE_LABELS, resolveJurisdiction } from '../lib/officeReportBuilder'

function OfficeReportEntryCard({ roleId, officeKind }) {
  const jurisdiction = resolveJurisdiction(roleId, officeKind)
  if (!USE_API || !jurisdiction) return null
  return (
    <Link
      to="/office-reports"
      className="pmss-card p-5 mb-8 block hover:border-primary-200 transition-colors group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-primary-700 shrink-0" />
            <h2 className="font-semibold text-neutral-900 group-hover:text-primary-800">
              Office report builder
            </h2>
          </div>
          <p className="text-sm text-neutral-500">
            Build a report from anything you can access ({ROLE_LABELS[jurisdiction] ?? jurisdiction}), preview it,
            download it, and submit it to a leader.
          </p>
        </div>
        <span className="text-sm font-semibold text-primary-700 shrink-0">Open →</span>
      </div>
    </Link>
  )
}

function DashboardSectionTabs({ section, onChange, showOffice, officeKind, dutyCount }) {
  if (!showOffice) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6 pmss-no-print">
      <div className="inline-flex p-1 rounded-xl bg-neutral-100/80 border border-neutral-200/80">
        <button
          type="button"
          onClick={() => onChange('portal')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            section === 'portal'
              ? 'bg-white text-primary-800 shadow-sm ring-1 ring-neutral-200/80'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <UserCircle className="w-4 h-4" />
          Portal
        </button>
        <button
          type="button"
          onClick={() => onChange('office')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            section === 'office'
              ? 'bg-white text-primary-800 shadow-sm ring-1 ring-neutral-200/80'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Office
          {officeKind === 'team_duty' && dutyCount > 0 && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              Duty
            </span>
          )}
        </button>
      </div>
      <p className="text-xs text-neutral-500 w-full sm:w-auto">
        {officeKind === 'leadership'
          ? 'Leadership workspace for ministry operations.'
          : 'Office is available while you serve as TL or VTL for an assigned service.'}
      </p>
    </div>
  )
}

function PortalDashboard({ member, demoToday, isMemberRole, showOffice, teamAssignments, monthLabel }) {
  const memberName = member?.name
  const myTeams = memberName
    ? getMemberTeamAssignments(memberName, teamAssignments, demoToday).slice(0, 6)
    : []
  const nextAssignment = myTeams[0]

  return (
    <>
      {!showOffice && isMemberRole && (
        <p className="text-sm text-neutral-600 mb-6 pmss-card p-4">
          Team Leader / Vice Team Leader tools appear here automatically during your duty window (2 days before
          through 1 day after the service).
        </p>
      )}

      {isMemberRole && member && (
        <div className="pmss-card p-5 mb-6 border-primary-100/80">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Welcome back</p>
          <h2 className="text-lg font-semibold text-neutral-900 mt-1">{member.name}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-neutral-600">
            {member.choir && (
              <span>
                Choir: <span className="font-medium text-neutral-800">{member.choir}</span>
              </span>
            )}
            {member.attendanceRate != null && (
              <span>
                Attendance:{' '}
                <span className="font-medium text-neutral-800">{member.attendanceRate}%</span>
              </span>
            )}
          </div>
        </div>
      )}

      {!isMemberRole && (
        <div className="pmss-card p-5 mb-6">
          <p className="text-sm text-neutral-600">
            Personal portal. Switch to <span className="font-semibold text-neutral-800">Office</span> for
            ministry-wide operations.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {isMemberRole && (
          <StatCard
            label="My upcoming teams"
            value={String(myTeams.length)}
            sub="From today onward"
            icon={UsersRound}
          />
        )}
        <StatCard
          label="Published schedule"
          value={monthLabel}
          sub="View in Scheduling →"
          icon={Calendar}
          to="/scheduling"
        />
        {member?.attendanceRate != null && (
          <StatCard
            label="My attendance"
            value={`${member.attendanceRate}%`}
            sub="This month"
            trend="up"
            icon={TrendingUp}
          />
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {isMemberRole && (
          <div className="lg:col-span-2 pmss-card p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">My service assignments</h2>
              <Link to="/scheduling?tab=teams" className="text-sm text-primary-600 font-medium">
                Full schedule →
              </Link>
            </div>
            {myTeams.length === 0 ? (
              <p className="text-sm text-neutral-500">No upcoming protocol teams on the roster.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {myTeams.map((t) => (
                  <li key={`${t.serviceId}-${t.serviceName}`} className="py-3 flex justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{t.serviceName}</p>
                      <p className="text-xs text-neutral-500">{t.date}</p>
                      {(t.teamLeader === memberName || t.viceTeamLeader === memberName) && (
                        <p className="text-xs text-primary-600 font-medium mt-1">
                          {t.teamLeader === memberName ? 'Team Leader' : 'Vice Team Leader'}
                        </p>
                      )}
                    </div>
                    <Badge variant="primary">{t.status ?? 'Assigned'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={`space-y-6 ${isMemberRole ? '' : 'lg:col-span-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-6'}`}>
          <div className="pmss-card p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Notifications</h2>
              <Link to="/notifications" className="text-sm text-primary-600 font-medium">
                View all →
              </Link>
            </div>
            <ul className="space-y-3">
              {NOTIFICATIONS.slice(0, 3).map((n, i) => (
                <li key={i} className={`text-sm p-2 rounded-lg ${n.unread ? 'bg-primary-50/80' : ''}`}>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-neutral-500 text-xs mt-0.5">{n.body}</p>
                </li>
              ))}
            </ul>
          </div>

          {isMemberRole && nextAssignment && (
            <div className="pmss-card p-5 border-primary-100">
              <h2 className="font-semibold mb-2">Next on duty</h2>
              <p className="text-sm font-medium">{nextAssignment.serviceName}</p>
              <p className="text-xs text-neutral-500 mt-1">{nextAssignment.date}</p>
              <Link to="/scheduling" className="text-sm text-primary-600 font-medium mt-3 inline-block">
                View details
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function OfficeDashboardLeadership({ permissions, roleId, navigate, stats, services, activity, notifications, monthLabel }) {
  const roleLabel = ROLES.find((r) => r.id === roleId)?.label
  const [toast, setToast] = useState('')
  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }
  const quickActions = [
    { label: 'Generate Choir Schedule', icon: Music, to: '/scheduling?tab=choir' },
    { label: 'Build Service Teams', icon: UsersRound, to: '/scheduling?tab=teams' },
    { label: 'Validate Schedule', icon: ShieldCheck, to: '/scheduling?tab=validation' },
    { label: 'Publish Schedule', icon: Send, to: '/scheduling?tab=publish' },
  ]
  if (permissions.viewFinance) {
    quickActions.push({ label: 'Finance & Contributions', icon: Wallet, to: '/finance' })
  }
  const previewServices = services.slice(0, 3)
  const previewActivity = activity.slice(0, 3)
  const previewNotifications = notifications.slice(0, 3)

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Members" value={String(stats.totalMembers)} sub="Admin + protocol" icon={Users} />
        <StatCard label="Active Members" value={String(stats.activeMembers)} sub="Protocol roster" icon={Users} />
        <StatCard label="Upcoming Services" value={String(stats.upcomingServices)} sub="This month" icon={Calendar} />
        <StatCard label="Attendance Rate" value={stats.attendanceRate} sub="Submitted sessions" trend="up" icon={TrendingUp} />
        <StatCard
          label="Published Schedule"
          value={stats.publishedSchedule}
          sub={stats.scheduleStatus}
          icon={CheckCircle2}
          to="/scheduling"
        />
      </div>

      {permissions.viewFinance && stats.financeCollected != null && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Contributions collected"
            value={formatRwf(stats.financeCollected)}
            sub="Confirmed + partial"
            icon={Wallet}
          />
          <StatCard
            label="Pending verification"
            value={String(stats.financePending ?? 0)}
            sub="Awaiting treasurer"
            icon={ClipboardCheck}
          />
          <StatCard
            label="Outstanding balances"
            value={formatRwf(stats.financeOutstanding ?? 0)}
            sub="Open follow-ups"
            icon={TrendingUp}
          />
        </div>
      )}

      {USE_API && <OfficeReportEntryCard roleId={roleId} officeKind="leadership" />}

      {permissions.manageSchedule && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-900 mb-3">Quick actions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.to)}
                className="pmss-card p-4 text-left hover:border-primary-200 hover:shadow-md transition-all group"
              >
                <action.icon className="w-5 h-5 text-primary-600 mb-2" />
                <p className="text-sm font-medium text-neutral-900 group-hover:text-primary-700">{action.label}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {!permissions.manageSchedule && permissions.viewReports && (
        <section className="mb-8">
          <Link to="/reports" className="pmss-card p-4 block hover:border-primary-200 transition-all">
            <p className="text-sm font-semibold">Reports & analytics</p>
            <p className="text-xs text-neutral-500 mt-1">Attendance and scheduling summaries for leadership</p>
          </Link>
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 pmss-card p-5 h-fit">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Upcoming services</h2>
            <Link to="/scheduling" className="text-sm text-primary-600 font-medium">
              View all →
            </Link>
          </div>
          {previewServices.length === 0 ? (
            <p className="text-sm text-neutral-500">No upcoming services.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {previewServices.map((s) => (
                <li key={s.id} className="py-2.5 flex justify-between items-center gap-2">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-neutral-500">
                      {s.date} · {s.day}
                    </p>
                  </div>
                  <Badge variant={s.status === 'Published' ? 'success' : 'warning'}>{s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          {services.length > previewServices.length && (
            <Link to="/scheduling" className="inline-block mt-2 text-xs font-medium text-primary-600">
              +{services.length - previewServices.length} more in Scheduling
            </Link>
          )}
        </div>

        <div className="space-y-6">
          <div className="pmss-card p-5 h-fit">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Recent activity</h2>
              <Link to="/activity" className="text-sm text-primary-600 font-medium">
                View all →
              </Link>
            </div>
            <ul className="space-y-3">
              {previewActivity.map((a, i) => (
                <li key={i} className="text-sm">
                  <p className="text-neutral-800">{a.text}</p>
                  <p className="text-xs text-neutral-400">{a.time}</p>
                </li>
              ))}
            </ul>
            {activity.length === 0 && <p className="text-sm text-neutral-500">No recent activity.</p>}
          </div>

          {USE_API && <SubmittedServiceReportsPanel />}

          <div className="pmss-card p-5 h-fit">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Notifications</h2>
              <Link to="/notifications" className="text-sm text-primary-600 font-medium">
                View all →
              </Link>
            </div>
            <ul className="space-y-3">
              {previewNotifications.map((n, i) => (
                <li key={n.id ?? i} className={`text-sm p-2 rounded-lg ${n.unread ? 'bg-primary-50/80' : ''}`}>
                  <p className="font-medium flex items-center gap-2">
                    {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />}
                    {n.title}
                  </p>
                  <p className="text-neutral-500 text-xs mt-0.5">{n.body}</p>
                </li>
              ))}
            </ul>
            {notifications.length === 0 && <p className="text-sm text-neutral-500">No notifications.</p>}
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-400 mt-8">{roleLabel} · {monthLabel}</p>
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}

function OfficeDashboardTeamDuty({ activeDuties, navigate, permissions, roleId }) {
  const [reportDuty, setReportDuty] = useState(null)
  const [toast, setToast] = useState('')
  const [reportStatusByService, setReportStatusByService] = useState({})

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  useEffect(() => {
    if (!USE_API || !activeDuties?.length) return
    let cancelled = false
    ;(async () => {
      const next = {}
      for (const duty of activeDuties) {
        try {
          const data = await fetchServiceReportForService(duty.serviceId)
          if (data.report) next[duty.serviceId] = data.report.status
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setReportStatusByService(next)
    })()
    return () => {
      cancelled = true
    }
  }, [activeDuties])

  return (
    <>
      <div className="pmss-card p-5 mb-6 border-amber-200 bg-amber-50/40">
        <div className="flex gap-3">
          <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-neutral-900">Temporary team leadership access</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Office appears because you are assigned as Team Leader or Vice Team Leader. Use the office report
              builder below (or a per-service report) to document how the service went. When the duty window
              ends, this tab is hidden.
            </p>
          </div>
        </div>
      </div>

      {USE_API && <OfficeReportEntryCard roleId={roleId} officeKind="team_duty" />}

      <div className="space-y-6">
        {activeDuties.map((duty) => {
          const window = dutyWindowForService(duty.serviceDate)
          const reportStatus = reportStatusByService[duty.serviceId]
          return (
            <div key={`${duty.serviceId}-${duty.dutyRole}`} className="pmss-card p-5">
              <div className="flex flex-wrap justify-between gap-3 mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">{duty.dutyRole === 'TL' ? 'Team Leader' : 'Vice Team Leader'}</Badge>
                    {reportStatus && (
                      <Badge variant={reportStatus === 'submitted' ? 'success' : 'warning'}>
                        Report: {reportStatus === 'submitted' ? 'Submitted' : 'Draft'}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg mt-2">{duty.serviceName}</h3>
                  <p className="text-sm text-neutral-500">{duty.dateLabel}</p>
                  <p className="text-xs text-neutral-400 mt-2">
                    Office active {window.starts} → {window.ends}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {USE_API && (
                    <button
                      type="button"
                      onClick={() => setReportDuty(duty)}
                      className="pmss-btn-primary inline-flex items-center gap-2 text-sm h-9 px-3"
                    >
                      <FileText className="w-4 h-4" />
                      {reportStatus === 'submitted' ? 'View report' : 'Write service report'}
                    </button>
                  )}
                  {canRecordAttendance(roleId, permissions) && (
                    <button
                      type="button"
                      onClick={() => navigate('/attendance/record')}
                      className="pmss-btn-secondary inline-flex items-center gap-2 text-sm h-9 px-3"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Record attendance
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/scheduling?tab=teams')}
                    className="pmss-btn-secondary text-sm h-9 px-3"
                  >
                    View team roster
                  </button>
                </div>
              </div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Your team</p>
              <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                {duty.members.map((name) => (
                  <li
                    key={name}
                    className="px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100 flex justify-between"
                  >
                    <span>{name}</span>
                    {name === duty.teamLeader && <span className="text-xs text-primary-600 font-medium">TL</span>}
                    {name === duty.viceTeamLeader && name !== duty.teamLeader && (
                      <span className="text-xs text-primary-600 font-medium">VTL</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <ServiceReportModal
        open={Boolean(reportDuty)}
        duty={reportDuty}
        onClose={() => setReportDuty(null)}
        onToast={showToast}
        onSaved={(report) => {
          if (report?.serviceId) {
            setReportStatusByService((prev) => ({ ...prev, [report.serviceId]: report.status }))
          }
        }}
      />

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}

function defaultSection(showOffice, officeKind, paramView) {
  if (paramView === 'office' && showOffice) return 'office'
  if (paramView === 'portal') return 'portal'
  if (officeKind === 'leadership') return 'office'
  return 'portal'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { permissions, roleId, member, officeAccess, demoToday, teamAssignments } = useRole()
  const { payload } = useSchedule()
  const services = USE_API ? payload.services ?? [] : SERVICES
  const { showOffice, kind: officeKind, activeDuties } = officeAccess
  const paramView = searchParams.get('view')
  const [section, setSection] = useState(() => defaultSection(showOffice, officeKind, paramView))
  const [stats, setStats] = useState(DASHBOARD_STATS)
  const [activity, setActivity] = useState(ACTIVITIES)
  const [notifications, setNotifications] = useState(NOTIFICATIONS)

  useEffect(() => {
    if (!USE_API) return
    fetchDashboardSummary()
      .then((d) => {
        if (d.stats) setStats(d.stats)
      })
      .catch(() => {})
    fetchDashboardActivity()
      .then((d) => {
        if (d.activity?.length) {
          setActivity(
            d.activity.map((a) => ({
              text: a.text,
              time: a.time?.slice(0, 10) ?? 'Recent',
            })),
          )
        }
      })
      .catch(() => {})
    fetchNotifications()
      .then((d) => {
        if (d.notifications) setNotifications(d.notifications)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!showOffice && section === 'office') setSection('portal')
  }, [showOffice, section])

  useEffect(() => {
    setSection(defaultSection(showOffice, officeKind, searchParams.get('view')))
  }, [roleId, member?.id, showOffice, officeKind])

  const setSectionAndUrl = (next) => {
    setSection(next)
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'portal') nextParams.delete('view')
    else nextParams.set('view', next)
    setSearchParams(nextParams, { replace: true })
  }

  const roleLabel = ROLES.find((r) => r.id === roleId)?.label
  const isMemberRole = roleId === 'member'
  const showingOffice = showOffice && section === 'office'
  const showingPortal = !showOffice || section === 'portal'
  const monthLabel = payload?.monthLabel ?? stats?.publishedSchedule ?? 'Current month'

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description={
          showingOffice
            ? `${roleLabel} · Office · ${monthLabel}`
            : isMemberRole && member
              ? `${member.name} · Portal · ${monthLabel}`
              : `${roleLabel} · Portal · ${monthLabel}`
        }
      />

      <DashboardSectionTabs
        section={section}
        onChange={setSectionAndUrl}
        showOffice={showOffice}
        officeKind={officeKind}
        dutyCount={activeDuties.length}
      />

      {showingPortal && (
        <PortalDashboard
          member={isMemberRole ? member : null}
          demoToday={demoToday}
          isMemberRole={isMemberRole}
          showOffice={showOffice}
          teamAssignments={teamAssignments}
          monthLabel={monthLabel}
        />
      )}

      {showingOffice && officeKind === 'leadership' && (
        <OfficeDashboardLeadership
          permissions={permissions}
          roleId={roleId}
          navigate={navigate}
          stats={stats}
          services={services}
          activity={activity}
          notifications={notifications}
          monthLabel={monthLabel}
        />
      )}

      {showingOffice && (officeKind === 'team_duty' || officeKind === 'duty') && (
        <OfficeDashboardTeamDuty
          activeDuties={activeDuties}
          navigate={navigate}
          permissions={permissions}
          roleId={roleId}
        />
      )}
    </div>
  )
}
