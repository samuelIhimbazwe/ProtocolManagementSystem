import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageHeader } from '../layouts/AppShell'
import OfficeReportBuilder from '../components/OfficeReportBuilder'
import { useRole } from '../context/RoleContext'
import { USE_API } from '../api/config'
import { resolveJurisdiction, ROLE_LABELS } from '../lib/officeReportBuilder'

export default function OfficeReportBuilderPage() {
  const { roleId, officeAccess } = useRole()
  const officeKind = officeAccess?.kind
  const jurisdiction = resolveJurisdiction(roleId, officeKind)
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  if (!USE_API) {
    return <Navigate to="/" replace />
  }

  if (!officeAccess?.showOffice || !jurisdiction) {
    return <Navigate to="/?view=office" replace />
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Office report builder"
        description={`Include any section you can access as ${ROLE_LABELS[jurisdiction] ?? jurisdiction}, then preview, download, or submit to a leader.`}
        actions={
          <Link to="/?view=office" className="text-sm font-medium text-primary-700">
            ← Back to Office
          </Link>
        }
      />

      <OfficeReportBuilder
        roleId={roleId}
        officeKind={officeKind === 'leadership' ? 'leadership' : 'team_duty'}
        onToast={showToast}
        fullPage
      />

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
