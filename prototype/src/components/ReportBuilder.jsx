import { useMemo, useState } from 'react'
import { groupBlocks } from '../lib/reportBuilder'

/**
 * Comprehensive report builder: title, notes, presets, grouped sections, exports.
 */
export default function ReportBuilder({
  title,
  onTitleChange,
  subtitle,
  onSubtitleChange,
  blocks,
  include,
  onIncludeChange,
  presets = [],
  onExport,
  disabled,
  hint,
}) {
  const [query, setQuery] = useState('')
  const [activePreset, setActivePreset] = useState('full')

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

  return (
    <section className="pmss-card p-5 mb-6 pmss-no-print">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-neutral-900">Report builder</h2>
          <p className="text-sm text-neutral-500 mt-1">
            {hint ??
              'Build a custom report: set the title, pick a preset or fine-tune every section, then export.'}
          </p>
        </div>
        <p className="text-xs font-medium text-neutral-500 tabular-nums shrink-0">
          {selectedCount} of {blocks.length} sections
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
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
          <label htmlFor="report-builder-subtitle" className="block text-sm font-medium text-neutral-700 mb-1.5">
            Subtitle / notes <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            id="report-builder-subtitle"
            type="text"
            className="pmss-input"
            value={subtitle ?? ''}
            onChange={(e) => onSubtitleChange?.(e.target.value)}
            placeholder="e.g. Prepared for leadership meeting · Confidential"
          />
        </div>
      </div>

      {presets.length > 0 && (
        <div className="mb-5">
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

      <div className="space-y-5 mb-5">
        {filteredGroups.map((g) => {
          const selectedInGroup = g.blocks.filter((b) => include[b.id]).length
          const allOn = selectedInGroup === g.blocks.length && g.blocks.length > 0
          return (
            <div key={g.name}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-neutral-800">
                  {g.name}
                  <span className="ml-2 text-xs font-medium text-neutral-400 tabular-nums">
                    {selectedInGroup}/{g.blocks.length}
                  </span>
                </h3>
                <button
                  type="button"
                  className="text-xs font-medium text-primary-700 hover:text-primary-800"
                  onClick={() => setGroup(g.name, !allOn)}
                >
                  {allOn ? 'Clear group' : 'Select group'}
                </button>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
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
            </div>
          )
        })}
        {filteredGroups.length === 0 && (
          <p className="text-sm text-neutral-500">No sections match “{query}”.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center border-t border-neutral-100 pt-4">
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
    </section>
  )
}
