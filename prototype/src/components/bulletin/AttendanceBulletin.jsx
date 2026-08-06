import { useEffect, useState } from 'react'
import { BulletinDocument, BulletinSection } from '../DisplayFormatToggle'
import BulletinEditable from './BulletinEditable'
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
  canEdit = false,
}) {
  const sessionMembers = ATTENDANCE_SESSION_DEMO.records.map((r) => {
    const m = MEMBERS.find((x) => x.id === r.memberId)
    return { name: m?.name ?? 'Unknown', status: r.status }
  })

  const [stats, setStats] = useState({
    rate: monthly?.rate ?? '—',
    present: String(monthly?.present ?? ''),
    halfPresent: String(monthly?.halfPresent ?? ''),
    quarterPresent: String(monthly?.quarterPresent ?? ''),
    absent: String(monthly?.absent ?? ''),
  })
  const [rows, setRows] = useState(
    (recentRows ?? []).map((r) => ({
      id: r.id,
      service: r.service,
      date: r.date,
      rate: r.rate,
      status: r.status,
    })),
  )
  const [rollTitle] = useState(
    `Service roll — ${ATTENDANCE_SESSION_DEMO.serviceType} · 02 Aug 2026`,
  )
  const [rollRows, setRollRows] = useState(sessionMembers)
  const [labels, setLabels] = useState({
    rate: 'Rate',
    present: 'Present',
    halfPresent: 'Half present',
    quarterPresent: 'Quarter present',
    absent: 'Absent',
  })
  const [colHeaders, setColHeaders] = useState({
    service: 'Service',
    date: 'Date',
    rate: 'Rate',
    status: 'Status',
    member: 'Member',
    mark: 'Mark',
  })

  useEffect(() => {
    setStats({
      rate: monthly?.rate ?? '—',
      present: String(monthly?.present ?? ''),
      halfPresent: String(monthly?.halfPresent ?? ''),
      quarterPresent: String(monthly?.quarterPresent ?? ''),
      absent: String(monthly?.absent ?? ''),
    })
  }, [monthly])

  useEffect(() => {
    setRows(
      (recentRows ?? []).map((r) => ({
        id: r.id,
        service: r.service,
        date: r.date,
        rate: r.rate,
        status: r.status,
      })),
    )
  }, [recentRows])

  const patchStat = (key, value) => setStats((s) => ({ ...s, [key]: value }))
  const patchRow = (id, key, value) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, [key]: value } : r)))
  const patchRoll = (index, key, value) =>
    setRollRows((list) => list.map((r, i) => (i === index ? { ...r, [key]: value } : r)))

  return (
    <BulletinDocument
      id={id}
      title="Protocol Attendance Summary"
      subtitle={monthLabel}
      footer="P = Present · ½ = Half · ¼ = Quarter · A = Absent"
      canEdit={canEdit}
    >
      <BulletinSection title="Monthly overview" canEdit={canEdit}>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm max-w-lg">
          {[
            ['rate', 'rate'],
            ['present', 'present'],
            ['halfPresent', 'halfPresent'],
            ['quarterPresent', 'quarterPresent'],
            ['absent', 'absent'],
          ].map(([labelKey, valueKey]) => (
            <div key={valueKey}>
              <dt className="text-neutral-500">
                <BulletinEditable
                  value={labels[labelKey]}
                  onChange={canEdit ? (v) => setLabels((l) => ({ ...l, [labelKey]: v })) : undefined}
                  disabled={!canEdit}
                />
              </dt>
              <dd className="font-semibold">
                <BulletinEditable
                  value={stats[valueKey]}
                  onChange={canEdit ? (v) => patchStat(valueKey, v) : undefined}
                  disabled={!canEdit}
                />
              </dd>
            </div>
          ))}
        </dl>
      </BulletinSection>

      <BulletinSection title="Recent services" canEdit={canEdit}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-400">
              {['service', 'date', 'rate', 'status'].map((key) => (
                <th key={key} className="text-left py-1 pr-4 font-semibold">
                  <BulletinEditable
                    value={colHeaders[key]}
                    onChange={canEdit ? (v) => setColHeaders((h) => ({ ...h, [key]: v })) : undefined}
                    disabled={!canEdit}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-200">
                {['service', 'date', 'rate', 'status'].map((key) => (
                  <td key={key} className="py-1.5 pr-4">
                    <BulletinEditable
                      value={String(row[key] ?? '')}
                      onChange={canEdit ? (v) => patchRow(row.id, key, v) : undefined}
                      disabled={!canEdit}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </BulletinSection>

      {showSessionDetail && (
        <BulletinSection title={rollTitle} canEdit={canEdit}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-400">
                <th className="text-left py-1 font-semibold w-8">#</th>
                <th className="text-left py-1 font-semibold">
                  <BulletinEditable
                    value={colHeaders.member}
                    onChange={canEdit ? (v) => setColHeaders((h) => ({ ...h, member: v })) : undefined}
                    disabled={!canEdit}
                  />
                </th>
                <th className="text-left py-1 font-semibold w-16">
                  <BulletinEditable
                    value={colHeaders.mark}
                    onChange={canEdit ? (v) => setColHeaders((h) => ({ ...h, mark: v })) : undefined}
                    disabled={!canEdit}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {rollRows.map((row, i) => (
                <tr key={`${row.name}-${i}`} className="border-b border-neutral-200">
                  <td className="py-1">{i + 1}</td>
                  <td className="py-1">
                    <BulletinEditable
                      value={row.name}
                      onChange={canEdit ? (v) => patchRoll(i, 'name', v) : undefined}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-1 font-mono font-bold">
                    <BulletinEditable
                      value={STATUS_LABEL[row.status] ?? row.status}
                      onChange={canEdit ? (v) => patchRoll(i, 'status', v) : undefined}
                      disabled={!canEdit}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </BulletinSection>
      )}
      <MemberAttendanceHistoryBulletinSection
        member={member}
        history={personalHistory ?? []}
        canEdit={canEdit}
      />
    </BulletinDocument>
  )
}
