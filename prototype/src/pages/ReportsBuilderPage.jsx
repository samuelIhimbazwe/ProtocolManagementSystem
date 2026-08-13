import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../layouts/AppShell'
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
import {
  MINISTRY_REPORT_BLOCKS,
  MINISTRY_REPORT_PRESETS,
  defaultIncludeMap,
  slugifyTitle,
} from '../lib/reportBuilder'
import ReportBuilder from '../components/ReportBuilder'
import { emptySignatories } from '../lib/reportDocument'

export default function ReportsBuilderPage() {
  const { payload } = useSchedule()
  const { members } = useMembers()
  const [service, setService] = useState('All services')
  const [start, setStart] = useState('2026-08-01')
  const [end, setEnd] = useState('2026-08-31')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [builderTitle, setBuilderTitle] = useState('Ministry Report')
  const [builderSubtitle, setBuilderSubtitle] = useState('')
  const [builderSignatories, setBuilderSignatories] = useState(emptySignatories)
  const [builderInclude, setBuilderInclude] = useState(() => defaultIncludeMap(MINISTRY_REPORT_BLOCKS))

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

  useEffect(() => {
    const month = report?.overview?.monthLabel
    if (month) setBuilderTitle(`${month} Ministry Report`)
  }, [report?.overview?.monthLabel])

  const exportOptions = () => ({
    title: builderTitle.trim() || 'Ministry Report',
    subtitle: builderSubtitle.trim(),
    include: builderInclude,
    signatories: builderSignatories,
  })

  const exportReport = async (format) => {
    if (!report) {
      showToast('Report not loaded yet')
      return
    }
    try {
      const opts = exportOptions()
      const stamp = slugifyTitle(opts.title || report.overview?.monthLabel || 'report')
      if (format === 'csv') {
        downloadReportsCsv(report, `pmss-ministry-report-${stamp}.csv`, opts)
        showToast('Report downloaded (CSV)')
      } else if (format === 'excel') {
        downloadReportsExcel(report, `pmss-ministry-report-${stamp}.xls`, opts)
        showToast('Report downloaded (Excel)')
      } else if (format === 'pdf') {
        const result = await downloadReportsPdf(report, opts)
        showToast(`Downloaded ${result?.fileName ?? 'report.pdf'}`)
      }
    } catch (err) {
      showToast(err.message ?? 'Export failed')
    }
  }

  const monthLabel = report?.overview?.monthLabel

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Build reports"
        description="Build a full ministry pack or a focused export — cover, attendance, scheduling, roster, and activity."
        actions={
          <Link to="/reports" className="text-sm font-medium text-primary-700">
            ← Back to Reports
          </Link>
        }
      />

      <div className="pmss-card p-4 mb-6 flex flex-col lg:flex-row flex-wrap gap-3">
        <select
          className="pmss-input w-full lg:w-44"
          value={monthLabel ?? 'August 2026'}
          onChange={() => showToast('Only the current schedule month is available in this pilot')}
          aria-label="Report month"
        >
          <option>{monthLabel ?? 'August 2026'}</option>
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
      </div>

      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-card px-4 py-2 mb-4">
          {error} — showing best available data.
        </p>
      )}

      <ReportBuilder
        title={builderTitle}
        onTitleChange={setBuilderTitle}
        subtitle={builderSubtitle}
        onSubtitleChange={setBuilderSubtitle}
        signatories={builderSignatories}
        onSignatoriesChange={setBuilderSignatories}
        blocks={MINISTRY_REPORT_BLOCKS}
        include={builderInclude}
        onIncludeChange={setBuilderInclude}
        presets={MINISTRY_REPORT_PRESETS}
        onExport={exportReport}
        disabled={!report || loading}
        showHeader={false}
        hint="Build a full ministry pack or a focused export — cover, attendance, scheduling, roster, and activity."
      />

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
