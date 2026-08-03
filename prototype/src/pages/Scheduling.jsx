import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Calendar,
  Music,
  UsersRound,
  Crown,
  ShieldCheck,
  Send,
  History,
  Sparkles,
  RefreshCw,
  Check,
  Shuffle,
  FileDown,
  Archive,
} from 'lucide-react'
import { PageHeader, DataTable, Badge } from '../layouts/AppShell'
import { useRole } from '../context/RoleContext'
import { useSchedule } from '../context/ScheduleContext'
import { USE_API } from '../api/config'
import { publishSchedule } from '../api/client'
import { fetchScheduleHistory } from '../api/schedule'
import { PUBLISH_INFO, SCHEDULE_HISTORY } from '../data/mock'
import { normalizeTeam } from '../components/TeamCardActions'
import ChoirScheduleTab from './scheduling/ChoirScheduleTab'
import ServiceTeamsTab from './scheduling/ServiceTeamsTab'

const TABS = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'choir', label: 'Choir Schedule', icon: Music },
  { id: 'teams', label: 'Service Teams', icon: UsersRound },
  { id: 'leadership', label: 'Leadership Review', icon: Crown },
  { id: 'validation', label: 'Validation', icon: ShieldCheck },
  { id: 'publish', label: 'Publish', icon: Send },
  { id: 'history', label: 'History', icon: History },
]

export default function SchedulingPage() {
  const { permissions } = useRole()
  const { payload, editable, updatePayload, refresh, loading: scheduleLoading, source } = useSchedule()

  const services = payload.services ?? []
  const leadership = payload.leadershipReview ?? []
  const validationSummary = payload.validationSummary ?? { passed: 0, warnings: 0, errors: 0, status: 'PENDING' }
  const validationRows = payload.validationRows ?? []

  const visibleTabs = TABS.filter((t) => permissions.schedulingTabs.includes(t.id))
  const canEdit = permissions.manageSchedule && (USE_API ? editable : true)

  const teamRows = useMemo(
    () => (payload.teamAssignments ?? []).map((t) => ({ ...normalizeTeam(t), _key: t.serviceId ?? t.date })),
    [payload.teamAssignments],
  )

  const choirRows = useMemo(
    () => (payload.choirAssignments ?? []).map((c, i) => ({ ...c, _key: `${c.service}-${c.date}-${i}` })),
    [payload.choirAssignments],
  )

  const setTeamRows = useCallback(
    (next) => {
      const list = typeof next === 'function' ? next(teamRows) : next
      updatePayload((p) => ({
        ...p,
        teamAssignments: list.map(({ _key, ...rest }) => rest),
      }))
    },
    [teamRows, updatePayload],
  )

  const setChoirRows = useCallback(
    (next) => {
      const list = typeof next === 'function' ? next(choirRows) : next
      updatePayload((p) => ({
        ...p,
        choirAssignments: list.map(({ _key, ...rest }) => rest),
      }))
    },
    [choirRows, updatePayload],
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const defaultTab = visibleTabs[0]?.id ?? 'calendar'
  const [tab, setTab] = useState(
    tabParam && visibleTabs.some((t) => t.id === tabParam) ? tabParam : defaultTab,
  )
  const [toast, setToast] = useState(null)
  const [historyRows, setHistoryRows] = useState(SCHEDULE_HISTORY)
  const [publishMeta, setPublishMeta] = useState(PUBLISH_INFO)

  useEffect(() => {
    if (!USE_API || tab !== 'history') return
    fetchScheduleHistory()
      .then((d) => setHistoryRows(d.history ?? []))
      .catch(() => {})
  }, [tab])

  useEffect(() => {
    if (USE_API && source === 'published') {
      setPublishMeta((prev) => ({
        ...prev,
        status: 'Published',
        version: payload.versionLabel ?? prev.version,
      }))
    }
  }, [source, payload.versionLabel])

  useEffect(() => {
    const allowed = permissions.schedulingTabs
    if (tabParam && allowed.includes(tabParam)) setTab(tabParam)
    else if (!allowed.includes(tab)) setTab(allowed[0] ?? 'calendar')
  }, [tabParam, permissions.schedulingTabs, tab])

  const selectTab = (id) => {
    setTab(id)
    setSearchParams({ tab: id })
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Scheduling Center"
        description={
          canEdit
            ? 'Generate, review, validate, and publish monthly protocol schedules'
            : `View ${source === 'published' ? 'published' : 'schedule'} assignments (read-only)`
        }
      />

      {USE_API && scheduleLoading && (
        <p className="text-sm text-neutral-500 mb-4">Loading schedule from API…</p>
      )}

      <div className="pmss-tab-rail mb-6">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={`shrink-0 inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-card text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span className="whitespace-nowrap">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input type="month" defaultValue="2026-08" className="pmss-input w-auto" />
            {canEdit && (
            <button type="button" className="pmss-btn-primary" onClick={() => showToast('Monthly calendar generated')}>
              <Sparkles className="w-4 h-4" /> Generate monthly calendar
            </button>
            )}
          </div>
          <DataTable
            columns={[
              { key: 'name', label: 'Service' },
              { key: 'date', label: 'Date' },
              { key: 'day', label: 'Day' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <Badge variant={r.status === 'Scheduled' ? 'success' : 'warning'}>{r.status}</Badge>,
              },
            ]}
            rows={services}
          />
        </div>
      )}

      {tab === 'choir' && (
        <ChoirScheduleTab
          canEdit={canEdit}
          showToast={showToast}
          controlledAssignments={USE_API ? choirRows : undefined}
          onAssignmentsChange={USE_API ? setChoirRows : undefined}
          monthLabel={payload.monthLabel ?? 'August 2026'}
        />
      )}

      {tab === 'teams' && (
        <ServiceTeamsTab
          canEdit={canEdit}
          showToast={showToast}
          controlledTeams={USE_API ? teamRows : undefined}
          onTeamsChange={USE_API ? setTeamRows : undefined}
          services={USE_API ? services : undefined}
          monthLabel={payload.monthLabel ?? 'August 2026'}
        />
      )}

      {tab === 'leadership' && (
        <div className="space-y-4">
          {leadership.map((l, i) => (
            <div key={i} className="pmss-card p-5">
              <div className="flex flex-wrap justify-between gap-2 mb-4">
                <div>
                  <Badge variant="primary">{l.date}</Badge>
                  <p className="text-sm text-neutral-500 mt-2">{l.status}</p>
                </div>
                <Badge variant={l.status.startsWith('Approved') ? 'success' : 'warning'}>{l.status}</Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-card bg-neutral-50">
                  <p className="text-xs text-neutral-500">Recommended team leader</p>
                  <p className="font-semibold">{l.tl}</p>
                </div>
                <div className="p-3 rounded-card bg-neutral-50">
                  <p className="text-xs text-neutral-500">Recommended vice team leader</p>
                  <p className="font-semibold">{l.vtl}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                <>
                <button type="button" className="pmss-btn-primary text-xs h-9 px-3">
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
                <button type="button" className="pmss-btn-secondary text-xs h-9 px-3">
                  Change leader
                </button>
                <button type="button" className="pmss-btn-secondary text-xs h-9 px-3">
                  Change vice
                </button>
                <button type="button" className="pmss-btn-secondary text-xs h-9 px-3">
                  <Shuffle className="w-3.5 h-3.5" /> Randomize again
                </button>
                </>
                ) : (
                  <p className="text-sm text-neutral-500">Read-only — coordinator approval required.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'validation' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={validationSummary.status === 'PASS' ? 'success' : validationSummary.errors ? 'error' : 'warning'}>
              {validationSummary.status}
            </Badge>
            <span className="text-sm text-neutral-500">{payload.monthLabel ?? 'August 2026'} schedule validation</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="pmss-card p-4 text-center">
              <p className="text-2xl font-semibold text-emerald-600">{validationSummary.passed}</p>
              <p className="text-xs text-neutral-500 mt-1">Passed</p>
            </div>
            <div className="pmss-card p-4 text-center">
              <p className="text-2xl font-semibold text-amber-600">{validationSummary.warnings}</p>
              <p className="text-xs text-neutral-500 mt-1">Warnings</p>
            </div>
            <div className="pmss-card p-4 text-center">
              <p className="text-2xl font-semibold text-red-600">{validationSummary.errors}</p>
              <p className="text-xs text-neutral-500 mt-1">Errors</p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: 'rule', label: 'Rule' },
              { key: 'issue', label: 'Issue' },
              {
                key: 'severity',
                label: 'Severity',
                render: (r) => {
                  const v =
                    r.severity === 'Error' ? 'error' : r.severity === 'Warning' ? 'warning' : 'success'
                  return <Badge variant={v}>{r.severity}</Badge>
                },
              },
              { key: 'service', label: 'Service' },
              { key: 'status', label: 'Status' },
            ]}
            rows={validationRows}
          />
          {canEdit && (
          <button type="button" className="pmss-btn-secondary" onClick={() => selectTab('teams')}>
            Fix issues in Service Teams →
          </button>
          )}
        </div>
      )}

      {tab === 'publish' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 pmss-card p-5">
            <h2 className="font-semibold mb-2">Schedule preview</h2>
            <p className="text-sm text-neutral-500 mb-4">
              {payload.monthLabel ?? 'August 2026'} — {services.length} services, choir & protocol teams assigned
            </p>
            <div className="border border-neutral-200 rounded-card p-4 bg-neutral-50 text-sm space-y-2 max-h-64 overflow-auto">
              {services.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="text-neutral-500">{s.date}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pmss-card p-5 space-y-4">
            <div>
              <p className="text-xs text-neutral-500">Status</p>
              <Badge variant="success">{publishMeta.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Version</p>
              <p className="font-semibold">{publishMeta.version}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Published by</p>
              <p className="text-sm font-medium">{publishMeta.publishedBy}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Published date</p>
              <p className="text-sm font-medium">{publishMeta.publishedDate}</p>
            </div>
            {canEdit ? (
            <>
            <button
              type="button"
              className="pmss-btn-primary w-full"
              onClick={async () => {
                if (USE_API) {
                  try {
                    const result = await publishSchedule()
                    showToast(`Schedule published ${result.versionLabel}`)
                    setPublishMeta({
                      status: 'Published',
                      version: result.versionLabel,
                      publishedBy: result.publishedBy ?? publishMeta.publishedBy,
                      publishedDate: new Date(result.publishedAt).toLocaleDateString(),
                    })
                    await refresh()
                  } catch (err) {
                    showToast(err.message ?? 'Publish failed')
                    return
                  }
                } else {
                  showToast('Schedule published successfully')
                }
                selectTab('history')
              }}
            >
              Publish schedule
            </button>
            <button type="button" className="pmss-btn-secondary w-full">
              <Archive className="w-4 h-4" /> Archive schedule
            </button>
            </>
            ) : null}
            <button type="button" className="pmss-btn-secondary w-full">
              <FileDown className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <DataTable
          columns={[
            { key: 'version', label: 'Version' },
            { key: 'date', label: 'Date' },
            { key: 'by', label: 'Generated by' },
            { key: 'changes', label: 'Changes' },
            {
              key: 'actions',
              label: 'Actions',
              render: () => (
                <span className="text-primary-600 text-xs font-medium">
                  View · Restore
                </span>
              ),
            },
          ]}
          rows={historyRows}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
