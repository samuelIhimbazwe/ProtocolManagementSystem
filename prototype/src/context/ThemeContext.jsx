import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  THEMES,
  COLOR_MODES,
  THEME_STORAGE_KEY,
  COLOR_MODE_STORAGE_KEY,
  applyThemeToDocument,
  applyColorModeToDocument,
  readStoredTheme,
  readStoredColorMode,
} from '../theme/themeConfig.js'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(readStoredTheme)
  const [colorMode, setColorModeState] = useState(readStoredColorMode)

  useEffect(() => {
    applyThemeToDocument(themeId)
  }, [themeId])

  useEffect(() => {
    applyColorModeToDocument(colorMode)
  }, [colorMode])

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

  const setColorMode = useCallback((mode) => {
    const next = mode === 'dark' ? 'dark' : 'light'
    setColorModeState(next)
    applyColorModeToDocument(next)
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleColorMode = useCallback(() => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark')
  }, [colorMode, setColorMode])

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
      themes: THEMES,
      isFlowerTheme: themeId === 'b',
      colorMode,
      setColorMode,
      toggleColorMode,
      colorModes: COLOR_MODES,
      isDark: colorMode === 'dark',
    }),
    [themeId, setThemeId, colorMode, setColorMode, toggleColorMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
