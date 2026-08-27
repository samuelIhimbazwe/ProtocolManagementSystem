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
  choirStatus: 'published',
  choirPublishedAt: '2026-08-01T12:00:00.000Z',
  choirPublishedBy: 'Choir Scheduler',
  validationRows: VALIDATION_ROWS,
  validationSummary: VALIDATION_SUMMARY,
})

export function ScheduleProvider({ children }) {
  const { isAuthenticated, useApi, refresh: refreshAuth } = useAuth()
  const [loading, setLoading] = useState(useApi)
  const [source, setSource] = useState('demo')
  const [editable, setEditable] = useState(false)
  const [editableChoir, setEditableChoir] = useState(false)
  const [editableTeams, setEditableTeams] = useState(false)
  const [payload, setPayload] = useState(() => (useApi ? null : demoPayload()))
  const [monthsMeta, setMonthsMeta] = useState(null)
  const [visibility, setVisibility] = useState('public')
  const [isPublic, setIsPublic] = useState(true)
  const [publishedMeta, setPublishedMeta] = useState(null)
  const activeMonthRef = useRef(null)
  const saveTimer = useRef(null)
  const pendingPayload = useRef(null)

  const applyScheduleResponse = useCallback((data) => {
    const monthKey = data.monthKey ?? data.payload?.monthKey ?? null
    const payload = data.payload
      ? { ...data.payload, monthKey, monthLabel: data.payload.monthLabel || data.payload.monthKey }
      : data.payload
    setPayload(payload)
    setSource(data.source)
    setEditable(Boolean(data.editable))
    setEditableChoir(Boolean(data.editableChoir ?? data.editable))
    setEditableTeams(Boolean(data.editableTeams ?? data.editable))
    setVisibility(data.visibility ?? (data.source === 'published' ? 'public' : 'draft'))
    setIsPublic(Boolean(data.isPublic))
    setPublishedMeta(data.published ?? null)
    activeMonthRef.current = monthKey
    if (data.months || data.liveMonthKey) {
      setMonthsMeta({
        liveMonthKey: data.liveMonthKey,
        nextMonthKey: data.nextMonthKey,
        months: data.months ?? [],
      })
    }
  }, [])

  const refresh = useCallback(
    async (monthKey) => {
      if (!USE_API || !isAuthenticated) {
        setPayload(demoPayload())
        setEditable(true)
        setEditableChoir(true)
        setEditableTeams(true)
        setMonthsMeta({
          liveMonthKey: '2026-08',
          nextMonthKey: '2026-09',
          months: [
            {
              monthKey: '2026-08',
              monthLabel: 'August 2026',
              isLive: true,
              visible: true,
              visibility: 'public',
              hasDraft: true,
            },
          ],
        })
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const target = monthKey || activeMonthRef.current || undefined
        const [data, catalog] = await Promise.all([
          scheduleApi.fetchCurrentSchedule(target),
          scheduleApi.fetchScheduleMonths().catch(() => null),
        ])
        if (catalog) {
          setMonthsMeta({
            liveMonthKey: catalog.liveMonthKey,
            nextMonthKey: catalog.nextMonthKey,
            months: catalog.months ?? [],
          })
        }
        applyScheduleResponse(data)
        await refreshAuth()
      } catch {
        setPayload(demoPayload())
        setSource('demo-fallback')
        setEditable(false)
      } finally {
        setLoading(false)
      }
    },
    [isAuthenticated, refreshAuth, applyScheduleResponse],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!USE_API || !isAuthenticated) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh(activeMonthRef.current)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isAuthenticated, refresh])

  const flushDraft = useCallback(async () => {
    if (!USE_API || !editable || !pendingPayload.current) return
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const toSave = pendingPayload.current
    pendingPayload.current = null
    try {
      await scheduleApi.saveScheduleDraft(toSave)
    } catch {
      /* ignore */
    }
  }, [editable])

  const persistDraft = useCallback(
    (nextPayload) => {
      if (!USE_API || !editable) return
      pendingPayload.current = nextPayload
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const toSave = pendingPayload.current
        pendingPayload.current = null
        if (toSave) scheduleApi.saveScheduleDraft(toSave).catch(() => {})
      }, 700)
    },
    [editable],
  )

  const persistNow = useCallback(async (nextPayload) => {
    if (!USE_API || !nextPayload) return
    pendingPayload.current = null
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await scheduleApi.saveScheduleDraft(nextPayload)
  }, [])

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

  const switchMonth = useCallback(
    async (monthKey) => {
      if (!monthKey || monthKey === activeMonthRef.current) return
      await flushDraft()
      await refresh(monthKey)
    },
    [flushDraft, refresh],
  )

  const value = useMemo(
    () => ({
      loading,
      source,
      editable,
      editableChoir,
      editableTeams,
      payload: payload ?? demoPayload(),
      teamAssignments: (payload ?? demoPayload()).teamAssignments ?? TEAM_ASSIGNMENTS,
      services: (payload ?? demoPayload()).services ?? SERVICES,
      monthsMeta,
      visibility,
      isPublic,
      publishedMeta,
      activeMonthKey: activeMonthRef.current ?? payload?.monthKey ?? null,
      refresh,
      switchMonth,
      flushDraft,
      persistNow,
      updatePayload,
    }),
    [
      loading,
      source,
      editable,
      editableChoir,
      editableTeams,
      payload,
      monthsMeta,
      visibility,
      isPublic,
      publishedMeta,
      refresh,
      switchMonth,
      flushDraft,
      persistNow,
      updatePayload,
    ],
  )

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider')
  return ctx
}
