import { useMemo, useState } from 'react'
import { groupBlocks } from '../lib/reportBuilder'
import { emptySignatories } from '../lib/reportDocument'

/**
 * Stepped report builder: details → sections (accordion) → export.
 */
export default function ReportBuilder({
  title,
  onTitleChange,
  subtitle,
  onSubtitleChange,
  signatories = emptySignatories(),
  onSignatoriesChange,
  blocks,
  include,
  onIncludeChange,
  presets = [],
  onExport,
  disabled,
  hint,
  showHeader = true,
}) {
  const [query, setQuery] = useState('')
  const [activePreset, setActivePreset] = useState('full')
  const [step, setStep] = useState(0)
  const [openGroup, setOpenGroup] = useState(null)

  const selectedCount = useMemo(
    () => Object.values(include).filter(Boolean).length,
    [include],
  )

  const groups = useMemo(() => groupBlocks(blocks), [blocks])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => ({
        ...g,
        blocks: g.blocks.filter(
          (b) =>
            b.label.toLowerCase().includes(q) ||
            (b.description ?? '').toLowerCase().includes(q) ||
            g.name.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.blocks.length > 0)
  }, [groups, query])

  const steps = [
    { id: 'details', label: 'Details' },
    { id: 'sections', label: 'Sections' },
    { id: 'export', label: 'Export' },
  ]

  const setAll = (on) => {
    const next = {}
    for (const b of blocks) next[b.id] = on
    onIncludeChange(next)
    setActivePreset(on ? 'full' : '')
  }

  const setGroup = (groupName, on) => {
    const next = { ...include }
    for (const b of blocks) {
      if ((b.group || 'Sections') === groupName) next[b.id] = on
    }
    onIncludeChange(next)
    setActivePreset('')
  }

  const toggle = (id) => {
    onIncludeChange({ ...include, [id]: !include[id] })
    setActivePreset('')
  }

  const applyPreset = (preset) => {
    const set = new Set(preset.ids)
    const next = {}
    for (const b of blocks) next[b.id] = set.has(b.id)
    onIncludeChange(next)
    setActivePreset(preset.id)
  }

  const setSign = (key, value) => {
    onSignatoriesChange?.({ ...signatories, [key]: value })
  }

  const goNext = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  return (
    <section className="pmss-card p-5 md:p-6 mb-6 pmss-no-print">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="min-w-0">
          {showHeader && (
            <>
              <h2 className="font-semibold text-neutral-900">Build reports</h2>
              <p className="text-sm text-neutral-500 mt-1">
                {hint ??
                  'Build a custom report: set the title, enter prepared/approved by, pick sections, then export.'}
              </p>
            </>
          )}
          <nav className={`flex flex-wrap gap-1.5 ${showHeader ? 'mt-3' : ''}`} aria-label="Report builder steps">
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
        </div>
        <p className="text-xs font-medium text-neutral-500 tabular-nums shrink-0">
          {selectedCount} of {blocks.length} sections
        </p>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="report-builder-title" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Report title
              </label>
              <input
                id="report-builder-title"
                type="text"
                className="pmss-input"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="e.g. August 2026 Ministry Summary"
              />
            </div>
            <div>
              <label
                htmlFor="report-builder-subtitle"
                className="block text-sm font-medium text-neutral-700 mb-1.5"
              >
                Subtitle / notes <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <input
                id="report-builder-subtitle"
                type="text"
                className="pmss-input"
                value={subtitle ?? ''}
                onChange={(e) => onSubtitleChange?.(e.target.value)}
                placeholder="e.g. For leadership meeting · Confidential"
              />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
              Sign-off (printed on every PDF)
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-emerald-800">Prepared by</p>
                <div>
                  <label htmlFor="report-prepared-name" className="block text-xs font-medium text-neutral-600 mb-1">
                    Name
                  </label>
                  <input
                    id="report-prepared-name"
                    type="text"
                    className="pmss-input"
                    value={signatories.preparedByName ?? ''}
                    onChange={(e) => setSign('preparedByName', e.target.value)}
                    placeholder="Enter preparer name"
                    disabled={!onSignatoriesChange}
                  />
                </div>
                <div>
                  <label htmlFor="report-prepared-role" className="block text-xs font-medium text-neutral-600 mb-1">
                    Role
                  </label>
                  <input
                    id="report-prepared-role"
                    type="text"
                    className="pmss-input"
                    value={signatories.preparedByRole ?? ''}
                    onChange={(e) => setSign('preparedByRole', e.target.value)}
                    placeholder="e.g. Coordinator"
                    disabled={!onSignatoriesChange}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-emerald-800">Approved by</p>
                <div>
                  <label htmlFor="report-approved-name" className="block text-xs font-medium text-neutral-600 mb-1">
                    Name
                  </label>
                  <input
                    id="report-approved-name"
                    type="text"
                    className="pmss-input"
                    value={signatories.approvedByName ?? ''}
                    onChange={(e) => setSign('approvedByName', e.target.value)}
                    placeholder="Enter approver name"
                    disabled={!onSignatoriesChange}
                  />
                </div>
                <div>
                  <label htmlFor="report-approved-role" className="block text-xs font-medium text-neutral-600 mb-1">
                    Role
                  </label>
                  <input
                    id="report-approved-role"
                    type="text"
                    className="pmss-input"
                    value={signatories.approvedByRole ?? ''}
                    onChange={(e) => setSign('approvedByRole', e.target.value)}
                    placeholder="e.g. President"
                    disabled={!onSignatoriesChange}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          {presets.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Presets</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.description}
                    className={`pmss-btn-chip text-left ${
                      activePreset === p.id ? 'pmss-btn-chip-primary' : 'pmss-btn-chip-secondary'
                    }`}
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="pmss-btn-chip pmss-btn-chip-secondary" onClick={() => setAll(true)}>
                Select all
              </button>
              <button type="button" className="pmss-btn-chip pmss-btn-chip-secondary" onClick={() => setAll(false)}>
                Clear all
              </button>
            </div>
            <input
              type="search"
              className="pmss-input sm:ml-auto sm:max-w-xs"
              placeholder="Search sections…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search report sections"
            />
          </div>

          <div className="space-y-2">
            {filteredGroups.map((g) => {
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
                        <span className="ml-2 text-xs font-medium text-neutral-400 tabular-nums">
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
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 p-3 border-t border-neutral-100">
                      {g.blocks.map((b) => (
                        <label
                          key={b.id}
                          className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                            include[b.id]
                              ? 'border-primary-200 bg-primary-50/60 text-neutral-900'
                              : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-600"
                            checked={Boolean(include[b.id])}
                            onChange={() => toggle(b.id)}
                          />
                          <span className="min-w-0">
                            <span className="font-medium block leading-snug">{b.label}</span>
                            {b.description && (
                              <span className="block text-xs text-neutral-500 mt-0.5 leading-snug">
                                {b.description}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {filteredGroups.length === 0 && (
              <p className="text-sm text-neutral-500">No sections match “{query}”.</p>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-3">Open one group at a time to pick sections.</p>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3 mb-4 text-sm text-neutral-600">
            <p>
              <span className="font-semibold text-neutral-900">{title.trim() || 'Report'}</span>
              {subtitle?.trim() ? ` — ${subtitle.trim()}` : ''}
            </p>
            <p className="text-xs mt-1 tabular-nums">{selectedCount} of {blocks.length} sections selected</p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mr-1">Export</span>
            <button
              type="button"
              className="pmss-btn-secondary text-sm h-9"
              disabled={disabled || selectedCount === 0}
              onClick={() => onExport('pdf')}
            >
              PDF
            </button>
            <button
              type="button"
              className="pmss-btn-secondary text-sm h-9"
              disabled={disabled || selectedCount === 0}
              onClick={() => onExport('excel')}
            >
              Excel
            </button>
            <button
              type="button"
              className="pmss-btn-secondary text-sm h-9"
              disabled={disabled || selectedCount === 0}
              onClick={() => onExport('csv')}
            >
              CSV
            </button>
            {selectedCount === 0 && (
              <span className="text-xs text-amber-700">Select at least one section to export.</span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-6 pt-4 border-t border-neutral-100">
        <button type="button" className="pmss-btn-secondary text-sm h-9" disabled={step === 0} onClick={goBack}>
          Back
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className="pmss-btn-primary text-sm h-9" onClick={goNext}>
            Continue
          </button>
        ) : (
          <span className="text-xs text-neutral-500">Choose a format above to download.</span>
        )}
      </div>
    </section>
  )
}
