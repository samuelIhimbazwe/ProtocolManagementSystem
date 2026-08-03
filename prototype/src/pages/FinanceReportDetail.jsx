import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PageHeader, DataTable, Badge } from '../layouts/AppShell'
import { useRole } from '../context/RoleContext'
import { USE_API } from '../api/config'
import { fetchFinanceReports } from '../api/finance'
import { formatRwf, SUBMISSION_STATUS_LABEL } from '../lib/money'

const REPORTS = {
  collection: {
    title: 'Collection by type',
    description: 'Contribution collected toward each ministry goal',
  },
  members: {
    title: 'Member contribution performance',
    description: 'Claimed and confirmed amounts for every protocol member',
  },
  outstanding: {
    title: 'Outstanding balances',
    description: 'Open follow-up amounts still owed',
  },
  exceptions: {
    title: 'Partial & declined payments',
    description: 'Unresolved partial confirmations and declined submissions',
  },
}

function statusBadge(status) {
  const variant =
    status === 'confirmed'
      ? 'success'
      : status === 'pending'
        ? 'warning'
        : status === 'partial'
          ? 'primary'
          : 'error'
  return <Badge variant={variant}>{SUBMISSION_STATUS_LABEL[status] ?? status}</Badge>
}

export default function FinanceReportDetailPage() {
  const { reportId } = useParams()
  const { permissions } = useRole()
  const meta = REPORTS[reportId]
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!USE_API || !permissions.viewFinanceReports || !meta) return
    setLoading(true)
    fetchFinanceReports()
      .then(setReports)
      .catch((err) => setError(err.message ?? 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [permissions.viewFinanceReports, meta])

  const q = query.trim().toLowerCase()

  const memberRows = useMemo(() => {
    const rows = reports?.members ?? []
    if (!q) return rows
    return rows.filter(
      (r) =>
        String(r.name).toLowerCase().includes(q) ||
        String(r.phone ?? '')
          .toLowerCase()
          .includes(q),
    )
  }, [reports, q])

  if (!permissions.viewFinanceReports) return <Navigate to="/finance" replace />
  if (!meta) return <Navigate to="/finance" replace />

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title={meta.title}
        description={meta.description}
                actions={
          <Link to="/finance" state={{ section: 'reports' }} className="text-sm text-primary-700 font-medium">
            ← Finance reports
          </Link>
        }
      />

      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-card px-4 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading report…</p>
      ) : (
        <>
          {reportId === 'collection' && (
            <DataTable
              columns={[
                { key: 'name', label: 'Type' },
                { key: 'ministryGoal', label: 'Goal', render: (r) => formatRwf(r.ministryGoal) },
                { key: 'collected', label: 'Collected', render: (r) => formatRwf(r.collected) },
                { key: 'claimed', label: 'Claimed', render: (r) => formatRwf(r.claimed) },
                {
                  key: 'progressPct',
                  label: 'Achievement',
                  render: (r) => (r.progressPct != null ? `${r.progressPct}%` : '—'),
                },
              ]}
              rows={reports?.collection ?? []}
              emptyTitle="No contribution types"
            />
          )}

          {reportId === 'members' && (
            <div className="space-y-4">
              <input
                type="search"
                className="pmss-input max-w-md"
                placeholder="Search member or phone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search members"
              />
              <p className="text-xs text-neutral-500">
                Showing {memberRows.length} of {(reports?.members ?? []).length} members
              </p>
              <DataTable
                columns={[
                  { key: 'name', label: 'Member' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'claimed', label: 'Claimed', render: (r) => formatRwf(r.claimed) },
                  { key: 'paid', label: 'Confirmed', render: (r) => formatRwf(r.paid) },
                ]}
                rows={memberRows}
                emptyTitle="No members match"
              />
            </div>
          )}

          {reportId === 'outstanding' && (
            <DataTable
              columns={[
                { key: 'member_name', label: 'Member' },
                { key: 'contribution_name', label: 'Type' },
                {
                  key: 'outstanding_amount',
                  label: 'Amount',
                  render: (r) => formatRwf(r.outstanding_amount),
                },
                { key: 'status', label: 'Follow-up' },
                { key: 'submission_status', label: 'Submission' },
              ]}
              rows={(reports?.outstanding ?? []).map((r, i) => ({ id: i, ...r }))}
              emptyTitle="No outstanding balances"
            />
          )}

          {reportId === 'exceptions' && (
            <DataTable
              columns={[
                { key: 'memberName', label: 'Member' },
                { key: 'contributionName', label: 'Type' },
                {
                  key: 'claimedAmount',
                  label: 'Claimed',
                  render: (r) => formatRwf(r.claimedAmount),
                },
                {
                  key: 'confirmedAmount',
                  label: 'Confirmed',
                  render: (r) => (r.confirmedAmount != null ? formatRwf(r.confirmedAmount) : '—'),
                },
                { key: 'status', label: 'Status', render: (r) => statusBadge(r.status) },
                {
                  key: 'verificationNote',
                  label: 'Note',
                  render: (r) => r.verificationNote || '—',
                },
              ]}
              rows={[...(reports?.partials ?? []), ...(reports?.declined ?? [])]}
              emptyTitle="No partial or declined payments"
            />
          )}
        </>
      )}
    </div>
  )
}
