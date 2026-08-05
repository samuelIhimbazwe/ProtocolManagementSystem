import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ShieldCheck, SlidersHorizontal, UserCircle, Users } from 'lucide-react'
import { PageHeader, Badge } from '../layouts/AppShell'
import ThemePicker from '../components/ThemePicker'
import Modal from '../components/Modal'
import { useRole } from '../context/RoleContext'
import { ROLES } from '../data/roles'
import {
  RULE_CATEGORIES,
  DEFAULT_RULE_CONFIGURATION,
  loadRuleConfiguration,
  saveRuleConfiguration,
} from '../data/rules'
import {
  getSettingsLayout,
  SETTINGS_SECTIONS,
  loadMemberPrefs,
  saveMemberPrefs,
  memberAccountFields,
  memberNotificationFields,
  memberDisplayFields,
} from '../data/settingsByRole'
import { USE_API } from '../api/config'
import { changePassword } from '../api/client'
import { fetchRules, saveRules as saveRulesApi } from '../api/schedule'
import { useAuth } from '../context/AuthContext'

function ChangePasswordCard({ onToast }) {
  const { markPasswordChanged } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    if (!USE_API) {
      onToast('Password change is available when connected to the API')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      markPasswordChanged?.()
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onToast('Password updated')
    } catch (err) {
      setError(err.message ?? 'Could not update password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="pmss-card p-5 mb-6" id="change-password">
      <div className="flex gap-3 mb-4">
        <div className="p-2.5 rounded-card bg-primary-50 text-primary-600 h-fit">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-neutral-900">Change password</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Update your sign-in password. You will need your current password to confirm.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3 max-w-md">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="settings-current-password">
            Current password
          </label>
          <input
            id="settings-current-password"
            type="password"
            className="pmss-input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="settings-new-password">
            New password
          </label>
          <input
            id="settings-new-password"
            type="password"
            className="pmss-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="settings-confirm-password">
            Confirm new password
          </label>
          <input
            id="settings-confirm-password"
            type="password"
            className="pmss-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-input px-3 py-2" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="pmss-btn-primary" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  )
}

function severityVariant(severity) {
  if (severity === 'Error') return 'error'
  if (severity === 'Warning') return 'warning'
  return 'neutral'
}

function SettingsFieldsSection({ title, fields, editable, onEdit }) {
  return (
    <section className="pmss-card p-5">
      <h2 className="font-semibold text-neutral-900 mb-4">{title}</h2>
      <dl className="space-y-3">
        {fields.map((f) => (
          <div
            key={f.label}
            className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-neutral-100 last:border-0"
          >
            <dt className="text-sm text-neutral-500">{f.label}</dt>
            <dd className="text-sm font-medium text-neutral-900">{f.value}</dd>
          </div>
        ))}
      </dl>
      {editable ? (
        <button type="button" className="mt-4 text-sm text-primary-600 font-medium" onClick={onEdit}>
          Edit section
        </button>
      ) : (
        <p className="mt-4 text-xs text-neutral-400">View only for your role.</p>
      )}
    </section>
  )
}

function RuleConfigurationBlock({
  rules,
  filter,
  setFilter,
  enabledCount,
  rulesAccess,
  ruleCategoryFilter,
  footnote,
  onToggle,
  onEdit,
  onReset,
  showValidationLink,
}) {
  const categories = ruleCategoryFilter
    ? ['All', ...RULE_CATEGORIES.filter((c) => ruleCategoryFilter.includes(c))]
    : ['All', ...RULE_CATEGORIES]

  const filteredRules = useMemo(() => {
    let list = filter === 'All' ? rules : rules.filter((r) => r.category === filter)
    if (ruleCategoryFilter) {
      list = list.filter((r) => ruleCategoryFilter.includes(r.category))
    }
    return list
  }, [rules, filter, ruleCategoryFilter])

  const canEdit = rulesAccess === 'edit'

  return (
    <section className="pmss-card p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div className="flex gap-3">
          <div className="p-2.5 rounded-card bg-primary-50 text-primary-600 h-fit">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900">Rule configuration</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Rules used by choir generation, team building, leadership rotation, and schedule validation.
            </p>
            <p className="text-xs text-neutral-400 mt-2">
              {enabledCount} of {rules.length} rules enabled
              {rulesAccess === 'view' ? ' · View only' : ''}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pmss-btn-secondary text-sm h-9" onClick={onReset}>
              Reset to defaults
            </button>
            {showValidationLink && (
              <Link
                to="/scheduling?tab=validation"
                className="pmss-btn-secondary text-sm h-9 inline-flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Run validation
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
              filter === cat ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-card border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left font-semibold text-neutral-500 px-4 py-3 w-12">On</th>
              <th className="text-left font-semibold text-neutral-500 px-4 py-3">Rule</th>
              <th className="text-left font-semibold text-neutral-500 px-4 py-3 hidden md:table-cell">Category</th>
              <th className="text-left font-semibold text-neutral-500 px-4 py-3 hidden lg:table-cell">Parameter</th>
              <th className="text-left font-semibold text-neutral-500 px-4 py-3">If broken</th>
              {canEdit && <th className="w-16 px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule) => (
              <tr key={rule.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/80">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    disabled={!canEdit}
                    onChange={() => onToggle(rule.id)}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-600 h-4 w-4 disabled:opacity-50"
                    aria-label={`Enable ${rule.name}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{rule.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5 max-w-md">{rule.description}</p>
                  <p className="text-xs text-neutral-600 mt-1 lg:hidden">{rule.parameter}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Badge variant="primary">{rule.category}</Badge>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-neutral-700">{rule.parameter}</td>
                <td className="px-4 py-3">
                  <Badge variant={severityVariant(rule.severity)}>{rule.severity}</Badge>
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onEdit(rule)}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {footnote && <p className="text-xs text-neutral-400 mt-3">{footnote}</p>}
    </section>
  )
}

export default function SettingsPage() {
  const { roleId, member, permissions, authUser } = useRole()
  const layout = getSettingsLayout(roleId)
  const roleLabel = ROLES.find((r) => r.id === roleId)?.label ?? 'User'

  const [rules, setRules] = useState(() => loadRuleConfiguration())
  const [filter, setFilter] = useState('All')
  const [editRule, setEditRule] = useState(null)
  const [paramDraft, setParamDraft] = useState('')
  const [toast, setToast] = useState(null)
  const [memberPrefs, setMemberPrefs] = useState(() => loadMemberPrefs())
  const [editMemberSection, setEditMemberSection] = useState(null)

  useEffect(() => {
    if (!USE_API) return
    fetchRules()
      .then((d) => setRules(d.rules ?? []))
      .catch(() => {})
  }, [])

  const persistRules = (next) => {
    setRules(next)
    if (USE_API && roleId === 'coordinator') {
      saveRulesApi(next).catch(() => showToast('Could not save rules to server'))
    } else {
      saveRuleConfiguration(next)
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const enabledCount = rules.filter((r) => r.enabled).length
  const showRules = layout.rulesAccess !== 'none'
  const showValidationLink = roleId === 'coordinator' || roleId === 'secretary'

  const toggleRule = (id) => {
    if (layout.rulesAccess !== 'edit') return
    setRules((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
      persistRules(next)
      return next
    })
  }

  const openEditRule = (rule) => {
    if (layout.rulesAccess !== 'edit') return
    setEditRule(rule)
    setParamDraft(rule.parameter)
  }

  const saveEditRule = () => {
    if (!editRule) return
    setRules((prev) => {
      const next = prev.map((r) => (r.id === editRule.id ? { ...r, parameter: paramDraft.trim() || r.parameter } : r))
      persistRules(next)
      return next
    })
    showToast(`Updated “${editRule.name}”`)
    setEditRule(null)
  }

  const resetRules = () => {
    const fresh = DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
    persistRules(fresh)
    showToast('Rules reset to defaults')
  }

  const sectionFields = (sectionKey) => {
    if (sectionKey === 'account') {
      const base = memberAccountFields(member)
      if (authUser?.username) {
        return [{ label: 'Username', value: authUser.username }, ...base]
      }
      return base
    }
    if (sectionKey === 'memberNotifications') return memberNotificationFields(memberPrefs)
    if (sectionKey === 'display') return memberDisplayFields(memberPrefs)
    return SETTINGS_SECTIONS[sectionKey]?.fields ?? []
  }

  const openMemberSectionEdit = (sectionKey) => {
    if (sectionKey === 'memberNotifications' || sectionKey === 'display') {
      setEditMemberSection(sectionKey)
      return
    }
    if (layout.editableSections.includes(sectionKey)) {
      showToast(`Saved “${SETTINGS_SECTIONS[sectionKey]?.title ?? sectionKey}”`)
    }
  }

  const saveMemberSectionEdit = () => {
    saveMemberPrefs(memberPrefs)
    showToast('Preferences saved')
    setEditMemberSection(null)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Settings"
        description={layout.description}
        actions={<Badge variant="primary">{roleLabel}</Badge>}
      />

      <ThemePicker />

      <ChangePasswordCard onToast={showToast} />

      {roleId === 'member' && (
        <div className="pmss-card p-4 mb-6 flex gap-3 items-start border-primary-100 bg-primary-50/40">
          <UserCircle className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
          <p className="text-sm text-neutral-600">
            Ministry-wide scheduling rules and team configuration are managed by leadership. You can update your
            personal alerts and display options below.
          </p>
        </div>
      )}

      {permissions.viewUsers && (
        <Link
          to="/members/accounts"
          className="pmss-card p-5 mb-6 flex gap-4 items-start hover:border-primary-200 transition-colors block"
        >
          <div className="p-2.5 rounded-card bg-primary-50 text-primary-600 h-fit">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-neutral-900">User accounts</p>
            <p className="text-sm text-neutral-500 mt-1">
              Invite or create logins, deactivate access, and send password resets — linked to the member roster.
            </p>
            <p className="text-xs text-primary-600 font-medium mt-2">Open user accounts →</p>
          </div>
        </Link>
      )}

      {showRules && (
        <RuleConfigurationBlock
          rules={rules}
          filter={filter}
          setFilter={setFilter}
          enabledCount={enabledCount}
          rulesAccess={layout.rulesAccess}
          ruleCategoryFilter={layout.ruleCategories}
          footnote={layout.rulesFootnote}
          onToggle={toggleRule}
          onEdit={openEditRule}
          onReset={resetRules}
          showValidationLink={showValidationLink}
        />
      )}

      <div className="space-y-4">
        {layout.sections.map((sectionKey) => {
          const meta = SETTINGS_SECTIONS[sectionKey]
          if (!meta && sectionKey !== 'account') return null
          const title = sectionKey === 'account' ? 'My account' : meta.title
          const editable = layout.editableSections.includes(sectionKey)
          return (
            <SettingsFieldsSection
              key={sectionKey}
              title={title}
              fields={sectionFields(sectionKey)}
              editable={editable}
              onEdit={() => openMemberSectionEdit(sectionKey)}
            />
          )
        })}
      </div>

      <Modal
        open={!!editRule}
        onClose={() => setEditRule(null)}
        title="Edit rule parameter"
        description={editRule?.name}
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setEditRule(null)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveEditRule}>
              Save
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-600 mb-3">{editRule?.description}</p>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Parameter (display / config)</label>
        <input className="pmss-input" value={paramDraft} onChange={(e) => setParamDraft(e.target.value)} />
        <p className="text-xs text-neutral-400 mt-2">
          Severity when broken: <strong>{editRule?.severity}</strong> (set by ministry policy)
        </p>
      </Modal>

      <Modal
        open={editMemberSection === 'memberNotifications'}
        onClose={() => setEditMemberSection(null)}
        title="Edit notification preferences"
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setEditMemberSection(null)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveMemberSectionEdit}>
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {[
            { key: 'schedulePublished', label: 'Schedule published' },
            { key: 'teamAssignment', label: 'Team assignment' },
            { key: 'dutyReminder', label: 'TL / VTL duty reminder' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</label>
              <select
                className="pmss-input"
                value={memberPrefs[key]}
                onChange={(e) => setMemberPrefs((p) => ({ ...p, [key]: e.target.value }))}
              >
                <option>In-app only</option>
                <option>In-app + email</option>
                <option>Off</option>
              </select>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={editMemberSection === 'display'}
        onClose={() => setEditMemberSection(null)}
        title="Display preferences"
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setEditMemberSection(null)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveMemberSectionEdit}>
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Default scheduling view</label>
            <select
              className="pmss-input"
              value={memberPrefs.defaultView}
              onChange={(e) => setMemberPrefs((p) => ({ ...p, defaultView: e.target.value }))}
            >
              <option>Cards</option>
              <option>List</option>
              <option>Bulletin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Language</label>
            <select
              className="pmss-input"
              value={memberPrefs.language}
              onChange={(e) => setMemberPrefs((p) => ({ ...p, language: e.target.value }))}
            >
              <option>English</option>
              <option>Kinyarwanda</option>
              <option>French</option>
            </select>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-card bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="mt-6 pmss-card p-4 md:hidden">
        <p className="text-sm font-medium">Attendance</p>
        <p className="text-xs text-neutral-500 mt-1">Quick link from More tab</p>
        <a href="/attendance" className="text-sm text-primary-600 font-medium mt-2 inline-block">
          Open attendance dashboard →
        </a>
      </div>
    </div>
  )
}
