import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { USE_API } from '../api/config'
import { useAuth } from './AuthContext'
import { fetchMembers } from '../api/schedule'
import { MEMBERS } from '../data/mock'

const MembersContext = createContext(null)

export function MembersProvider({ children }) {
  const { isAuthenticated, useApi } = useAuth()
  const [members, setMembers] = useState(USE_API ? [] : MEMBERS)
  const [loading, setLoading] = useState(USE_API && useApi)

  const refresh = useCallback(async () => {
    if (!USE_API || !isAuthenticated) {
      setMembers(MEMBERS)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchMembers()
      setMembers(data.members ?? [])
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    refresh()
  }, [refresh])

  const getMemberById = useCallback(
    (id) => members.find((m) => String(m.id) === String(id)) ?? null,
    [members],
  )

  const value = useMemo(
    () => ({ members, loading, refresh, getMemberById }),
    [members, loading, refresh, getMemberById],
  )

  return <MembersContext.Provider value={value}>{children}</MembersContext.Provider>
}

export function useMembers() {
  const ctx = useContext(MembersContext)
  if (!ctx) throw new Error('useMembers must be used within MembersProvider')
  return ctx
}
