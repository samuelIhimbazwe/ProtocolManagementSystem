/**
 * Option A — frozen baseline (also applied via CSS when data-theme="a").
 * Option B — flower-inspired cream / gold / taupe.
 */

export const THEME_STORAGE_KEY = 'pmss-ui-theme'

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

export function applyThemeToDocument(themeId) {
  const id = themeId === 'b' ? 'b' : 'a'
  document.documentElement.dataset.theme = id
}
