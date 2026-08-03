import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { USE_API } from '../api/config'
import { useAuth } from './AuthContext'
import * as scheduleApi from '../api/schedule'
import {
  SERVICES,
  TEAM_ASSIGNMENTS,
  CHOIR_ASSIGNMENTS,
  LEADERSHIP,
  VALIDATION_ROWS,
  VALIDATION_SUMMARY,
} from '../data/mock'

const ScheduleContext = createContext(null)

const demoPayload = () => ({
  monthKey: '2026-08',
  monthLabel: 'August 2026',
  services: SERVICES,
  choirAssignments: CHOIR_ASSIGNMENTS,
  teamAssignments: TEAM_ASSIGNMENTS,
  leadershipReview: LEADERSHIP,
  validationRows: VALIDATION_ROWS,
  validationSummary: VALIDATION_SUMMARY,
})

export function ScheduleProvider({ children }) {
  const { isAuthenticated, useApi, refresh: refreshAuth } = useAuth()
  const [loading, setLoading] = useState(useApi)
  const [source, setSource] = useState('demo')
  const [editable, setEditable] = useState(false)
  const [payload, setPayload] = useState(() => (useApi ? null : demoPayload()))
  const saveTimer = useRef(null)

  const refresh = useCallback(async () => {
    if (!USE_API || !isAuthenticated) {
      setPayload(demoPayload())
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await scheduleApi.fetchCurrentSchedule()
      setPayload(data.payload)
      setSource(data.source)
      setEditable(Boolean(data.editable))
      await refreshAuth()
    } catch {
      setPayload(demoPayload())
      setSource('demo-fallback')
      setEditable(false)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, refreshAuth])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!USE_API || !isAuthenticated) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isAuthenticated, refresh])

  const persistDraft = useCallback((nextPayload) => {
    if (!USE_API || !editable) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      scheduleApi.saveScheduleDraft(nextPayload).catch(() => {})
    }, 700)
  }, [editable])

  const updatePayload = useCallback(
    (updater) => {
      setPayload((prev) => {
        const base = prev ?? demoPayload()
        const next = typeof updater === 'function' ? updater(base) : { ...base, ...updater }
        persistDraft(next)
        return next
      })
    },
    [persistDraft],
  )

  const value = useMemo(
    () => ({
      loading,
      source,
      editable,
      payload: payload ?? demoPayload(),
      teamAssignments: (payload ?? demoPayload()).teamAssignments ?? TEAM_ASSIGNMENTS,
      services: (payload ?? demoPayload()).services ?? SERVICES,
      refresh,
      updatePayload,
    }),
    [loading, source, editable, payload, refresh, updatePayload],
  )

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider')
  return ctx
}
