import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Wallet,
  CreditCard,
  ListChecks,
  ShieldCheck,
  MessageSquareWarning,
  BarChart3,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { PageHeader, StatCard, DataTable, Badge, EmptyState } from '../layouts/AppShell'
import Modal from '../components/Modal'
import { useRole } from '../context/RoleContext'
import { USE_API } from '../api/config'
import {
  fetchFinanceSummary,
  fetchContributionTypes,
  createContributionType,
  updateContributionType,
  closeContributionType,
  fetchPaymentMethods,
  createPaymentMethod,
  deactivatePaymentMethod,
  fetchSubmissions,
  createSubmission,
  verifySubmission,
  fetchFollowups,
  updateFollowup,
  fetchFinanceReports,
} from '../api/finance'
import {
  formatRwf,
  parseAmountInput,
  SUBMISSION_STATUS_LABEL,
  FREQUENCY_LABEL,
} from '../lib/money'

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: Wallet },
  { id: 'types', label: 'Types', icon: ListChecks, leadership: true },
  { id: 'methods', label: 'Payment methods', icon: CreditCard },
  { id: 'ledger', label: 'Ledger', icon: BarChart3, leadership: true },
  { id: 'verify', label: 'Verification', icon: ShieldCheck, verify: true },
  { id: 'followups', label: 'Follow-ups', icon: MessageSquareWarning, leadership: true },
  { id: 'reports', label: 'Reports', icon: BarChart3, reports: true },
]

function statusBadge(status) {
  const variant =
    status === 'confirmed' || status === 'resolved' || status === 'closed'
      ? 'success'
      : status === 'pending' || status === 'open' || status === 'in_progress'
        ? 'warning'
        : status === 'partial'
          ? 'primary'
          : 'error'
  return <Badge variant={variant}>{SUBMISSION_STATUS_LABEL[status] ?? status}</Badge>
}

function ProgressBar({ pct }) {
  const v = Math.max(0, Math.min(100, pct ?? 0))
  return (
    <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
      <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${v}%` }} />
    </div>
  )
}

function ReportPreview({ title, to, countLabel, children }) {
  return (
    <div className="pmss-card p-5">
      <div className="flex justify-between items-center gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-sm">{title}</h2>
          {countLabel && <p className="text-xs text-neutral-500 mt-0.5">{countLabel}</p>}
        </div>
        <Link to={to} className="text-sm font-medium text-primary-700 shrink-0">
          View all →
        </Link>
      </div>
      {children}
    </div>
  )
}

export default function FinancePage() {
  const location = useLocation()
  const { permissions, roleId, member } = useRole()
  const isMember = roleId === 'member'
  const canManageTypes = permissions.manageContributionTypes
  const canManageMethods = permissions.managePaymentMethods
  const canVerify = permissions.verifyContributions
  const canViewLedger = permissions.viewFinanceLedger
  const canViewReports = permissions.viewFinanceReports
  const canSubmit = permissions.submitContributions || isMember || canVerify

  const visibleSections = SECTIONS.filter((s) => {
    if (s.verify && !canVerify) return false
    if (s.reports && !canViewReports) return false
    if (s.leadership && isMember) return false
    if (s.id === 'methods' && isMember) return true
    return true
  })

  const initialSection =
    location.state?.section && visibleSections.some((s) => s.id === location.state.section)
      ? location.state.section
      : isMember
        ? 'overview'
        : 'overview'
  const [section, setSection] = useState(initialSection)
  const [summary, setSummary] = useState(null)
  const [types, setTypes] = useState([])
  const [methods, setMethods] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [totals, setTotals] = useState(null)
  const [followups, setFollowups] = useState([])
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const [payOpen, setPayOpen] = useState(false)
  const [payForm, setPayForm] = useState({
    contributionTypeId: '',
    paymentDate: '2026-08-15',
    claimedAmount: '',
    paymentMethodId: '',
    evidenceNote: '',
  })

  const [typeOpen, setTypeOpen] = useState(false)
  const [typeForm, setTypeForm] = useState({
    name: '',
    description: '',
    category: 'General',
    frequency: 'monthly',
    ministryGoal: '500000',
    memberGoal: '5000',
    visibility: 'private',
    deadline: '2026-08-31',
    startDate: '2026-08-01',
  })

  const [methodOpen, setMethodOpen] = useState(false)
  const [methodForm, setMethodForm] = useState({
    kind: 'mobile_money',
    label: '',
    provider: '',
    accountName: '',
    accountNumber: '',
    instructions: '',
  })

  const [verifyModal, setVerifyModal] = useState(null)
  const [verifyForm, setVerifyForm] = useState({ action: 'confirm', receivedAmount: '', note: '' })

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const load = useCallback(async () => {
    if (!USE_API) {
      setError('Finance requires the live API.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [sum, ty, meth] = await Promise.all([
        fetchFinanceSummary(),
        fetchContributionTypes(),
        fetchPaymentMethods(),
      ])
      setSummary(sum)
      setTypes(ty.types ?? [])
      setMethods(meth.methods ?? [])

      if (canViewLedger || isMember) {
        const sub = await fetchSubmissions(isMember ? {} : {})
        setSubmissions(sub.submissions ?? [])
        setTotals(sub.totals ?? null)
      }
      if (canViewLedger) {
        const fu = await fetchFollowups()
        setFollowups(fu.followups ?? [])
      }
      if (canViewReports) {
        const rep = await fetchFinanceReports()
        setReports(rep)
      }
    } catch (err) {
      setError(err.message ?? 'Failed to load finance data')
    } finally {
      setLoading(false)
    }
  }, [canViewLedger, canViewReports, isMember])

  useEffect(() => {
    if (location.state?.section && visibleSections.some((s) => s.id === location.state.section)) {
      setSection(location.state.section)
    }
  }, [location.state, visibleSections])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!visibleSections.some((s) => s.id === section)) {
      setSection(visibleSections[0]?.id ?? 'overview')
    }
  }, [visibleSections, section])

  const activeMethods = useMemo(() => methods.filter((m) => m.active !== false), [methods])

  const submitPay = async () => {
    const amount = parseAmountInput(payForm.claimedAmount)
    if (!payForm.contributionTypeId || !payForm.paymentDate || !Number.isFinite(amount)) {
      showToast('Select type, date, and a valid amount')
      return
    }
    try {
      await createSubmission({
        contributionTypeId: payForm.contributionTypeId,
        paymentDate: payForm.paymentDate,
        claimedAmount: amount,
        paymentMethodId: payForm.paymentMethodId || undefined,
        evidenceNote: payForm.evidenceNote || undefined,
      })
      showToast('Contribution submitted — pending verification')
      setPayOpen(false)
      load()
    } catch (err) {
      showToast(err.message ?? 'Submit failed')
    }
  }

  const saveType = async () => {
    try {
      await createContributionType({
        name: typeForm.name,
        description: typeForm.description,
        category: typeForm.category,
        frequency: typeForm.frequency,
        ministryGoal: parseAmountInput(typeForm.ministryGoal) || 0,
        memberGoal: parseAmountInput(typeForm.memberGoal) || 0,
        visibility: typeForm.visibility,
        deadline: typeForm.frequency === 'continuous' ? null : typeForm.deadline,
        startDate: typeForm.startDate || null,
      })
      showToast('Contribution type created')
      setTypeOpen(false)
      load()
    } catch (err) {
      showToast(err.message ?? 'Could not create type')
    }
  }

  const saveMethod = async () => {
    try {
      await createPaymentMethod(methodForm)
      showToast('Payment method added')
      setMethodOpen(false)
      load()
    } catch (err) {
      showToast(err.message ?? 'Could not add method')
    }
  }

  const runVerify = async () => {
    if (!verifyModal) return
    try {
      await verifySubmission(verifyModal.id, {
        action: verifyForm.action,
        receivedAmount:
          verifyForm.action === 'partial' ? parseAmountInput(verifyForm.receivedAmount) : undefined,
        note: verifyForm.note || undefined,
      })
      showToast('Verification saved')
      setVerifyModal(null)
      load()
    } catch (err) {
      showToast(err.message ?? 'Verification failed')
    }
  }

  const pendingRows = submissions.filter((s) => s.status === 'pending')

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Finance & Contributions"
        description="Ministry contributions, payment verification, and accountability"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pmss-btn-secondary text-sm h-9" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {(canSubmit) && (
              <button
                type="button"
                className="pmss-btn-primary text-sm h-9"
                onClick={() => {
                  setPayForm((f) => ({
                    ...f,
                    contributionTypeId: types.find((t) => t.status === 'Active')?.id ?? '',
                    paymentMethodId: activeMethods[0]?.id ?? '',
                  }))
                  setPayOpen(true)
                }}
              >
                Pay contribution
              </button>
            )}
          </div>
        }
      />

      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-card px-4 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1 mb-6 p-1 rounded-xl bg-neutral-100/80 border border-neutral-200/80 pmss-no-print">
        {visibleSections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              section === id
                ? 'bg-white text-primary-800 shadow-sm ring-1 ring-neutral-200/80'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading && !summary ? (
        <p className="text-sm text-neutral-500">Loading finance…</p>
      ) : (
        <>
          {section === 'overview' && (
            <div className="space-y-6">
              {!isMember && summary?.leadership && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard label="Collected" value={formatRwf(summary.leadership.totalCollected)} icon={Wallet} />
                  <StatCard
                    label="Pending verification"
                    value={String(summary.leadership.pendingVerification)}
                    icon={ShieldCheck}
                  />
                  <StatCard
                    label="Outstanding"
                    value={formatRwf(summary.leadership.outstandingBalances)}
                    icon={MessageSquareWarning}
                  />
                  <StatCard label="Active types" value={String(summary.leadership.activeTypes)} icon={ListChecks} />
                  <StatCard
                    label="Goal achievement"
                    value={
                      summary.leadership.goalAchievement != null
                        ? `${summary.leadership.goalAchievement}%`
                        : '—'
                    }
                    icon={BarChart3}
                  />
                </div>
              )}

              {isMember && (
                <>
                  <div className="grid lg:grid-cols-2 gap-4">
                    {(summary?.memberProgress ?? []).map((p) => (
                      <div key={p.id} className="pmss-card p-5">
                        <div className="flex justify-between gap-2 mb-3">
                          <h2 className="font-semibold text-sm">{p.name}</h2>
                          <Badge variant="primary">{FREQUENCY_LABEL[p.frequency] ?? p.frequency}</Badge>
                        </div>
                        <dl className="text-sm space-y-1.5 text-neutral-700 mb-3">
                          <div className="flex justify-between">
                            <dt className="text-neutral-500">Goal</dt>
                            <dd className="font-medium">{formatRwf(p.memberGoal)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-neutral-500">Paid</dt>
                            <dd className="font-medium text-emerald-700">{formatRwf(p.paid)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-neutral-500">Remaining</dt>
                            <dd className="font-medium">{formatRwf(p.remaining)}</dd>
                          </div>
                        </dl>
                        <ProgressBar pct={p.progressPct} />
                        <p className="text-xs text-neutral-500 mt-2">{p.progressPct}% complete</p>
                      </div>
                    ))}
                  </div>
                  {(summary?.memberProgress?.length ?? 0) === 0 && (
                    <EmptyState title="No active contribution goals" description="Leadership will publish goals here." />
                  )}
                </>
              )}

              {(summary?.publicGoals?.length ?? 0) > 0 && (
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-4">Ministry goals (public)</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {summary.publicGoals.map((g) => (
                      <div key={g.id} className="rounded-lg border border-neutral-200 p-4">
                        <p className="font-medium text-sm">{g.name}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {formatRwf(g.collected)} of {formatRwf(g.ministryGoal)}
                        </p>
                        <div className="mt-3">
                          <ProgressBar pct={g.progressPct} />
                        </div>
                        <p className="text-xs font-semibold text-primary-700 mt-2">{g.progressPct}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pmss-card p-5">
                <h2 className="font-semibold text-sm mb-3">Payment methods</h2>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {(summary?.methods ?? activeMethods).map((m) => (
                    <li key={m.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                      <p className="font-semibold">{m.label}</p>
                      {m.accountName && <p className="text-neutral-600 mt-1">{m.accountName}</p>}
                      {m.accountNumber && (
                        <p className="text-neutral-500 tabular-nums text-xs mt-0.5">{m.accountNumber}</p>
                      )}
                      {m.instructions && <p className="text-xs text-neutral-500 mt-2">{m.instructions}</p>}
                    </li>
                  ))}
                </ul>
              </div>

              {isMember && (
                <div className="pmss-card p-5">
                  <h2 className="font-semibold text-sm mb-3">My contribution history</h2>
                  <DataTable
                    columns={[
                      { key: 'contributionName', label: 'Type' },
                      { key: 'paymentDate', label: 'Payment date' },
                      { key: 'claimedAmount', label: 'Claimed', render: (r) => formatRwf(r.claimedAmount) },
                      {
                        key: 'confirmedAmount',
                        label: 'Confirmed',
                        render: (r) => (r.confirmedAmount != null ? formatRwf(r.confirmedAmount) : '—'),
                      },
                      { key: 'status', label: 'Status', render: (r) => statusBadge(r.status) },
                    ]}
                    rows={submissions}
                    emptyTitle="No submissions yet"
                    emptyDescription="Use Pay contribution to submit your first payment."
                  />
                </div>
              )}
            </div>
          )}

          {section === 'types' && (
            <div className="space-y-4">
              {canManageTypes && (
                <button
                  type="button"
                  className="pmss-btn-primary text-sm h-9"
                  onClick={() => setTypeOpen(true)}
                >
                  <Plus className="w-4 h-4" /> New contribution type
                </button>
              )}
              <DataTable
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'frequency', label: 'Frequency', render: (r) => FREQUENCY_LABEL[r.frequency] ?? r.frequency },
                  { key: 'ministryGoal', label: 'Ministry goal', render: (r) => formatRwf(r.ministryGoal) },
                  { key: 'memberGoal', label: 'Member goal', render: (r) => formatRwf(r.memberGoal) },
                  { key: 'collected', label: 'Collected', render: (r) => formatRwf(r.collected) },
                  {
                    key: 'progressPct',
                    label: 'Progress',
                    render: (r) => (r.progressPct != null ? `${r.progressPct}%` : '—'),
                  },
                  { key: 'visibility', label: 'Visibility' },
                  { key: 'deadline', label: 'Deadline' },
                  { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'Active' ? 'success' : 'neutral'}>{r.status}</Badge> },
                  ...(canManageTypes
                    ? [
                        {
                          key: 'actions',
                          label: '',
                          render: (r) => (
                            <div className="flex gap-2">
                              {r.visibility === 'private' && (
                                <button
                                  type="button"
                                  className="text-xs font-medium text-primary-700"
                                  onClick={async () => {
                                    try {
                                      await updateContributionType(r.id, { visibility: 'public' })
                                      showToast('Goal made public')
                                      load()
                                    } catch (e) {
                                      showToast(e.message)
                                    }
                                  }}
                                >
                                  Make public
                                </button>
                              )}
                              {r.status === 'Active' && roleId === 'treasurer' && (
                                <button
                                  type="button"
                                  className="text-xs font-medium text-red-700"
                                  onClick={async () => {
                                    try {
                                      await closeContributionType(r.id)
                                      showToast('Type closed')
                                      load()
                                    } catch (e) {
                                      showToast(e.message)
                                    }
                                  }}
                                >
                                  Close
                                </button>
                              )}
                            </div>
                          ),
                        },
                      ]
                    : []),
                ]}
                rows={types}
                emptyTitle="No contribution types"
              />
            </div>
          )}

          {section === 'methods' && (
            <div className="space-y-4">
              {canManageMethods && (
                <button type="button" className="pmss-btn-primary text-sm h-9" onClick={() => setMethodOpen(true)}>
                  <Plus className="w-4 h-4" /> Add method
                </button>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                {methods.map((m) => (
                  <div key={m.id} className={`pmss-card p-5 ${m.active === false ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between gap-2">
                      <h3 className="font-semibold text-sm">{m.label}</h3>
                      <Badge variant={m.active === false ? 'neutral' : 'success'}>
                        {m.active === false ? 'Inactive' : m.kind.replace('_', ' ')}
                      </Badge>
                    </div>
                    <dl className="text-sm mt-3 space-y-1 text-neutral-600">
                      {m.provider && (
                        <div className="flex justify-between">
                          <dt>Provider</dt>
                          <dd>{m.provider}</dd>
                        </div>
                      )}
                      {m.accountName && (
                        <div className="flex justify-between gap-2">
                          <dt>Account name</dt>
                          <dd className="text-right">{m.accountName}</dd>
                        </div>
                      )}
                      {m.accountNumber && (
                        <div className="flex justify-between">
                          <dt>Number</dt>
                          <dd className="tabular-nums">{m.accountNumber}</dd>
                        </div>
                      )}
                    </dl>
                    {m.instructions && <p className="text-xs text-neutral-500 mt-3">{m.instructions}</p>}
                    {canManageMethods && m.active !== false && (
                      <button
                        type="button"
                        className="text-xs font-medium text-red-700 mt-3"
                        onClick={async () => {
                          try {
                            await deactivatePaymentMethod(m.id)
                            showToast('Method deactivated')
                            load()
                          } catch (e) {
                            showToast(e.message)
                          }
                        }}
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'ledger' && (
            <div className="space-y-4">
              <DataTable
                columns={[
                  { key: 'memberName', label: 'Member' },
                  { key: 'memberPhone', label: 'Phone' },
                  { key: 'contributionName', label: 'Type' },
                  { key: 'paymentDate', label: 'Payment date' },
                  { key: 'claimedAmount', label: 'Claimed', render: (r) => formatRwf(r.claimedAmount) },
                  {
                    key: 'confirmedAmount',
                    label: 'Confirmed',
                    render: (r) => (r.confirmedAmount != null ? formatRwf(r.confirmedAmount) : '—'),
                  },
                  { key: 'status', label: 'Status', render: (r) => statusBadge(r.status) },
                  { key: 'submittedAt', label: 'Submitted', render: (r) => r.submittedAt?.slice?.(0, 10) ?? '—' },
                  { key: 'confirmedAt', label: 'Confirmed', render: (r) => r.confirmedAt?.slice?.(0, 10) ?? '—' },
                  { key: 'verifiedByName', label: 'Verified by', render: (r) => r.verifiedByName ?? '—' },
                  {
                    key: 'followUpStatus',
                    label: 'Follow-up',
                    render: (r) => r.followUpStatus ?? '—',
                  },
                ]}
                rows={submissions}
                emptyTitle="No ledger entries"
              />
              {totals && (
                <div className="pmss-card p-4 grid sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-neutral-500">Claimed total</p>
                    <p className="font-semibold text-lg tabular-nums">{formatRwf(totals.claimedTotal)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Confirmed total</p>
                    <p className="font-semibold text-lg tabular-nums text-emerald-700">
                      {formatRwf(totals.confirmedTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Difference</p>
                    <p className="font-semibold text-lg tabular-nums">{formatRwf(totals.difference)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'verify' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                Review pending submissions. Confirm full payment, partially confirm with a note, or decline.
              </p>
              <DataTable
                columns={[
                  { key: 'memberName', label: 'Member' },
                  { key: 'contributionName', label: 'Type' },
                  { key: 'paymentDate', label: 'Date' },
                  { key: 'claimedAmount', label: 'Claimed', render: (r) => formatRwf(r.claimedAmount) },
                  { key: 'evidenceNote', label: 'Evidence', render: (r) => r.evidenceNote || '—' },
                  {
                    key: 'actions',
                    label: '',
                    render: (r) => (
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary-700"
                        onClick={() => {
                          setVerifyModal(r)
                          setVerifyForm({
                            action: 'confirm',
                            receivedAmount: String(r.claimedAmount),
                            note: '',
                          })
                        }}
                      >
                        Verify
                      </button>
                    ),
                  },
                ]}
                rows={pendingRows}
                emptyTitle="No pending verifications"
              />
            </div>
          )}

          {section === 'followups' && (
            <div className="space-y-4">
              <DataTable
                columns={[
                  { key: 'memberName', label: 'Member' },
                  { key: 'contributionName', label: 'Type' },
                  { key: 'outstandingAmount', label: 'Outstanding', render: (r) => formatRwf(r.outstandingAmount) },
                  { key: 'submissionStatus', label: 'Submission', render: (r) => statusBadge(r.submissionStatus) },
                  { key: 'status', label: 'Case', render: (r) => <Badge variant="warning">{r.status}</Badge> },
                  { key: 'verificationNote', label: 'Note', render: (r) => r.verificationNote || '—' },
                  ...(canVerify
                    ? [
                        {
                          key: 'actions',
                          label: '',
                          render: (r) => (
                            <button
                              type="button"
                              className="text-xs font-medium text-primary-700"
                              onClick={async () => {
                                try {
                                  await updateFollowup(r.id, { status: 'resolved', note: 'Resolved by treasurer' })
                                  showToast('Follow-up resolved')
                                  load()
                                } catch (e) {
                                  showToast(e.message)
                                }
                              }}
                            >
                              Resolve
                            </button>
                          ),
                        },
                      ]
                    : []),
                ]}
                rows={followups}
                emptyTitle="No follow-up cases"
              />
            </div>
          )}

          {section === 'reports' && reports && (
            <div className="space-y-6">
              <ReportPreview
                title="Collection by type"
                to="/finance/reports/collection"
                countLabel={`${(reports.collection ?? []).length} types`}
              >
                <DataTable
                  columns={[
                    { key: 'name', label: 'Type' },
                    { key: 'collected', label: 'Collected', render: (r) => formatRwf(r.collected) },
                    {
                      key: 'progressPct',
                      label: 'Achievement',
                      render: (r) => (r.progressPct != null ? `${r.progressPct}%` : '—'),
                    },
                  ]}
                  rows={(reports.collection ?? []).slice(0, 5)}
                  emptyTitle="No contribution types"
                />
              </ReportPreview>

              <ReportPreview
                title="Member contribution performance"
                to="/finance/reports/members"
                countLabel={`Top contributors · ${(reports.members ?? []).length} members total`}
              >
                <DataTable
                  columns={[
                    { key: 'name', label: 'Member' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'claimed', label: 'Claimed', render: (r) => formatRwf(r.claimed) },
                    { key: 'paid', label: 'Confirmed', render: (r) => formatRwf(r.paid) },
                  ]}
                  rows={(reports.members ?? []).slice(0, 5)}
                  emptyTitle="No member data"
                />
              </ReportPreview>

              <div className="grid lg:grid-cols-2 gap-6">
                <ReportPreview
                  title="Outstanding balances"
                  to="/finance/reports/outstanding"
                  countLabel={`${(reports.outstanding ?? []).length} open`}
                >
                  <DataTable
                    columns={[
                      { key: 'member_name', label: 'Member' },
                      { key: 'contribution_name', label: 'Type' },
                      {
                        key: 'outstanding_amount',
                        label: 'Amount',
                        render: (r) => formatRwf(r.outstanding_amount),
                      },
                    ]}
                    rows={(reports.outstanding ?? []).slice(0, 3).map((r, i) => ({ id: i, ...r }))}
                    emptyTitle="None"
                  />
                </ReportPreview>

                <ReportPreview
                  title="Partial & declined"
                  to="/finance/reports/exceptions"
                  countLabel={`${(reports.partials ?? []).length} partial · ${(reports.declined ?? []).length} declined`}
                >
                  <DataTable
                    columns={[
                      { key: 'memberName', label: 'Member' },
                      { key: 'contributionName', label: 'Type' },
                      { key: 'status', label: 'Status', render: (r) => statusBadge(r.status) },
                    ]}
                    rows={[...(reports.partials ?? []), ...(reports.declined ?? [])].slice(0, 3)}
                    emptyTitle="None"
                  />
                </ReportPreview>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Pay contribution"
        description="Submit payment details for treasurer verification."
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setPayOpen(false)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={submitPay}>
              Submit
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Contribution type</label>
            <select
              className="pmss-input"
              value={payForm.contributionTypeId}
              onChange={(e) => setPayForm((f) => ({ ...f, contributionTypeId: e.target.value }))}
            >
              <option value="">Select…</option>
              {types
                .filter((t) => t.status === 'Active')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment date</label>
            <input
              type="date"
              className="pmss-input"
              value={payForm.paymentDate}
              onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount paid (RWF)</label>
            <input
              className="pmss-input"
              value={payForm.claimedAmount}
              onChange={(e) => setPayForm((f) => ({ ...f, claimedAmount: e.target.value }))}
              placeholder="5000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment method</label>
            <select
              className="pmss-input"
              value={payForm.paymentMethodId}
              onChange={(e) => setPayForm((f) => ({ ...f, paymentMethodId: e.target.value }))}
            >
              <option value="">Select…</option>
              {activeMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Evidence note (optional)</label>
            <textarea
              className="pmss-input h-20 py-2"
              value={payForm.evidenceNote}
              onChange={(e) => setPayForm((f) => ({ ...f, evidenceNote: e.target.value }))}
              placeholder="MoMo transaction ID, bank slip reference…"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={typeOpen}
        onClose={() => setTypeOpen(false)}
        title="New contribution type"
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setTypeOpen(false)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveType}>
              Create
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {[
            ['name', 'Name', 'text'],
            ['description', 'Description', 'text'],
            ['category', 'Category', 'text'],
            ['ministryGoal', 'Ministry goal (RWF)', 'text'],
            ['memberGoal', 'Member goal (RWF)', 'text'],
            ['startDate', 'Start date', 'date'],
            ['deadline', 'Deadline', 'date'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type={type}
                className="pmss-input"
                value={typeForm[key]}
                onChange={(e) => setTypeForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1">Frequency</label>
            <select
              className="pmss-input"
              value={typeForm.frequency}
              onChange={(e) => setTypeForm((f) => ({ ...f, frequency: e.target.value }))}
            >
              {Object.entries(FREQUENCY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Visibility</label>
            <select
              className="pmss-input"
              value={typeForm.visibility}
              onChange={(e) => setTypeForm((f) => ({ ...f, visibility: e.target.value }))}
            >
              <option value="private">Private (leadership)</option>
              <option value="public">Public (members see ministry goal)</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={methodOpen}
        onClose={() => setMethodOpen(false)}
        title="Add payment method"
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setMethodOpen(false)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveMethod}>
              Save
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Kind</label>
            <select
              className="pmss-input"
              value={methodForm.kind}
              onChange={(e) => setMethodForm((f) => ({ ...f, kind: e.target.value }))}
            >
              <option value="mobile_money">Mobile Money</option>
              <option value="bank">Bank Account</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>
          {['label', 'provider', 'accountName', 'accountNumber', 'instructions'].map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1 capitalize">
                {key.replace(/([A-Z])/g, ' $1')}
              </label>
              <input
                className="pmss-input"
                value={methodForm[key]}
                onChange={(e) => setMethodForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(verifyModal)}
        onClose={() => setVerifyModal(null)}
        title="Verify contribution"
        description={
          verifyModal
            ? `${verifyModal.memberName} · claimed ${formatRwf(verifyModal.claimedAmount)}`
            : undefined
        }
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setVerifyModal(null)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={runVerify}>
              Save verification
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Decision</label>
            <select
              className="pmss-input"
              value={verifyForm.action}
              onChange={(e) => setVerifyForm((f) => ({ ...f, action: e.target.value }))}
            >
              <option value="confirm">Confirm (full amount received)</option>
              <option value="partial">Partial confirmation</option>
              <option value="decline">Decline</option>
            </select>
          </div>
          {verifyForm.action === 'partial' && (
            <div>
              <label className="block text-sm font-medium mb-1">Amount received (RWF)</label>
              <input
                className="pmss-input"
                value={verifyForm.receivedAmount}
                onChange={(e) => setVerifyForm((f) => ({ ...f, receivedAmount: e.target.value }))}
              />
            </div>
          )}
          {(verifyForm.action === 'partial' || verifyForm.action === 'decline') && (
            <div>
              <label className="block text-sm font-medium mb-1">Explanation note</label>
              <textarea
                className="pmss-input h-24 py-2"
                value={verifyForm.note}
                onChange={(e) => setVerifyForm((f) => ({ ...f, note: e.target.value }))}
                required
              />
            </div>
          )}
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
