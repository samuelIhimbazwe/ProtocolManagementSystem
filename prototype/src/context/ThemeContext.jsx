import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  THEMES,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  readStoredTheme,
} from '../theme/themeConfig.js'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(readStoredTheme)

  useEffect(() => {
    applyThemeToDocument(themeId)
  }, [themeId])

  const setThemeId = useCallback((id) => {
    const next = id === 'b' ? 'b' : 'a'
    setThemeIdState(next)
    applyThemeToDocument(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
      themes: THEMES,
      isFlowerTheme: themeId === 'b',
    }),
    [themeId, setThemeId],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
