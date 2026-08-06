import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Send, RefreshCw } from 'lucide-react'
import { PageHeader, DataTable, Badge } from '../layouts/AppShell'
import DisplayFormatToggle from '../components/DisplayFormatToggle'
import AttendanceSessionBulletin from '../components/bulletin/AttendanceSessionBulletin'
import AttendanceSessionList from '../components/list/AttendanceSessionList'
import { useDisplayFormat } from '../hooks/useDisplayFormat'
import { MEMBERS, ATTENDANCE_SESSION_DEMO } from '../data/mock'
import { USE_API } from '../api/config'
import { useSchedule } from '../context/ScheduleContext'
import { useMembers } from '../context/MembersContext'
import {
  saveAttendanceRecords,
  startAttendanceSession,
  submitAttendanceSession,
} from '../api/schedule'
import { attendanceStatusBadgeVariant } from '../data/memberAttendance'

const STATUSES = ['Present', 'Half Present', 'Quarter Present', 'Absent']

const SERVICE_TYPES = [
  'Sunday Service 1',
  'Sunday Service 2',
  'Tuesday Service',
  'Friday Service',
  'Igaburo Service',
]

function buildSnapshotRows(members, statuses) {
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone ?? '—',
    status: statuses[m.id] ?? '—',
  }))
}

export default function AttendanceRecordPage() {
  const [format, setFormat] = useDisplayFormat('pmss-view-attendance-record', 'cards')
  const { services } = useSchedule()
  const { members } = useMembers()
  const roster = USE_API ? members : MEMBERS
  const defaultServiceId = USE_API ? (services[0]?.id ?? 's01') : null
  const [sessionId, setSessionId] = useState(null)
  const [sessionStatus, setSessionStatus] = useState('draft')
  const [serviceMeta, setServiceMeta] = useState(ATTENDANCE_SESSION_DEMO)
  const [memberIds, setMemberIds] = useState(() =>
    ATTENDANCE_SESSION_DEMO.records.map((r) => r.memberId),
  )
  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(ATTENDANCE_SESSION_DEMO.records.map((r) => [r.memberId, r.status])),
  )
  const [savedTable, setSavedTable] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    if (!USE_API || !defaultServiceId) return
    startAttendanceSession(defaultServiceId)
      .then((data) => {
        setSessionId(data.session?.id ?? null)
        setSessionStatus(data.session?.status ?? 'draft')
        setSubmitted(data.session?.status === 'submitted')
        setServiceMeta({
          serviceDate: data.session?.serviceDate ?? '2026-08-02',
          serviceType: data.session?.serviceName ?? 'Sunday Service 1',
          records: data.records ?? [],
        })
        setMemberIds((data.records ?? []).map((r) => r.memberId))
        setStatuses(Object.fromEntries((data.records ?? []).map((r) => [r.memberId, r.status])))
        if (data.records?.length) {
          setSavedTable(
            data.records.map((r) => ({
              id: r.memberId,
              name: r.name,
              phone: r.phone || '—',
              status: r.status,
            })),
          )
        }
      })
      .catch((err) => showToast(err.message ?? 'Could not open attendance session'))
  }, [defaultServiceId])

  const sessionMembers = useMemo(() => {
    const ids = new Set(memberIds)
    return roster.filter((m) => ids.has(m.id))
  }, [memberIds, roster])

  const setStatus = (id, status) => {
    setStatuses((s) => ({ ...s, [id]: status }))
  }

  const bulletinRows = sessionMembers.map((m) => ({
    name: m.name,
    status: statuses[m.id],
  }))

  const applyApiRecords = (records) => {
    if (!Array.isArray(records) || !records.length) {
      setSavedTable(buildSnapshotRows(sessionMembers, statuses))
      return
    }
    setSavedTable(
      records.map((r) => ({
        id: r.memberId,
        name: r.name,
        phone: r.phone || '—',
        status: r.status,
      })),
    )
    setStatuses(Object.fromEntries(records.map((r) => [r.memberId, r.status])))
  }

  const persistRecords = async () => {
    if (USE_API && sessionId) {
      const records = Object.entries(statuses).map(([memberId, status]) => ({ memberId, status }))
      const res = await saveAttendanceRecords(sessionId, records)
      applyApiRecords(res.records)
      return res
    }
    setSavedTable(buildSnapshotRows(sessionMembers, statuses))
    return { wasSubmitted: submitted }
  }

  const saveDraft = async () => {
    setSaving(true)
    try {
      await persistRecords()
      showToast(submitted ? 'Attendance updated' : 'Attendance saved — review the table below')
    } catch (err) {
      showToast(err.message ?? 'Could not save attendance')
    } finally {
      setSaving(false)
    }
  }

  const updateAttendance = async () => {
    setSaving(true)
    try {
      const res = await persistRecords()
      if (res?.wasSubmitted || submitted) {
        showToast('Attendance updated — Coordinator, President, Vice President, and Secretary notified')
      } else {
        showToast('Attendance updated (draft)')
      }
    } catch (err) {
      showToast(err.message ?? 'Could not update attendance')
    } finally {
      setSaving(false)
    }
  }

  const submitSession = async () => {
    if (submitted) {
      await updateAttendance()
      return
    }
    setSaving(true)
    try {
      if (USE_API && sessionId) {
        await persistRecords()
        const res = await submitAttendanceSession(sessionId)
        applyApiRecords(res.records)
        setSessionStatus(res.session?.status ?? 'submitted')
      } else {
        setSavedTable(buildSnapshotRows(sessionMembers, statuses))
      }
      setSubmitted(true)
      showToast('Attendance submitted to Coordinator, President, Vice President, and Secretary')
    } catch (err) {
      showToast(err.message ?? 'Could not submit attendance')
    } finally {
      setSaving(false)
    }
  }

  const serviceInfo = (
    <div className="pmss-card p-5 mb-6">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Service information</h2>
      <div className="grid sm:grid-cols-2 gap-4 mt-3">
        <div>
          <p className="text-xs text-neutral-500">Service date</p>
          <input
            type="date"
            value={serviceMeta.serviceDate}
            onChange={(e) => setServiceMeta((m) => ({ ...m, serviceDate: e.target.value }))}
            className="pmss-input mt-1"
            disabled={USE_API}
          />
        </div>
        <div>
          <p className="text-xs text-neutral-500">Service type</p>
          <select
            className="pmss-input mt-1"
            value={serviceMeta.serviceType}
            onChange={(e) => setServiceMeta((m) => ({ ...m, serviceType: e.target.value }))}
            disabled={USE_API}
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto pb-24 md:pb-8">
      <Link
        to="/attendance"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 mb-4 pmss-no-print"
      >
        <ArrowLeft className="w-4 h-4" /> Attendance dashboard
      </Link>

      <PageHeader
        title="Record attendance"
        description={`${serviceMeta.serviceType} — ${serviceMeta.serviceDate}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 pmss-no-print">
            <Badge variant={submitted ? 'success' : sessionStatus === 'draft' ? 'warning' : 'neutral'}>
              {submitted ? 'Submitted' : 'Draft'}
            </Badge>
            <DisplayFormatToggle format={format} onChange={setFormat} />
          </div>
        }
      />

      {format === 'bulletin' ? (
        <AttendanceSessionBulletin
          id="attendance-session-bulletin"
          serviceType={serviceMeta.serviceType}
          serviceDate={serviceMeta.serviceDate}
          rows={bulletinRows}
          canEdit
        />
      ) : format === 'list' ? (
        <>
          {serviceInfo}
          <AttendanceSessionList
            members={sessionMembers}
            statuses={statuses}
            onStatusChange={setStatus}
          />
        </>
      ) : (
        <>
          {serviceInfo}
          <div className="pmss-card overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-sm">
              Service team — attendance
            </div>
            <ul className="divide-y divide-neutral-100">
              {sessionMembers.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <p className="text-sm font-medium mb-2">{m.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatus(m.id, st)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                          statuses[m.id] === st
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {savedTable && (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div>
              <h2 className="font-semibold text-neutral-900">
                {submitted ? 'Submitted attendance' : 'Recorded attendance'}
              </h2>
              <p className="text-sm text-neutral-500 mt-0.5">
                {serviceMeta.serviceType} · {serviceMeta.serviceDate} · {savedTable.length} members
              </p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: 'name', label: 'Member', render: (r) => <span className="font-medium text-neutral-900">{r.name}</span> },
              { key: 'phone', label: 'Contact' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <Badge variant={attendanceStatusBadgeVariant(r.status)}>{r.status}</Badge>,
              },
            ]}
            rows={savedTable}
            emptyTitle="No records"
          />
          {submitted ? (
            <p className="text-xs text-neutral-500 mt-3">
              Submitted. Change any marks and use Update attendance to revise the roll — leaders are notified again.
            </p>
          ) : (
            <p className="text-xs text-neutral-500 mt-3">
              Draft saved. Submit sends it for review, or use Update attendance anytime to refresh the saved marks.
            </p>
          )}
        </div>
      )}

      <div className="fixed md:static bottom-16 md:bottom-auto inset-x-0 md:mt-6 p-4 md:p-0 bg-white md:bg-transparent border-t md:border-0 border-neutral-200 flex flex-wrap gap-3 pmss-no-print">
        <button
          type="button"
          className="pmss-btn-secondary flex-1 md:flex-none"
          onClick={saveDraft}
          disabled={saving || submitted}
        >
          <Save className="w-4 h-4" /> Save
        </button>
        <button
          type="button"
          className="pmss-btn-secondary flex-1 md:flex-none"
          onClick={updateAttendance}
          disabled={saving}
        >
          <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} /> Update attendance
        </button>
        <button
          type="button"
          className="pmss-btn-primary flex-1 md:flex-none"
          onClick={submitSession}
          disabled={saving || submitted}
        >
          <Send className="w-4 h-4" /> Submit attendance
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-28 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
