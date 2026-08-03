import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { USE_API, setAuthToken } from '../api/client'
import * as api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [pilotToday, setPilotToday] = useState(null)
  const [officeAccess, setOfficeAccess] = useState(null)
  const [loading, setLoading] = useState(USE_API)

  const applySession = useCallback((data) => {
    if (data?.user) setUser(data.user)
    if (data?.pilotToday) setPilotToday(data.pilotToday)
    if (data?.officeAccess) setOfficeAccess(data.officeAccess)
  }, [])

  const refresh = useCallback(async () => {
    if (!USE_API) {
      setLoading(false)
      return
    }
    try {
      const data = await api.fetchMe()
      applySession(data)
    } catch {
      setAuthToken(null)
      setUser(null)
      setPilotToday(null)
      setOfficeAccess(null)
    } finally {
      setLoading(false)
    }
  }, [applySession])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(
    async (username, password) => {
      const data = await api.login(username, password)
      applySession(data)
      return data.user
    },
    [applySession],
  )

  const logout = useCallback(() => {
    setAuthToken(null)
    setUser(null)
    setPilotToday(null)
    setOfficeAccess(null)
  }, [])

  const value = useMemo(
    () => ({
      useApi: USE_API,
      user,
      pilotToday,
      officeAccess,
      loading,
      isAuthenticated: USE_API ? Boolean(user) : true,
      login,
      logout,
      refresh,
    }),
    [user, pilotToday, officeAccess, loading, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
