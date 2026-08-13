import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import Modal from './Modal'
import { Badge } from '../layouts/AppShell'
import {
  createServiceReport,
  fetchServiceReportForService,
  fetchServiceReportRecipients,
  fetchSubmittedServiceReports,
  submitServiceReport,
  updateServiceReport,
} from '../api/serviceReports'
import { ROLE_LABELS, SUBMIT_RECIPIENT_ROLE_OPTIONS } from '../lib/officeReportBuilder'

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

export function ServiceReportModal({ open, onClose, duty, onSaved, onToast }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [recipients, setRecipients] = useState([])
  const [roleOptions, setRoleOptions] = useState(SUBMIT_RECIPIENT_ROLE_OPTIONS)
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedRecipientId, setSelectedRecipientId] = useState('')

  const readOnly = report?.status === 'submitted'

  const recipientsForRole = useMemo(
    () => (selectedRole ? recipients.filter((r) => r.roleKey === selectedRole) : []),
    [recipients, selectedRole],
  )

  useEffect(() => {
    if (!open || !duty?.serviceId) return
    let cancelled = false
    setLoading(true)
    setSubmitOpen(false)
    setSelectedRole('')
    setSelectedRecipientId('')
    ;(async () => {
      try {
        const [data, recip] = await Promise.all([
          fetchServiceReportForService(duty.serviceId),
          fetchServiceReportRecipients().catch(() => ({ recipients: [], roleOptions: [] })),
        ])
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
        setRecipients(recip.recipients ?? [])
        setRoleOptions(
          recip.roleOptions?.length
            ? recip.roleOptions
            : SUBMIT_RECIPIENT_ROLE_OPTIONS.map((o) => ({
                ...o,
                count: (recip.recipients ?? []).filter((r) => r.roleKey === o.id).length,
              })),
        )
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

  const openSubmit = () => {
    if (!report || readOnly) return
    const missing = ['howItWent', 'issuesChallenges', 'solutions', 'recommendations'].filter(
      (k) => !String(form[k] ?? '').trim(),
    )
    if (missing.length) {
      onToast?.('Please complete all four sections before submitting')
      return
    }
    setSubmitOpen(true)
  }

  const pickRole = (roleId) => {
    setSelectedRole(roleId)
    const people = recipients.filter((r) => r.roleKey === roleId)
    setSelectedRecipientId(people[0]?.id ?? '')
  }

  const confirmSubmit = async () => {
    if (!report || readOnly) return
    if (!selectedRole || !selectedRecipientId) {
      onToast?.('Select a role and recipient')
      return
    }
    setSaving(true)
    try {
      const data = await submitServiceReport(report.id, {
        ...form,
        recipientUserId: selectedRecipientId,
        recipientRole: selectedRole,
      })
      setReport(data.report)
      setSubmitOpen(false)
      onToast?.(
        data.report.recipientName
          ? `Service report submitted to ${data.report.recipientName}`
          : 'Service report submitted',
      )
      onSaved?.(data.report)
      onClose?.()
    } catch (err) {
      onToast?.(err.message ?? 'Could not submit report')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
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
                  onClick={openSubmit}
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
                    {report.recipientName ? ` → ${report.recipientName}` : ''}
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
              hint="What the team did to address issues during or after the service."
              value={form.solutions}
              onChange={setField('solutions')}
              readOnly={readOnly}
            />
            <Field
              id="recommendations"
              label="Recommendations"
              hint="What should leadership improve next time."
              value={form.recommendations}
              onChange={setField('recommendations')}
              readOnly={readOnly}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Submit report"
        description="Select the role to send this service report to."
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setSubmitOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="pmss-btn-primary"
              disabled={saving || !selectedRole || !selectedRecipientId}
              onClick={confirmSubmit}
            >
              Submit report
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              Send to role
            </p>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((role) => {
                const on = selectedRole === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`pmss-btn-chip text-left ${
                      on ? 'pmss-btn-chip-primary' : 'pmss-btn-chip-secondary'
                    }`}
                    onClick={() => pickRole(role.id)}
                  >
                    {role.label}
                    <span className="ml-1 opacity-70 tabular-nums">({role.count ?? 0})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedRole ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                Recipients · {ROLE_LABELS[selectedRole] ?? selectedRole}
              </p>
              {recipientsForRole.length === 0 ? (
                <p className="text-sm text-neutral-500 rounded-lg border border-dashed border-neutral-200 px-3 py-4">
                  No active login for this role yet. Choose another role.
                </p>
              ) : (
                <div className="space-y-2 max-h-[min(40vh,280px)] overflow-y-auto pr-1">
                  {recipientsForRole.map((r) => {
                    const on = selectedRecipientId === r.id
                    return (
                      <label
                        key={`${r.roleKey}-${r.id}`}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm cursor-pointer ${
                          on ? 'border-primary-200 bg-primary-50/60' : 'border-neutral-200 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="service-report-recipient"
                          className="border-neutral-300 text-primary-600 focus:ring-primary-600"
                          checked={on}
                          onChange={() => setSelectedRecipientId(r.id)}
                        />
                        <span>
                          <span className="font-medium block">{r.displayName}</span>
                          <span className="text-xs text-neutral-500">
                            {r.roleLabel ?? ROLE_LABELS[r.roleKey] ?? r.appRole}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Choose a role above to see who can receive the report.</p>
          )}
        </div>
      </Modal>
    </>
  )
}

export function SubmittedServiceReportsPanel() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchSubmittedServiceReports()
        if (!cancelled) setReports(data.reports ?? [])
      } catch {
        if (!cancelled) setReports([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="pmss-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-primary-700" />
        <h2 className="font-semibold text-neutral-900">TL / VTL service reports</h2>
      </div>
      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-neutral-500">No submitted service reports yet.</p>
      ) : (
        <ul className="space-y-2">
          {reports.slice(0, 8).map((r) => (
            <li key={r.id} className="text-sm flex justify-between gap-2">
              <span className="truncate">
                {r.serviceName}
                <span className="text-xs text-neutral-500 block">
                  {r.authorName} · {r.dutyRole}
                  {r.recipientName ? ` → ${r.recipientName}` : ''}
                </span>
              </span>
              <Badge variant="success">Submitted</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
