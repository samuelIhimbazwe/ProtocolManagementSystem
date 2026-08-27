import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, SlidersHorizontal, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '../layouts/AppShell'
import Modal from './Modal'
import {
  RULE_CATEGORIES,
  DEFAULT_RULE_CONFIGURATION,
  loadRuleConfiguration,
  saveRuleConfiguration,
  isBuiltinRuleId,
  createCustomRule,
} from '../data/rules'
import { USE_API } from '../api/config'
import { fetchRules, saveRules as saveRulesApi } from '../api/schedule'
import { useRole } from '../context/RoleContext'

function severityVariant(severity) {
  if (severity === 'Error') return 'error'
  if (severity === 'Warning') return 'warning'
  return 'success'
}

const EMPTY_DRAFT = {
  name: '',
  category: 'Choir',
  description: '',
  severity: 'Warning',
  parameter: '',
  enabled: true,
}

/**
 * Engine rules list with enable / add / edit / remove.
 * Choir scheduler edits Choir rules; coordinator edits all categories.
 */
export default function RuleConfigurationPanel({
  rulesAccess = 'view',
  ruleCategoryFilter = null,
  footnote = null,
  showValidationLink = false,
  onRulesChanged,
  title = 'Engine rules',
  description = 'Rules used by choir generation, team building, and schedule validation.',
}) {
  const { roleId } = useRole()
  const [rules, setRules] = useState(() => loadRuleConfiguration())
  const [removedDefaultIds, setRemovedDefaultIds] = useState([])
  const [filter, setFilter] = useState('All')
  const [modal, setModal] = useState(null) // null | { mode: 'add'|'edit', rule? }
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)

  const canEdit = rulesAccess === 'edit'
  const canPersistApi = roleId === 'coordinator' || roleId === 'choir_scheduler'
  const defaultCategory = ruleCategoryFilter?.[0] ?? 'Schedule'
  const enabledCount = rules.filter((r) => r.enabled).length

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    if (!USE_API) return
    fetchRules()
      .then((d) => {
        setRules(d.rules ?? [])
        setRemovedDefaultIds(d.removedDefaultIds ?? [])
      })
      .catch(() => {})
  }, [])

  const persist = async (nextRules, nextRemoved = removedDefaultIds) => {
    setRules(nextRules)
    setRemovedDefaultIds(nextRemoved)
    if (USE_API && canPersistApi) {
      setSaving(true)
      try {
        // Choir scheduler only sends Choir-category rules; server merges the rest.
        const payloadRules =
          roleId === 'choir_scheduler' ? nextRules.filter((r) => r.category === 'Choir') : nextRules
        const res = await saveRulesApi(payloadRules, nextRemoved)
        setRules(res.rules ?? nextRules)
        setRemovedDefaultIds(res.removedDefaultIds ?? nextRemoved)
        onRulesChanged?.(res.rules ?? nextRules)
      } catch (err) {
        showToast(err?.message ?? 'Could not save rules to server')
      } finally {
        setSaving(false)
      }
    } else {
      saveRuleConfiguration(nextRules, nextRemoved)
      onRulesChanged?.(nextRules)
    }
  }

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

  const toggleRule = (id) => {
    if (!canEdit) return
    const next = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    persist(next)
  }

  const openAdd = () => {
    if (!canEdit) return
    setDraft({ ...EMPTY_DRAFT, category: defaultCategory })
    setModal({ mode: 'add' })
  }

  const openEdit = (rule) => {
    if (!canEdit) return
    setDraft({
      name: rule.name ?? '',
      category: rule.category ?? 'Schedule',
      description: rule.description ?? '',
      severity: rule.severity ?? 'Warning',
      parameter: rule.parameter ?? '',
      enabled: rule.enabled !== false,
    })
    setModal({ mode: 'edit', rule })
  }

  const saveModal = () => {
    if (!modal) return
    const name = draft.name.trim()
    if (!name) {
      showToast('Rule name is required')
      return
    }
    if (modal.mode === 'add') {
      const created = createCustomRule({
        name,
        category: ruleCategoryFilter?.length === 1 ? ruleCategoryFilter[0] : draft.category,
        description: draft.description.trim(),
        severity: draft.severity,
        parameter: draft.parameter.trim() || '—',
        enabled: draft.enabled,
      })
      persist([...rules, created])
      showToast(`Added “${created.name}”`)
    } else {
      const id = modal.rule.id
      const nextCategory =
        ruleCategoryFilter?.length === 1 ? ruleCategoryFilter[0] : draft.category
      const next = rules.map((r) =>
        r.id === id
          ? {
              ...r,
              name,
              category: nextCategory,
              description: draft.description.trim(),
              severity: draft.severity,
              parameter: draft.parameter.trim() || r.parameter,
              enabled: draft.enabled,
            }
          : r,
      )
      persist(next)
      showToast(`Updated “${name}”`)
    }
    setModal(null)
  }

  const removeRule = (rule) => {
    if (!canEdit) return
    const ok = window.confirm(
      isBuiltinRuleId(rule.id)
        ? `Remove “${rule.name}” from the active list? Reset to defaults will restore it.`
        : `Remove custom rule “${rule.name}”?`,
    )
    if (!ok) return
    const next = rules.filter((r) => r.id !== rule.id)
    const nextRemoved = isBuiltinRuleId(rule.id)
      ? [...new Set([...removedDefaultIds, rule.id])]
      : removedDefaultIds
    persist(next, nextRemoved)
    showToast(`Removed “${rule.name}”`)
  }

  const resetRules = () => {
    if (!canEdit) return
    if (roleId === 'choir_scheduler') {
      const ok = window.confirm('Reset choir engine rules to defaults? Custom choir rules will be removed.')
      if (!ok) return
      const choirDefaults = DEFAULT_RULE_CONFIGURATION.filter((r) => r.category === 'Choir').map((r) => ({
        ...r,
      }))
      const nonChoir = rules.filter((r) => r.category !== 'Choir')
      const nextRemoved = removedDefaultIds.filter(
        (id) => !DEFAULT_RULE_CONFIGURATION.some((d) => d.id === id && d.category === 'Choir'),
      )
      persist([...nonChoir, ...choirDefaults], nextRemoved)
      showToast('Choir rules reset to defaults')
      return
    }
    const ok = window.confirm('Reset all rules to engine defaults? Custom rules will be removed.')
    if (!ok) return
    const fresh = DEFAULT_RULE_CONFIGURATION.map((r) => ({ ...r }))
    persist(fresh, [])
    showToast('Rules reset to defaults')
  }

  return (
    <section className="pmss-card p-5">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div className="flex gap-3">
          <div className="p-2.5 rounded-card bg-primary-50 text-primary-600 h-fit">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900">{title}</h2>
            <p className="text-sm text-neutral-500 mt-1">{description}</p>
            <p className="text-xs text-neutral-400 mt-2">
              {enabledCount} of {rules.length} rules enabled
              {rulesAccess === 'view' ? ' · View only' : ''}
              {saving ? ' · Saving…' : ''}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pmss-btn-secondary text-sm h-9 inline-flex items-center gap-1.5" onClick={openAdd}>
              <Plus className="w-4 h-4" /> Add rule
            </button>
            <button type="button" className="pmss-btn-secondary text-sm h-9" onClick={resetRules}>
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
              <th className="text-left font-semibold text-neutral-500 px-4 py-3">Severity</th>
              {canEdit && <th className="text-right font-semibold text-neutral-500 px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRules.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-neutral-500">
                  No rules in this category.
                </td>
              </tr>
            )}
            {filteredRules.map((rule) => (
              <tr key={rule.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/80">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    disabled={!canEdit}
                    onChange={() => toggleRule(rule.id)}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-600 h-4 w-4 disabled:opacity-50"
                    aria-label={`Enable ${rule.name}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">
                    {rule.name}
                    {rule.custom ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        Custom
                      </span>
                    ) : null}
                  </p>
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
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(rule)}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRule(rule)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                        aria-label={`Remove ${rule.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {footnote && <p className="text-xs text-neutral-400 mt-3">{footnote}</p>}
      {canEdit && (
        <p className="text-xs text-neutral-400 mt-2">
          Built-in engine rules are checked automatically when enabled. Custom rules are kept for policy
          documentation and do not change validation logic until wired into the engine.
        </p>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'add' ? 'Add rule' : 'Edit rule'}
        description={modal?.mode === 'edit' ? modal.rule?.id : 'Define a new scheduling / validation rule'}
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveModal}>
              {modal?.mode === 'add' ? 'Add rule' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Name</label>
            <input
              className="pmss-input"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. No overlapping choir leaders"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Category</label>
              <select
                className="pmss-input"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              >
                {(ruleCategoryFilter ?? RULE_CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Severity</label>
              <select
                className="pmss-input"
                value={draft.severity}
                onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))}
              >
                <option value="Error">Error</option>
                <option value="Warning">Warning</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
            <textarea
              className="pmss-input min-h-[72px]"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="What this rule checks"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Parameter</label>
            <input
              className="pmss-input"
              value={draft.parameter}
              onChange={(e) => setDraft((d) => ({ ...d, parameter: e.target.value }))}
              placeholder="e.g. Minimum: 4 members"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-600 h-4 w-4"
            />
            Enabled
          </label>
        </div>
      </Modal>
    </section>
  )
}
