import ColorModeToggle from './ColorModeToggle'
import { useTheme } from '../context/ThemeContext'

export default function ThemePicker() {
  const { themeId, setThemeId, themes } = useTheme()

  return (
    <section className="pmss-card p-5 mb-6 space-y-6">
      <div>
        <h2 className="font-semibold text-neutral-900 mb-1">Color mode</h2>
        <p className="text-sm text-neutral-500 mb-3">
          Switch between light and dark. Saved on this device.
        </p>
        <ColorModeToggle variant="segmented" />
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-1">Brand look</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Choose the workspace style. Your preference is saved on this device.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.values(themes).map((t) => {
            const active = themeId === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  active
                    ? 'border-primary-600 bg-primary-50/80 ring-1 ring-primary-200 shadow-sm'
                    : 'border-neutral-200 hover:border-neutral-300 bg-[var(--pmss-surface)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm text-neutral-900">{t.label}</p>
                  {active && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 bg-[var(--pmss-surface)]/80 px-2 py-0.5 rounded-full border border-primary-100">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">{t.short}</p>
                <div className="flex gap-1.5 mt-3 h-2 rounded-full overflow-hidden max-w-[8rem]">
                  <span
                    className="flex-1"
                    style={{ background: t.id === 'b' ? '#F7F7F5' : '#F3F4F6' }}
                  />
                  <span
                    className="flex-1"
                    style={{ background: t.id === 'b' ? '#1a1a1a' : '#243b53' }}
                  />
                  <span
                    className="flex-1"
                    style={{ background: t.id === 'b' ? '#C4A035' : '#2D6A4F' }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
