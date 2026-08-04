import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader, StatCard, DataTable, Badge } from '../layouts/AppShell'
import DisplayFormatToggle from '../components/DisplayFormatToggle'
import AttendanceBulletin from '../components/bulletin/AttendanceBulletin'
import AttendanceDashboardList from '../components/list/AttendanceDashboardList'
import MemberAttendanceHistorySection from '../components/attendance/MemberAttendanceHistorySection'
import { useDisplayFormat } from '../hooks/useDisplayFormat'
import { useRole } from '../context/RoleContext'
import { ATTENDANCE_MONTHLY, RECENT_ATTENDANCE } from '../data/mock'
import { USE_API } from '../api/config'
import { fetchMyAttendanceHistory } from '../api/schedule'
import { canRecordAttendance, getMemberAttendanceHistory } from '../data/memberAttendance'

const total =
  ATTENDANCE_MONTHLY.present +
  ATTENDANCE_MONTHLY.halfPresent +
  ATTENDANCE_MONTHLY.quarterPresent +
  ATTENDANCE_MONTHLY.absent

const pctLabel = (n) => `${Math.round((n / total) * 100)}%`
const p1 = (ATTENDANCE_MONTHLY.present / total) * 100
const p2 = p1 + (ATTENDANCE_MONTHLY.halfPresent / total) * 100
const p3 = p2 + (ATTENDANCE_MONTHLY.quarterPresent / total) * 100

export default function AttendanceDashboardPage() {
  const { permissions, roleId, member } = useRole()
  const [format, setFormat] = useDisplayFormat('pmss-view-attendance', 'cards')
  const showRecordButton = canRecordAttendance(roleId, permissions)

  const [apiHistory, setApiHistory] = useState(null)

  useEffect(() => {
    if (!USE_API || roleId !== 'member' || !member) return
    fetchMyAttendanceHistory()
      .then((d) => setApiHistory(d.history ?? []))
      .catch(() => setApiHistory([]))
  }, [roleId, member?.id])

  const personalHistory = useMemo(() => {
    if (roleId !== 'member' || !member) return []
    if (USE_API && apiHistory != null) return apiHistory
    return getMemberAttendanceHistory(member.id)
  }, [roleId, member, apiHistory])

  const attendanceStats = [
    { label: 'Attendance rate', value: ATTENDANCE_MONTHLY.rate },
    { label: 'Present', value: String(ATTENDANCE_MONTHLY.present) },
    { label: 'Half present', value: String(ATTENDANCE_MONTHLY.halfPresent) },
    { label: 'Quarter present', value: String(ATTENDANCE_MONTHLY.quarterPresent) },
    { label: 'Absent', value: String(ATTENDANCE_MONTHLY.absent) },
  ]

  const personalHistorySection =
    roleId === 'member' && member ? (
      <MemberAttendanceHistorySection member={member} history={personalHistory} format={format} />
    ) : null

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Attendance"
        description="August 2026 — participation across services"
        actions={
          <div className="flex flex-wrap items-center gap-3 pmss-no-print">
            <DisplayFormatToggle
              format={format}
              onChange={setFormat}
              bulletinId="attendance-bulletin"
              bulletinTitle="Attendance bulletin"
            />
            {showRecordButton ? (
              <Link to="/attendance/record" className="pmss-btn-primary">
                <Plus className="w-4 h-4" /> Record attendance
              </Link>
            ) : null}
          </div>
        }
      />

      {format === 'bulletin' ? (
        <AttendanceBulletin
          id="attendance-bulletin"
          monthly={ATTENDANCE_MONTHLY}
          recentRows={RECENT_ATTENDANCE}
          showSessionDetail
          personalHistory={personalHistory}
          member={roleId === 'member' ? member : null}
        />
      ) : format === 'list' ? (
        <>
          <AttendanceDashboardList monthly={ATTENDANCE_MONTHLY} recentRows={RECENT_ATTENDANCE} />
          {personalHistorySection}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {attendanceStats.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} />
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div className="pmss-card p-5">
              <h2 className="font-semibold text-sm mb-4">Monthly attendance trend</h2>
              <div className="h-40 flex items-end gap-2 px-2">
                {[72, 78, 85, 82, 87, 89].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-primary-100 rounded-t-md relative" style={{ height: `${h}%` }}>
                      <div className="absolute inset-x-0 bottom-0 bg-primary-600 rounded-t-md" style={{ height: '100%' }} />
                    </div>
                    <span className="text-[10px] text-neutral-400">{['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pmss-card p-5">
              <h2 className="font-semibold text-sm mb-4">Participation distribution</h2>
              <div className="flex items-center gap-6">
                <div
                  className="w-32 h-32 rounded-full shrink-0"
                  style={{
                    background: `conic-gradient(#10B981 0 ${p1}%, #F59E0B ${p1}% ${p2}%, #3B82F6 ${p2}% ${p3}%, #EF4444 ${p3}% 100%)`,
                  }}
                />
                <ul className="text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present {pctLabel(ATTENDANCE_MONTHLY.present)}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Half {pctLabel(ATTENDANCE_MONTHLY.halfPresent)}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary-500" /> Quarter {pctLabel(ATTENDANCE_MONTHLY.quarterPresent)}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Absent {pctLabel(ATTENDANCE_MONTHLY.absent)}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <DataTable
            columns={[
              { key: 'service', label: 'Service' },
              { key: 'date', label: 'Date' },
              { key: 'rate', label: 'Rate' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <Badge variant="success">{r.status}</Badge>,
              },
            ]}
            rows={RECENT_ATTENDANCE}
          />

          {personalHistorySection}
        </>
      )}
    </div>
  )
}
