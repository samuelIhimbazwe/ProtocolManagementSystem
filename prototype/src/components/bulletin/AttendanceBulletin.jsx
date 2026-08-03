import { BulletinDocument, BulletinSection } from '../DisplayFormatToggle'
import { MemberAttendanceHistoryBulletinSection } from '../attendance/MemberAttendanceHistorySection'
import { MEMBERS, ATTENDANCE_SESSION_DEMO } from '../../data/mock'

const STATUS_LABEL = {
  Present: 'P',
  'Half Present': '½',
  'Quarter Present': '¼',
  Absent: 'A',
}

export default function AttendanceBulletin({
  id,
  monthLabel = 'August 2026',
  monthly,
  recentRows,
  showSessionDetail = true,
  personalHistory = null,
  member = null,
}) {
  const sessionMembers = ATTENDANCE_SESSION_DEMO.records.map((r) => {
    const m = MEMBERS.find((x) => x.id === r.memberId)
    return { name: m?.name ?? 'Unknown', status: r.status }
  })

  return (
    <BulletinDocument
      id={id}
      title="Protocol Attendance Summary"
      subtitle={monthLabel}
      footer="P = Present · ½ = Half · ¼ = Quarter · A = Absent"
    >
      <BulletinSection title="Monthly overview">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm max-w-lg">
          <div>
            <dt className="text-neutral-500">Rate</dt>
            <dd className="font-semibold">{monthly.rate}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Present</dt>
            <dd className="font-semibold">{monthly.present}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Half present</dt>
            <dd className="font-semibold">{monthly.halfPresent}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Quarter present</dt>
            <dd className="font-semibold">{monthly.quarterPresent}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Absent</dt>
            <dd className="font-semibold">{monthly.absent}</dd>
          </div>
        </dl>
      </BulletinSection>

      <BulletinSection title="Recent services">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-400">
              <th className="text-left py-1 pr-4 font-semibold">Service</th>
              <th className="text-left py-1 pr-4 font-semibold">Date</th>
              <th className="text-left py-1 pr-4 font-semibold">Rate</th>
              <th className="text-left py-1 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentRows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-200">
                <td className="py-1.5 pr-4">{row.service}</td>
                <td className="py-1.5 pr-4">{row.date}</td>
                <td className="py-1.5 pr-4">{row.rate}</td>
                <td className="py-1.5">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </BulletinSection>

      {showSessionDetail && (
        <BulletinSection title={`Service roll — ${ATTENDANCE_SESSION_DEMO.serviceType} · 02 Aug 2026`}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-400">
                <th className="text-left py-1 font-semibold w-8">#</th>
                <th className="text-left py-1 font-semibold">Member</th>
                <th className="text-left py-1 font-semibold w-16">Mark</th>
              </tr>
            </thead>
            <tbody>
              {sessionMembers.map((row, i) => (
                <tr key={row.name} className="border-b border-neutral-200">
                  <td className="py-1">{i + 1}</td>
                  <td className="py-1">{row.name}</td>
                  <td className="py-1 font-mono font-bold">{STATUS_LABEL[row.status] ?? row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BulletinSection>
      )}
      <MemberAttendanceHistoryBulletinSection member={member} history={personalHistory ?? []} />
    </BulletinDocument>
  )
}
