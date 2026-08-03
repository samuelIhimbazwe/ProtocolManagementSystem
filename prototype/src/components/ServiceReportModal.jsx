import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import Modal from './Modal'
import { Badge } from '../layouts/AppShell'
import {
  createServiceReport,
  fetchServiceReportForService,
  fetchSubmittedServiceReports,
  submitServiceReport,
  updateServiceReport,
} from '../api/serviceReports'

const EMPTY_FORM = {
  howItWent: '',
  issuesChallenges: '',
  solutions: '',
  recommendations: '',
}

function Field({ id, label, hint, value, onChange, readOnly, rows = 4 }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800 mb-1">
        {label}
      </label>
      {hint && <p className="text-xs text-neutral-500 mb-1.5">{hint}</p>}
      <textarea
        id={id}
        className="pmss-input min-h-[5.5rem] py-2"
        rows={rows}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={readOnly ? '' : 'Write here…'}
      />
    </div>
  )
}

export function ServiceReportModal({
  open,
  onClose,
  duty,
  onSaved,
  onToast,
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const readOnly = report?.status === 'submitted'

  useEffect(() => {
    if (!open || !duty?.serviceId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const data = await fetchServiceReportForService(duty.serviceId)
        let current = data.report ?? null
        if (!current) {
          const created = await createServiceReport({ serviceId: duty.serviceId })
          current = created.report
        }
        if (cancelled) return
        setReport(current)
        setForm({
          howItWent: current.howItWent ?? '',
          issuesChallenges: current.issuesChallenges ?? '',
          solutions: current.solutions ?? '',
          recommendations: current.recommendations ?? '',
        })
      } catch (err) {
        onToast?.(err.message ?? 'Could not open service report')
        onClose?.()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, duty?.serviceId])

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const saveDraft = async () => {
    if (!report || readOnly) return
    setSaving(true)
    try {
      const data = await updateServiceReport(report.id, form)
      setReport(data.report)
      onToast?.('Draft saved')
      onSaved?.(data.report)
    } catch (err) {
      onToast?.(err.message ?? 'Could not save draft')
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    if (!report || readOnly) return
    const missing = ['howItWent', 'issuesChallenges', 'solutions', 'recommendations'].filter(
      (k) => !String(form[k] ?? '').trim(),
    )
    if (missing.length) {
      onToast?.('Please complete all four sections before submitting')
      return
    }
    setSaving(true)
    try {
      const data = await submitServiceReport(report.id, form)
      setReport(data.report)
      onToast?.('Service report submitted')
      onSaved?.(data.report)
      onClose?.()
    } catch (err) {
      onToast?.(err.message ?? 'Could not submit report')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={readOnly ? 'Submitted service report' : 'Write service report'}
      description={
        duty
          ? `${duty.dutyRole === 'TL' ? 'Team Leader' : 'Vice Team Leader'} · ${duty.serviceName} · ${duty.dateLabel}`
          : undefined
      }
      footer={
        <>
          <button type="button" className="pmss-btn-secondary" onClick={onClose}>
            Close
          </button>
          {!readOnly && (
            <>
              <button
                type="button"
                className="pmss-btn-secondary"
                disabled={loading || saving || !report}
                onClick={saveDraft}
              >
                Save draft
              </button>
              <button
                type="button"
                className="pmss-btn-primary"
                disabled={loading || saving || !report}
                onClick={submit}
              >
                Submit report
              </button>
            </>
          )}
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-neutral-500 py-6">Loading report…</p>
      ) : (
        <div className="space-y-4">
          {report && (
            <div className="flex items-center gap-2">
              <Badge variant={readOnly ? 'success' : 'warning'}>
                {readOnly ? 'Submitted' : 'Draft'}
              </Badge>
              {report.submittedAt && (
                <span className="text-xs text-neutral-500">
                  Submitted {String(report.submittedAt).slice(0, 16).replace('T', ' ')}
                </span>
              )}
            </div>
          )}
          <Field
            id="how-it-went"
            label="How the service went"
            hint="Full report of the service: flow, participation, highlights."
            value={form.howItWent}
            onChange={setField('howItWent')}
            readOnly={readOnly}
            rows={5}
          />
          <Field
            id="issues-challenges"
            label="Issues and challenges faced"
            hint="What went wrong or was difficult for the team or the service."
            value={form.issuesChallenges}
            onChange={setField('issuesChallenges')}
            readOnly={readOnly}
          />
          <Field
            id="solutions"
            label="Solutions used"
            hint="What you and the team did to address those issues."
            value={form.solutions}
            onChange={setField('solutions')}
            readOnly={readOnly}
          />
          <Field
            id="recommendations"
            label="Future recommendations"
            hint="What leadership or the next team should improve next time."
            value={form.recommendations}
            onChange={setField('recommendations')}
            readOnly={readOnly}
          />
        </div>
      )}
    </Modal>
  )
}

export function SubmittedServiceReportsPanel({ onToast }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSubmittedServiceReports()
      .then((data) => {
        if (!cancelled) setReports(data.reports ?? [])
      })
      .catch((err) => onToast?.(err.message ?? 'Could not load service reports'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="pmss-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-primary-700" />
        <h2 className="font-semibold text-sm">TL / VTL service reports</h2>
      </div>
      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-neutral-500">No submitted service reports yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {reports.slice(0, 8).map((r) => (
            <li key={r.id} className="py-3 flex justify-between gap-3 items-start">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{r.serviceName}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {r.serviceDate} · {r.dutyRole} · {r.authorName}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-primary-700 shrink-0"
                onClick={() => setView(r)}
              >
                View
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(view)}
        onClose={() => setView(null)}
        wide
        title="Service report"
        description={
          view
            ? `${view.dutyRole} · ${view.authorName} · ${view.serviceName} · ${view.serviceDate}`
            : undefined
        }
        footer={
          <button type="button" className="pmss-btn-secondary" onClick={() => setView(null)}>
            Close
          </button>
        }
      >
        {view && (
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold text-neutral-800 mb-1">How the service went</h3>
              <p className="text-neutral-700 whitespace-pre-wrap">{view.howItWent}</p>
            </section>
            <section>
              <h3 className="font-semibold text-neutral-800 mb-1">Issues and challenges</h3>
              <p className="text-neutral-700 whitespace-pre-wrap">{view.issuesChallenges}</p>
            </section>
            <section>
              <h3 className="font-semibold text-neutral-800 mb-1">Solutions used</h3>
              <p className="text-neutral-700 whitespace-pre-wrap">{view.solutions}</p>
            </section>
            <section>
              <h3 className="font-semibold text-neutral-800 mb-1">Future recommendations</h3>
              <p className="text-neutral-700 whitespace-pre-wrap">{view.recommendations}</p>
            </section>
          </div>
        )}
      </Modal>
    </div>
  )
}
