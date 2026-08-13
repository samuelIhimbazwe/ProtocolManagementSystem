import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { Badge } from '../layouts/AppShell'
import {
  blocksForJurisdiction,
  defaultIncludeMap,
  groupBlocks,
  ROLE_LABELS,
  resolveJurisdiction,
  slugifyTitle,
  SUBMIT_RECIPIENT_ROLE_OPTIONS,
} from '../lib/officeReportBuilder'
import {
  buildOfficeReportPreviewHtml,
  downloadOfficeReportCsv,
  downloadOfficeReportExcel,
  downloadOfficeReportPdf,
} from '../lib/officeReportExport'
import {
  createOfficeReport,
  fetchOfficeReportBundle,
  fetchOfficeReportCatalog,
  fetchOfficeReports,
  submitOfficeReport,
  updateOfficeReport,
} from '../api/officeReports'
import { USE_API } from '../api/config'
import { emptySignatories } from '../lib/reportDocument'

const EMPTY_NARRATIVE = {
  howItWent: '',
  issuesChallenges: '',
  solutions: '',
  recommendations: '',
  notes: '',
}

/**
 * Jurisdiction-scoped office report builder: build, preview, submit to leader, download.
 */
export default function OfficeReportBuilder({
  roleId,
  officeKind,
  onToast,
}) {
  const jurisdiction = resolveJurisdiction(roleId, officeKind)
  const fallbackBlocks = useMemo(
    () => blocksForJurisdiction(jurisdiction),
    [jurisdiction],
  )

  const [catalog, setCatalog] = useState(null)
  const [title, setTitle] = useState('Office Report')
  const [subtitle, setSubtitle] = useState('')
  const [signatories, setSignatories] = useState(emptySignatories)
  const [include, setInclude] = useState(() => defaultIncludeMap(fallbackBlocks))
  const [narrative, setNarrative] = useState(EMPTY_NARRATIVE)
  const [snapshot, setSnapshot] = useState(null)
  const [reportId, setReportId] = useState(null)
  const [status, setStatus] = useState('draft')
  const [busy, setBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([])
  const [inbox, setInbox] = useState([])
  const [mine, setMine] = useState([])
  const [viewInbox, setViewInbox] = useState(null)
  const [step, setStep] = useState(0)
  const [openGroup, setOpenGroup] = useState(null)

  const blocks = catalog?.blocks?.length ? catalog.blocks : fallbackBlocks
  const recipients = catalog?.recipients ?? []
  const roleOptions =
    catalog?.recipientRoleOptions?.length > 0
      ? catalog.recipientRoleOptions
      : SUBMIT_RECIPIENT_ROLE_OPTIONS.map((o) => ({
          ...o,
          count: recipients.filter((r) => r.roleKey === o.id || r.appRole === o.id).length,
        }))
  const canSubmitToLeader = roleOptions.length > 0
  const groups = useMemo(() => groupBlocks(blocks), [blocks])
  const selectedCount = useMemo(
    () => Object.values(include).filter(Boolean).length,
    [include],
  )

  const recipientsForRole = useMemo(
    () =>
      selectedRole
        ? recipients.filter((r) => r.roleKey === selectedRole || (!r.roleKey && r.appRole === selectedRole))
        : [],
    [recipients, selectedRole],
  )

  const selectedRecipients = useMemo(
    () => recipientsForRole.filter((r) => selectedRecipientIds.includes(r.id)),
    [recipientsForRole, selectedRecipientIds],
  )

  const payload = useMemo(
    () => ({
      title: title.trim() || 'Office Report',
      subtitle: subtitle.trim(),
      include,
      narrative,
      snapshot,
      meta: {
        authorName: catalog?.authorName,
        authorRole: catalog?.authorRole ?? roleId,
        authorEmail: catalog?.authorEmail,
        jurisdiction: catalog?.jurisdiction ?? jurisdiction,
        generatedAt: snapshot?.generatedAt ?? new Date().toISOString(),
        reportId: reportId ? `RPT-${String(reportId).slice(0, 8).toUpperCase()}` : undefined,
        recipientName: selectedRecipients.map((r) => r.displayName).join(', ') || undefined,
        recipientRole: selectedRole || selectedRecipients[0]?.roleKey || selectedRecipients[0]?.appRole,
        preparedByName: signatories.preparedByName,
        preparedByRole: signatories.preparedByRole,
        approvedByName: signatories.approvedByName,
        approvedByRole: signatories.approvedByRole,
      },
    }),
    [
      title,
      subtitle,
      include,
      narrative,
      snapshot,
      catalog,
      roleId,
      jurisdiction,
      reportId,
      selectedRecipients,
      selectedRole,
      signatories,
    ],
  )

  const refreshLists = async () => {
    if (!USE_API) return
    try {
      const [mineData, inboxData] = await Promise.all([
        fetchOfficeReports({ mine: true }),
        fetchOfficeReports({ inbox: true }),
      ])
      setMine(mineData.reports ?? [])
      setInbox(inboxData.reports ?? [])
    } catch {
      /* ignore list errors */
    }
  }

  useEffect(() => {
    if (!USE_API || !jurisdiction) return
    let cancelled = false
    ;(async () => {
      try {
        const cat = await fetchOfficeReportCatalog()
        if (cancelled) return
        setCatalog(cat)
        setInclude(defaultIncludeMap(cat.blocks?.length ? cat.blocks : fallbackBlocks))
        setTitle(`${ROLE_LABELS[cat.jurisdiction] ?? 'Office'} Report`)
        if (cat.authorName) setSubtitle('')
        setSelectedRole('')
        setSelectedRecipientIds([])
        await refreshLists()
      } catch (err) {
        onToast?.(err.message ?? 'Could not load office report catalog')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jurisdiction, roleId, officeKind])

  if (!jurisdiction) return null

  const setAll = (on) => {
    const next = {}
    for (const b of blocks) next[b.id] = on
    setInclude(next)
  }

  const setGroup = (groupName, on) => {
    const next = { ...include }
    for (const b of blocks) {
      if ((b.group || 'Sections') === groupName) next[b.id] = on
    }
    setInclude(next)
  }

  const ensureSnapshot = async () => {
    const data = await fetchOfficeReportBundle(include)
    setSnapshot({ ...data.snapshot, generatedAt: data.generatedAt })
    return data
  }

  const saveDraft = async () => {
    setBusy(true)
    try {
      const data = await ensureSnapshot()
      const body = {
        title: payload.title,
        subtitle: payload.subtitle,
        include,
        narrative,
        snapshot: data.snapshot,
      }
      if (reportId && status === 'draft') {
        const updated = await updateOfficeReport(reportId, body)
        setReportId(updated.report.id)
        setStatus(updated.report.status)
      } else {
        const created = await createOfficeReport(body)
        setReportId(created.report.id)
        setStatus(created.report.status)
      }
      onToast?.('Draft saved')
      await refreshLists()
    } catch (err) {
      onToast?.(err.message ?? 'Could not save draft')
    } finally {
      setBusy(false)
    }
  }

  const preview = async () => {
    setBusy(true)
    try {
      await ensureSnapshot()
      setPreviewOpen(true)
    } catch (err) {
      onToast?.(err.message ?? 'Could not build preview')
    } finally {
      setBusy(false)
    }
  }

  const download = async (format) => {
    setBusy(true)
    setDownloadOpen(false)
    try {
      const data = await ensureSnapshot()
      const full = {
        ...payload,
        snapshot: { ...data.snapshot, generatedAt: data.generatedAt },
      }
      const stamp = slugifyTitle(full.title)
      if (format === 'pdf') {
        const result = await downloadOfficeReportPdf(full)
        onToast?.(`Downloaded ${result?.fileName ?? 'office-report.pdf'}`)
      } else if (format === 'excel') {
        downloadOfficeReportExcel(full, `pmss-office-report-${stamp}.xls`)
        onToast?.('Downloaded (EXCEL)')
      } else {
        downloadOfficeReportCsv(full, `pmss-office-report-${stamp}.csv`)
        onToast?.('Downloaded (CSV)')
      }
    } catch (err) {
      onToast?.(err.message ?? 'Download failed')
    } finally {
      setBusy(false)
    }
  }

  const openSubmit = () => {
    if (selectedCount === 0) {
      onToast?.('Select at least one section')
      return
    }
    if (!canSubmitToLeader) {
      void confirmSubmit([])
      return
    }
    setSelectedRole('')
    setSelectedRecipientIds([])
    setSubmitOpen(true)
  }

  const pickRole = (roleId) => {
    setSelectedRole(roleId)
    const people = recipients.filter(
      (r) => r.roleKey === roleId || (!r.roleKey && r.appRole === roleId),
    )
    setSelectedRecipientIds(people.map((p) => p.id))
  }

  const toggleRecipient = (id) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const confirmSubmit = async (recipientIds) => {
    if (canSubmitToLeader && (!selectedRole || !recipientIds || recipientIds.length === 0)) {
      onToast?.('Select a role and at least one recipient')
      return
    }
    setBusy(true)
    setSubmitOpen(false)
    try {
      const data = await ensureSnapshot()
      const body = {
        title: payload.title,
        subtitle: payload.subtitle,
        include,
        narrative,
        snapshot: data.snapshot,
      }

      if (!canSubmitToLeader) {
        let id = reportId
        if (!id || status === 'submitted') {
          const created = await createOfficeReport(body)
          id = created.report.id
        } else {
          await updateOfficeReport(id, body)
        }
        const submitted = await submitOfficeReport(id, {})
        setStatus(submitted.report.status)
        setReportId(submitted.report.id)
        onToast?.('Report filed')
      } else {
        const names = []
        let lastId = reportId
        for (let i = 0; i < recipientIds.length; i += 1) {
          const rid = recipientIds[i]
          let id
          if (i === 0 && lastId && status === 'draft') {
            await updateOfficeReport(lastId, body)
            id = lastId
          } else {
            const created = await createOfficeReport(body)
            id = created.report.id
          }
          const submitted = await submitOfficeReport(id, {
            recipientUserId: rid,
            recipientRole: selectedRole,
          })
          lastId = submitted.report.id
          if (submitted.report.recipientName) names.push(submitted.report.recipientName)
        }
        setStatus('submitted')
        setReportId(lastId)
        const roleLabel = ROLE_LABELS[selectedRole] ?? selectedRole
        onToast?.(
          names.length === 1
            ? `Report submitted to ${names[0]} (${roleLabel})`
            : `Report submitted to ${names.length} ${roleLabel} recipients`,
        )
      }
      setSelectedRole('')
      setSelectedRecipientIds([])
      await refreshLists()
    } catch (err) {
      onToast?.(err.message ?? 'Could not submit report')
    } finally {
      setBusy(false)
    }
  }

  const isTeamDuty = jurisdiction === 'team_duty'
  const narrativeFields = isTeamDuty
    ? [
        ['howItWent', 'narrativeHow', 'How it went'],
        ['issuesChallenges', 'narrativeIssues', 'Issues & challenges'],
        ['solutions', 'narrativeSolutions', 'Solutions used'],
        ['recommendations', 'narrativeRecs', 'Recommendations'],
      ]
    : [['notes', 'narrativeNotes', 'Notes']]

  const steps = [
    { id: 'details', label: 'Details' },
    { id: 'sections', label: 'Sections' },
    { id: 'notes', label: 'Notes' },
    { id: 'finish', label: 'Finish' },
  ]

  const goNext = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  return (
    <section className="pmss-card p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <nav className="flex flex-wrap gap-1.5" aria-label="Report builder steps">
          {steps.map((s, i) => {
            const active = i === step
            const done = i < step
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-primary-700 text-white'
                    : done
                      ? 'bg-primary-50 text-primary-800'
                      : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {i + 1}. {s.label}
              </button>
            )
          })}
        </nav>
        <Badge variant={status === 'submitted' ? 'success' : 'warning'}>
          {status === 'submitted' ? 'Last action: submitted' : 'Draft workspace'}
        </Badge>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Report title</label>
              <input className="pmss-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Subtitle / notes</label>
              <input
                className="pmss-input"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Optional context"
              />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
              Sign-off (printed on PDF)
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-emerald-800">Prepared by</p>
                <input
                  className="pmss-input"
                  value={signatories.preparedByName}
                  onChange={(e) => setSignatories((s) => ({ ...s, preparedByName: e.target.value }))}
                  placeholder="Name"
                />
                <input
                  className="pmss-input"
                  value={signatories.preparedByRole}
                  onChange={(e) => setSignatories((s) => ({ ...s, preparedByRole: e.target.value }))}
                  placeholder="Role"
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-emerald-800">Approved by</p>
                <input
                  className="pmss-input"
                  value={signatories.approvedByName}
                  onChange={(e) => setSignatories((s) => ({ ...s, approvedByName: e.target.value }))}
                  placeholder="Name"
                />
                <input
                  className="pmss-input"
                  value={signatories.approvedByRole}
                  onChange={(e) => setSignatories((s) => ({ ...s, approvedByRole: e.target.value }))}
                  placeholder="Role"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" className="pmss-btn-chip pmss-btn-chip-secondary" onClick={() => setAll(true)}>
              Select all
            </button>
            <button type="button" className="pmss-btn-chip pmss-btn-chip-secondary" onClick={() => setAll(false)}>
              Clear all
            </button>
            <span className="text-xs text-neutral-500 self-center tabular-nums">
              {selectedCount}/{blocks.length} sections
            </span>
          </div>

          <div className="space-y-2">
            {groups.map((g) => {
              const selectedInGroup = g.blocks.filter((b) => include[b.id]).length
              const allOn = selectedInGroup === g.blocks.length && g.blocks.length > 0
              const expanded = openGroup === g.name
              return (
                <div key={g.name} className="rounded-lg border border-neutral-200 overflow-hidden">
                  <div className="flex items-center gap-2 bg-neutral-50/80 px-3 py-2.5">
                    <button
                      type="button"
                      className="flex-1 text-left flex items-center justify-between gap-2 min-w-0"
                      onClick={() => setOpenGroup(expanded ? null : g.name)}
                      aria-expanded={expanded}
                    >
                      <h3 className="text-sm font-semibold text-neutral-800 truncate">
                        {g.name}
                        <span className="ml-2 text-xs font-medium text-neutral-400">
                          {selectedInGroup}/{g.blocks.length}
                        </span>
                      </h3>
                      <span className="text-xs font-medium text-neutral-500 shrink-0">
                        {expanded ? 'Hide' : 'Show'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary-700 shrink-0 px-1"
                      onClick={() => setGroup(g.name, !allOn)}
                    >
                      {allOn ? 'Clear' : 'Select'}
                    </button>
                  </div>
                  {expanded && (
                    <div className="grid sm:grid-cols-2 gap-2 p-3 border-t border-neutral-100">
                      {g.blocks.map((b) => (
                        <label
                          key={b.id}
                          className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm cursor-pointer ${
                            include[b.id]
                              ? 'border-primary-200 bg-primary-50/60'
                              : 'border-neutral-200 bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-600"
                            checked={Boolean(include[b.id])}
                            onChange={() => setInclude((prev) => ({ ...prev, [b.id]: !prev[b.id] }))}
                          />
                          <span>
                            <span className="font-medium block">{b.label}</span>
                            {b.description && (
                              <span className="block text-xs text-neutral-500 mt-0.5">{b.description}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-neutral-500 mt-3">Open one group at a time to pick sections.</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {narrativeFields.every(([, blockId]) => !include[blockId]) ? (
            <p className="text-sm text-neutral-500 rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center">
              No notes section is selected. Go back to Sections if you want to include notes.
            </p>
          ) : (
            narrativeFields.map(([key, blockId, label]) =>
              include[blockId] ? (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <textarea
                    className="pmss-input min-h-[5rem] py-2"
                    value={narrative[key]}
                    onChange={(e) => setNarrative((n) => ({ ...n, [key]: e.target.value }))}
                    placeholder={`Write ${label.toLowerCase()}…`}
                  />
                </div>
              ) : null,
            )
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3 mb-4 text-sm text-neutral-600">
            <p>
              <span className="font-semibold text-neutral-900">{title.trim() || 'Office Report'}</span>
              {subtitle.trim() ? ` — ${subtitle.trim()}` : ''}
            </p>
            <p className="text-xs mt-1 tabular-nums">
              {selectedCount}/{blocks.length} sections · {ROLE_LABELS[jurisdiction] ?? jurisdiction}
            </p>
          </div>

          <div className="sticky bottom-3 z-10 flex flex-wrap gap-2 items-center border border-neutral-200 bg-white/95 backdrop-blur-sm shadow-md rounded-xl px-3 py-3">
            <button type="button" className="pmss-btn-secondary text-sm h-9" disabled={busy} onClick={preview}>
              Preview
            </button>
            <button type="button" className="pmss-btn-secondary text-sm h-9" disabled={busy} onClick={saveDraft}>
              Save draft
            </button>
            <button type="button" className="pmss-btn-primary text-sm h-9" disabled={busy} onClick={openSubmit}>
              Submit report
            </button>
            <button
              type="button"
              className="pmss-btn-secondary text-sm h-9"
              disabled={busy}
              onClick={() => setDownloadOpen(true)}
            >
              Download
            </button>
          </div>

          {(mine.length > 0 || inbox.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4 mt-6 pt-5 border-t border-neutral-100">
              <div>
                <h3 className="text-sm font-semibold mb-2">My office reports</h3>
                {mine.length === 0 ? (
                  <p className="text-xs text-neutral-500">No saved reports yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {mine.slice(0, 5).map((r) => (
                      <li key={r.id} className="text-sm flex justify-between gap-2">
                        <span className="truncate">
                          {r.title}
                          <span className="text-xs text-neutral-500 block">
                            {r.status}
                            {r.recipientName ? ` → ${r.recipientName}` : ''}
                          </span>
                        </span>
                        <Badge variant={r.status === 'submitted' ? 'success' : 'warning'}>{r.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Submitted to me</h3>
                {inbox.length === 0 ? (
                  <p className="text-xs text-neutral-500">No inbound reports.</p>
                ) : (
                  <ul className="space-y-2">
                    {inbox.slice(0, 5).map((r) => (
                      <li key={r.id} className="text-sm flex justify-between gap-2 items-start">
                        <span className="truncate">
                          {r.title}
                          <span className="text-xs text-neutral-500 block">
                            From {r.authorName} · {ROLE_LABELS[r.authorRole] ?? r.authorRole}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-primary-700 shrink-0"
                          onClick={() => setViewInbox(r)}
                        >
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-6 pt-4 border-t border-neutral-100">
        <button
          type="button"
          className="pmss-btn-secondary text-sm h-9"
          disabled={step === 0}
          onClick={goBack}
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className="pmss-btn-primary text-sm h-9" onClick={goNext}>
            Continue
          </button>
        ) : (
          <span className="text-xs text-neutral-500">Preview, save, submit, or download above.</span>
        )}
      </div>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        xl
        title="Report preview"
        description={payload.title}
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setPreviewOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="pmss-btn-primary"
              onClick={() => {
                setPreviewOpen(false)
                setDownloadOpen(true)
              }}
            >
              Download
            </button>
          </>
        }
      >
        <iframe
          title="Office report preview"
          className="w-full h-[min(70vh,720px)] border border-neutral-200 rounded-lg bg-white"
          srcDoc={buildOfficeReportPreviewHtml(payload)}
        />
      </Modal>

      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Submit report"
        description="Select the role to send this report to, then confirm the recipient."
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setSubmitOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="pmss-btn-primary"
              disabled={busy || !selectedRole || selectedRecipientIds.length === 0}
              onClick={() => confirmSubmit(selectedRecipientIds)}
            >
              Submit{selectedRecipientIds.length > 0 ? ` (${selectedRecipientIds.length})` : ''}
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
                  No active login for this role yet. Create their account in Settings, or choose another
                  role.
                </p>
              ) : (
                <div className="space-y-2 max-h-[min(40vh,280px)] overflow-y-auto pr-1">
                  {recipientsForRole.map((r) => {
                    const on = selectedRecipientIds.includes(r.id)
                    return (
                      <label
                        key={`${r.roleKey ?? selectedRole}-${r.id}`}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm cursor-pointer ${
                          on ? 'border-primary-200 bg-primary-50/60' : 'border-neutral-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300 text-primary-600 focus:ring-primary-600"
                          checked={on}
                          onChange={() => toggleRecipient(r.id)}
                        />
                        <span>
                          <span className="font-medium block">{r.displayName}</span>
                          <span className="text-xs text-neutral-500">
                            {r.roleLabel ?? ROLE_LABELS[r.roleKey] ?? ROLE_LABELS[r.appRole] ?? r.appRole}
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

      <Modal
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        title="Download report"
        description="Choose a file format."
        footer={
          <button type="button" className="pmss-btn-secondary" onClick={() => setDownloadOpen(false)}>
            Cancel
          </button>
        }
      >
        <div className="grid gap-2">
          {[
            ['pdf', 'PDF', 'Printable formal report'],
            ['excel', 'Excel', 'Spreadsheet (.xls)'],
            ['csv', 'CSV', 'Comma-separated data'],
          ].map(([format, label, hint]) => (
            <button
              key={format}
              type="button"
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-neutral-200 text-left hover:border-primary-200 hover:bg-primary-50/40"
              disabled={busy}
              onClick={() => download(format)}
            >
              <span>
                <span className="font-semibold block text-sm">{label}</span>
                <span className="text-xs text-neutral-500">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(viewInbox)}
        onClose={() => setViewInbox(null)}
        xl
        title={viewInbox?.title ?? 'Inbound report'}
        description={
          viewInbox
            ? `From ${viewInbox.authorName} · ${ROLE_LABELS[viewInbox.authorRole] ?? viewInbox.authorRole}`
            : undefined
        }
        footer={
          <button type="button" className="pmss-btn-secondary" onClick={() => setViewInbox(null)}>
            Close
          </button>
        }
      >
        {viewInbox && (
          <iframe
            title="Inbound office report"
            className="w-full h-[min(70vh,720px)] border border-neutral-200 rounded-lg bg-white"
            srcDoc={buildOfficeReportPreviewHtml({
              title: viewInbox.title,
              subtitle: viewInbox.subtitle,
              include: viewInbox.include,
              narrative: viewInbox.narrative,
              snapshot: viewInbox.snapshot,
              meta: {
                authorName: viewInbox.authorName,
                authorRole: viewInbox.authorRole,
                jurisdiction: viewInbox.jurisdiction,
                generatedAt: viewInbox.submittedAt ?? viewInbox.updatedAt,
                reportId: viewInbox.id ? `RPT-${String(viewInbox.id).slice(0, 8).toUpperCase()}` : undefined,
                recipientName: viewInbox.recipientName,
                recipientRole: viewInbox.recipientRole,
              },
            })}
          />
        )}
      </Modal>
    </section>
  )
}
