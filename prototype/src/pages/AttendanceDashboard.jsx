import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader, StatCard, DataTable, Badge } from '../layouts/AppShell'
import Modal from '../components/Modal'
import DisplayFormatToggle from '../components/DisplayFormatToggle'
import ScheduleDownloadMenu from '../components/ScheduleDownloadMenu'
import AttendanceBulletin from '../components/bulletin/AttendanceBulletin'
import AttendanceDashboardList from '../components/list/AttendanceDashboardList'
import MemberAttendanceHistorySection from '../components/attendance/MemberAttendanceHistorySection'
import { useDisplayFormat } from '../hooks/useDisplayFormat'
import { useRole } from '../context/RoleContext'
import { ATTENDANCE_MONTHLY, RECENT_ATTENDANCE } from '../data/mock'
import { USE_API } from '../api/config'
import {
  fetchAttendanceOverview,
  fetchAttendanceSessionDetail,
  fetchMyAttendanceHistory,
} from '../api/schedule'
import { canRecordAttendance, getMemberAttendanceHistory, attendanceStatusBadgeVariant } from '../data/memberAttendance'
import { downloadBulletinPdf } from '../lib/bulletinPdf'
import { downloadBlob } from '../lib/choirScheduleExport'

const LEADER_ROLES = new Set(['president', 'vice_president', 'secretary', 'treasurer', 'coordinator'])

function emptyMonthly() {
  return { rate: '—', present: 0, halfPresent: 0, quarterPresent: 0, absent: 0, total: 0 }
}

export default function AttendanceDashboardPage() {
  const { permissions, roleId, member } = useRole()
  const [format, setFormat] = useDisplayFormat('pmss-view-attendance', 'cards')
  const showRecordButton = canRecordAttendance(roleId, permissions)
  const isLeader = LEADER_ROLES.has(roleId)

  const [monthly, setMonthly] = useState(USE_API ? emptyMonthly() : ATTENDANCE_MONTHLY)
  const [serviceRows, setServiceRows] = useState(USE_API ? [] : RECENT_ATTENDANCE)
  const [historyRows, setHistoryRows] = useState([])
  const [personalHistory, setPersonalHistory] = useState([])
  const [loading, setLoading] = useState(USE_API)
  const [toast, setToast] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailMeta, setDetailMeta] = useState(null)
  const [detailRecords, setDetailRecords] = useState([])
  const [detailSummary, setDetailSummary] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const loadOverview = useCallback(() => {
    if (!USE_API) {
      if (roleId === 'member' && member) {
        setPersonalHistory(getMemberAttendanceHistory(member.id))
      }
      setLoading(false)
      return
    }
    setLoading(true)
    const month = '2026-08'
    Promise.all([
      fetchAttendanceOverview(month),
      roleId === 'member' ? fetchMyAttendanceHistory().catch(() => ({ history: [] })) : Promise.resolve(null),
    ])
      .then(([overview, meHist]) => {
        setMonthly(overview.monthly ?? emptyMonthly())
        const services = (overview.services ?? []).map((s) => ({
          id: s.id,
          serviceId: s.serviceId,
          service: s.service,
          date: s.date,
          rate: s.rate,
          status: s.status,
        }))
        setServiceRows(services)
        setHistoryRows(
          (overview.history ?? []).map((s) => ({
            id: s.id,
            serviceId: s.serviceId,
            service: s.service,
            date: s.date,
            rate: s.rate,
            status: s.status,
          })),
        )
        if (roleId === 'member') {
          setPersonalHistory(meHist?.history ?? overview.personalHistory ?? [])
        } else {
          setPersonalHistory(overview.personalHistory ?? [])
        }
      })
      .catch(() => {
        setMonthly(emptyMonthly())
        setServiceRows([])
        setHistoryRows([])
        setPersonalHistory([])
        showToast('Could not load attendance overview')
      })
      .finally(() => setLoading(false))
  }, [roleId, member?.id])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    const onFocus = () => loadOverview()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadOverview])

  const openServiceDetail = async (row) => {
    if (!row?.id && !row?.serviceId) {
      showToast('No attendance session for this service')
      return
    }
    setDetailOpen(true)
    setDetailMeta(row)
    setDetailRecords([])
    setDetailSummary(null)
    if (!USE_API) {
      setDetailRecords([
        { name: 'Demo Member', phone: '+250 780000000', status: 'Present' },
        { name: 'Demo Absent', phone: '+250 780000001', status: 'Absent' },
      ])
      setDetailSummary({ rate: row.rate, total: 2, present: 1, absent: 1, halfPresent: 0, quarterPresent: 0 })
      return
    }
    setDetailLoading(true)
    try {
      const data = await fetchAttendanceSessionDetail(row.id || row.serviceId)
      if (!data.session) {
        showToast('Attendance detail not found')
        setDetailOpen(false)
        return
      }
      setDetailMeta({
        ...row,
        service: data.session.serviceName ?? row.service,
        date: data.session.serviceDate ?? row.date,
        status: data.session.status === 'submitted' ? 'Submitted' : 'Draft',
      })
      setDetailRecords(data.records ?? [])
      setDetailSummary(data.summary ?? null)
    } catch (err) {
      showToast(err.message ?? 'Could not load service attendance')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const total = Math.max(1, monthly.total || 0)
  const pctLabel = (n) => `${Math.round((n / total) * 100)}%`
  const p1 = ((monthly.present || 0) / total) * 100
  const p2 = p1 + ((monthly.halfPresent || 0) / total) * 100
  const p3 = p2 + ((monthly.quarterPresent || 0) / total) * 100

  const exportAttendance = async (formatId) => {
    try {
      if (formatId === 'pdf') {
        if (!document.getElementById('attendance-bulletin')) {
          setFormat('bulletin')
          await new Promise((r) => setTimeout(r, 50))
        }
        const result = await downloadBulletinPdf('attendance-bulletin', {
          title: 'Attendance bulletin',
          fileName: 'pmss-attendance-bulletin.pdf',
        })
        showToast(`Downloaded ${result?.fileName ?? 'attendance.pdf'}`)
        return
      }
      const rows = serviceRows.map((r) => [r.service, r.date, r.rate, r.status])
      if (formatId === 'csv') {
        const lines = [
          'Service,Date,Rate,Status',
          ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
        ]
        downloadBlob(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'pmss-attendance.csv')
        showToast('Attendance downloaded (CSV)')
      } else if (formatId === 'excel') {
        const table = rows.map((r) => `<tr>${r.map((c) => `<td>${String(c)}</td>`).join('')}</tr>`).join('')
        const html = `<table><thead><tr><th>Service</th><th>Date</th><th>Rate</th><th>Status</th></tr></thead><tbody>${table}</tbody></table>`
        downloadBlob(
          new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8' }),
          'pmss-attendance.xls',
        )
        showToast('Attendance downloaded (Excel)')
      }
    } catch (err) {
      showToast(err.message ?? 'Download failed')
    }
  }

  const attendanceStats = [
    { label: 'Attendance rate', value: monthly.rate ?? '—' },
    { label: 'Present', value: String(monthly.present ?? 0) },
    { label: 'Half present', value: String(monthly.halfPresent ?? 0) },
    { label: 'Quarter present', value: String(monthly.quarterPresent ?? 0) },
    { label: 'Absent', value: String(monthly.absent ?? 0) },
  ]

  const bulletinMonthly = useMemo(
    () => ({
      rate: monthly.rate,
      present: monthly.present,
      halfPresent: monthly.halfPresent,
      quarterPresent: monthly.quarterPresent,
      absent: monthly.absent,
    }),
    [monthly],
  )

  const personalHistorySection =
    roleId === 'member' && member ? (
      <MemberAttendanceHistorySection member={member} history={personalHistory} format={format} />
    ) : null

  const serviceColumns = [
    { key: 'service', label: 'Service' },
    { key: 'date', label: 'Date' },
    { key: 'rate', label: 'Rate' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <Badge variant={r.status === 'Submitted' ? 'success' : 'warning'}>{r.status}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <button
          type="button"
          className="text-sm font-medium text-primary-700 hover:text-primary-800"
          onClick={() => openServiceDetail(r)}
        >
          View service
        </button>
      ),
    },
  ]

  const detailColumns = [
    { key: 'name', label: 'Member' },
    {
      key: 'phone',
      label: 'Contact',
      render: (r) => r.phone || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge variant={attendanceStatusBadgeVariant(r.status)}>{r.status}</Badge>,
    },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Attendance"
        description="August 2026 — participation across services"
        actions={
          <div className="flex flex-wrap items-center gap-3 pmss-no-print">
            <DisplayFormatToggle format={format} onChange={setFormat} />
            <ScheduleDownloadMenu label="Download" onExport={exportAttendance} />
            <button type="button" className="pmss-btn-secondary text-sm h-9" onClick={loadOverview}>
              Refresh
            </button>
            {showRecordButton ? (
              <Link to="/attendance/record" className="pmss-btn-primary">
                <Plus className="w-4 h-4" /> Record attendance
              </Link>
            ) : null}
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-neutral-500 pmss-card p-6">Loading attendance…</p>
      ) : (
        <>
          {format !== 'bulletin' && (
            <div className="pmss-offscreen-export" aria-hidden="true">
              <AttendanceBulletin
                id="attendance-bulletin"
                monthly={bulletinMonthly}
                recentRows={serviceRows}
                showSessionDetail={false}
                personalHistory={personalHistory}
                member={roleId === 'member' ? member : null}
              />
            </div>
          )}

          {format === 'bulletin' ? (
            <AttendanceBulletin
              id="attendance-bulletin"
              monthly={bulletinMonthly}
              recentRows={serviceRows}
              showSessionDetail={false}
              personalHistory={personalHistory}
              member={roleId === 'member' ? member : null}
            />
          ) : format === 'list' ? (
            <>
              <AttendanceDashboardList
                monthly={bulletinMonthly}
                recentRows={serviceRows}
                onViewService={openServiceDetail}
              />
              {personalHistorySection}
              {isLeader && historyRows.length > 0 && (
                <div className="mt-8">
                  <h2 className="font-semibold text-neutral-900 mb-3">Submitted attendance history</h2>
                  <DataTable columns={serviceColumns} rows={historyRows} emptyTitle="No submitted sessions" />
                </div>
              )}
            </>
          ) : (
            <>
              {(isLeader || roleId === 'member') && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  {attendanceStats.map((s) => (
                    <StatCard key={s.label} label={s.label} value={s.value} />
                  ))}
                </div>
              )}

              {isLeader && monthly.total > 0 && (
                <div className="grid lg:grid-cols-2 gap-6 mb-6">
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
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present{' '}
                          {pctLabel(monthly.present || 0)}
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" /> Half{' '}
                          {pctLabel(monthly.halfPresent || 0)}
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary-500" /> Quarter{' '}
                          {pctLabel(monthly.quarterPresent || 0)}
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" /> Absent{' '}
                          {pctLabel(monthly.absent || 0)}
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="pmss-card p-5">
                    <h2 className="font-semibold text-sm mb-2">This month</h2>
                    <p className="text-sm text-neutral-600">
                      {monthly.total} marks across submitted services. Draft sessions appear in the service list until
                      submitted.
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-8">
                <h2 className="font-semibold text-neutral-900 mb-3">
                  {isLeader ? 'Service attendance' : 'Services this month'}
                </h2>
                <DataTable
                  columns={serviceColumns}
                  rows={serviceRows}
                  emptyTitle="No attendance sessions yet"
                  emptyDescription="Record and submit attendance to populate this list."
                />
              </div>

              {isLeader && (
                <div className="mb-8">
                  <h2 className="font-semibold text-neutral-900 mb-3">Attendance history</h2>
                  <DataTable
                    columns={serviceColumns}
                    rows={historyRows}
                    emptyTitle="No submitted history yet"
                  />
                </div>
              )}

              {personalHistorySection}

              {isLeader && personalHistory.length > 0 && member && (
                <div className="mt-8">
                  <h2 className="font-semibold text-neutral-900 mb-3">Your personal marks</h2>
                  <DataTable
                    columns={[
                      { key: 'date', label: 'Date' },
                      { key: 'service', label: 'Service' },
                      {
                        key: 'status',
                        label: 'Status',
                        render: (r) => (
                          <Badge variant={attendanceStatusBadgeVariant(r.status)}>{r.status}</Badge>
                        ),
                      },
                    ]}
                    rows={personalHistory}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailMeta?.service ?? 'Service attendance'}
        description={
          detailMeta
            ? `${detailMeta.date}${detailMeta.status ? ` · ${detailMeta.status}` : ''}${
                detailSummary?.rate ? ` · ${detailSummary.rate}` : detailMeta.rate ? ` · ${detailMeta.rate}` : ''
              }`
            : undefined
        }
        wide
        footer={
          <button type="button" className="pmss-btn-secondary" onClick={() => setDetailOpen(false)}>
            Close
          </button>
        }
      >
        {detailLoading ? (
          <p className="text-sm text-neutral-500">Loading full attendance…</p>
        ) : (
          <div className="space-y-4">
            {detailSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="rounded-lg border border-neutral-200 px-3 py-2">
                  <p className="text-xs text-neutral-500">Present</p>
                  <p className="font-semibold">{detailSummary.present ?? 0}</p>
                </div>
                <div className="rounded-lg border border-neutral-200 px-3 py-2">
                  <p className="text-xs text-neutral-500">Half</p>
                  <p className="font-semibold">{detailSummary.halfPresent ?? 0}</p>
                </div>
                <div className="rounded-lg border border-neutral-200 px-3 py-2">
                  <p className="text-xs text-neutral-500">Quarter</p>
                  <p className="font-semibold">{detailSummary.quarterPresent ?? 0}</p>
                </div>
                <div className="rounded-lg border border-neutral-200 px-3 py-2">
                  <p className="text-xs text-neutral-500">Absent</p>
                  <p className="font-semibold">{detailSummary.absent ?? 0}</p>
                </div>
              </div>
            )}
            <DataTable
              columns={detailColumns}
              rows={detailRecords}
              emptyTitle="No attendance marks"
              emptyDescription="This service session has no recorded members yet."
            />
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
