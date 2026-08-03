/**
 * Brand themes (A/B) + light/dark color mode.
 */

export const THEME_STORAGE_KEY = 'pmss-ui-theme'
export const COLOR_MODE_STORAGE_KEY = 'pmss-color-mode'

export const THEMES = {
  a: {
    id: 'a',
    label: 'Ministry navy',
    short: 'Navy workspace with green accents — default for leadership use.',
  },
  b: {
    id: 'b',
    label: 'Cream & gold',
    short: 'Softer cream surfaces with gold accents for a lighter feel.',
  },
}

export const COLOR_MODES = {
  light: { id: 'light', label: 'Light' },
  dark: { id: 'dark', label: 'Dark' },
}

/** One-time: return to Option A after B preview (respects Settings afterward). */
const RESTORE_OPTION_A_FLAG = 'pmss-ui-theme-restored-a-v1'

export function readStoredTheme() {
  try {
    if (!localStorage.getItem(RESTORE_OPTION_A_FLAG)) {
      localStorage.setItem(THEME_STORAGE_KEY, 'a')
      localStorage.removeItem('pmss-ui-theme-switched-to-b-v1')
      localStorage.setItem(RESTORE_OPTION_A_FLAG, '1')
    }
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'a' || v === 'b') return v
  } catch {
    /* ignore */
  }
  return 'a'
}

export function readStoredColorMode() {
  try {
    const v = localStorage.getItem(COLOR_MODE_STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    /* ignore */
  }
  return 'light'
}

export function applyThemeToDocument(themeId) {
  const id = themeId === 'b' ? 'b' : 'a'
  document.documentElement.dataset.theme = id
}

export function applyColorModeToDocument(mode) {
  const next = mode === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.colorMode = next
  document.documentElement.style.colorScheme = next
}
