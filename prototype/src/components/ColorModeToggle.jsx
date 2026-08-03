import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

/** Compact top-bar / menu toggle for light ↔ dark. */
export default function ColorModeToggle({ variant = 'icon', className = '', onSelect }) {
  const { colorMode, setColorMode, toggleColorMode, isDark } = useTheme()

  const afterToggle = () => {
    onSelect?.()
  }

  if (variant === 'menu') {
    return (
      <button
        type="button"
        role="menuitem"
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 ${className}`}
        onClick={() => {
          toggleColorMode()
          afterToggle()
        }}
      >
        {isDark ? <Sun className="w-4 h-4 text-neutral-400" /> : <Moon className="w-4 h-4 text-neutral-400" />}
        {isDark ? 'Light mode' : 'Dark mode'}
      </button>
    )
  }

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50 ${className}`}
        role="group"
        aria-label="Color mode"
      >
        <button
          type="button"
          onClick={() => setColorMode('light')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            !isDark ? 'bg-[var(--pmss-surface)] text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          Light
        </button>
        <button
          type="button"
          onClick={() => setColorMode('dark')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            isDark ? 'bg-[var(--pmss-surface)] text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          Dark
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleColorMode}
      className={`p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      <span className="sr-only">{colorMode} mode</span>
    </button>
  )
}
