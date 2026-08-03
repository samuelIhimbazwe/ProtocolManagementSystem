import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Send } from 'lucide-react'
import { PageHeader } from '../layouts/AppShell'
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

const STATUSES = ['Present', 'Half Present', 'Quarter Present', 'Absent']

const SERVICE_TYPES = [
  'Sunday Service 1',
  'Sunday Service 2',
  'Tuesday Service',
  'Friday Service',
  'Igaburo Service',
]

export default function AttendanceRecordPage() {
  const [format, setFormat] = useDisplayFormat('pmss-view-attendance-record', 'cards')
  const { services } = useSchedule()
  const { members } = useMembers()
  const roster = USE_API ? members : MEMBERS
  const defaultServiceId = USE_API ? (services[0]?.id ?? 's01') : null
  const [sessionId, setSessionId] = useState(null)
  const [serviceMeta, setServiceMeta] = useState(ATTENDANCE_SESSION_DEMO)
  const [memberIds, setMemberIds] = useState(() =>
    ATTENDANCE_SESSION_DEMO.records.map((r) => r.memberId),
  )

  useEffect(() => {
    if (!USE_API || !defaultServiceId) return
    startAttendanceSession(defaultServiceId)
      .then((data) => {
        setSessionId(data.session?.id ?? null)
        setServiceMeta({
          serviceDate: data.session?.serviceDate ?? '2026-08-02',
          serviceType: data.session?.serviceName ?? 'Sunday Service 1',
          records: data.records ?? [],
        })
        setMemberIds((data.records ?? []).map((r) => r.memberId))
        setStatuses(
          Object.fromEntries((data.records ?? []).map((r) => [r.memberId, r.status])),
        )
      })
      .catch(() => {})
  }, [defaultServiceId])

  const sessionMembers = useMemo(() => {
    const ids = new Set(memberIds)
    return roster.filter((m) => ids.has(m.id))
  }, [memberIds, roster])

  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(
      ATTENDANCE_SESSION_DEMO.records.map((r) => [r.memberId, r.status]),
    ),
  )

  const setStatus = (id, status) => setStatuses((s) => ({ ...s, [id]: status }))

  const bulletinRows = sessionMembers.map((m) => ({
    name: m.name,
    status: statuses[m.id],
  }))

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
          <div className="pmss-no-print">
            <DisplayFormatToggle format={format} onChange={setFormat} bulletinId="attendance-session-bulletin" />
          </div>
        }
      />

      {format === 'bulletin' ? (
        <AttendanceSessionBulletin
          id="attendance-session-bulletin"
          serviceType={ATTENDANCE_SESSION_DEMO.serviceType}
          serviceDate={ATTENDANCE_SESSION_DEMO.serviceDate}
          rows={bulletinRows}
        />
      ) : format === 'list' ? (
        <>
          <div className="pmss-card p-5 mb-6">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Service information</h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs text-neutral-500">Service date</p>
                <input type="date" defaultValue={ATTENDANCE_SESSION_DEMO.serviceDate} className="pmss-input mt-1" />
              </div>
              <div>
                <p className="text-xs text-neutral-500">Service type</p>
                <select className="pmss-input mt-1" defaultValue={ATTENDANCE_SESSION_DEMO.serviceType}>
                  {SERVICE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <AttendanceSessionList members={sessionMembers} statuses={statuses} onStatusChange={setStatus} />
        </>
      ) : (
        <>
          <div className="pmss-card p-5 mb-6">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Service information</h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs text-neutral-500">Service date</p>
                <input type="date" defaultValue={ATTENDANCE_SESSION_DEMO.serviceDate} className="pmss-input mt-1" />
              </div>
              <div>
                <p className="text-xs text-neutral-500">Service type</p>
                <select className="pmss-input mt-1" defaultValue={ATTENDANCE_SESSION_DEMO.serviceType}>
                  {SERVICE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pmss-card overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-sm">Service team — attendance</div>
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

      <div className="fixed md:static bottom-16 md:bottom-auto inset-x-0 md:mt-6 p-4 md:p-0 bg-white md:bg-transparent border-t md:border-0 border-neutral-200 flex gap-3 pmss-no-print">
        <button
          type="button"
          className="pmss-btn-secondary flex-1 md:flex-none"
          onClick={async () => {
            if (USE_API && sessionId) {
              const records = Object.entries(statuses).map(([memberId, status]) => ({ memberId, status }))
              await saveAttendanceRecords(sessionId, records)
            }
          }}
        >
          <Save className="w-4 h-4" /> Save
        </button>
        <button
          type="button"
          className="pmss-btn-primary flex-1 md:flex-none"
          onClick={async () => {
            if (USE_API && sessionId) {
              const records = Object.entries(statuses).map(([memberId, status]) => ({ memberId, status }))
              await saveAttendanceRecords(sessionId, records)
              await submitAttendanceSession(sessionId)
            }
          }}
        >
          <Send className="w-4 h-4" /> Submit attendance
        </button>
      </div>
    </div>
  )
}
