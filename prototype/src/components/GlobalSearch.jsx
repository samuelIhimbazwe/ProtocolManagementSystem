import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useMembers } from '../context/MembersContext'
import { useSchedule } from '../context/ScheduleContext'
import { useRole } from '../context/RoleContext'
import { USE_API } from '../api/config'
import { fetchUserAccounts } from '../api/client'
import { loadUserAccounts } from '../data/userAccounts'
import { loadRuleConfiguration } from '../data/rules'
import {
  buildGlobalSearchResults,
  countSearchHits,
  firstSearchHit,
} from '../lib/globalSearchIndex'

export default function GlobalSearch() {
  const navigate = useNavigate()
  const { members } = useMembers()
  const { payload } = useSchedule()
  const { permissions } = useRole()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState(() =>
    permissions.viewUsers && !USE_API ? loadUserAccounts() : [],
  )
  const [rules] = useState(() => loadRuleConfiguration())
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!permissions.viewUsers) {
      setAccounts([])
      return
    }
    if (!USE_API) {
      setAccounts(loadUserAccounts())
      return
    }
    let cancelled = false
    fetchUserAccounts()
      .then((d) => {
        if (!cancelled) setAccounts(d.users ?? d.accounts ?? [])
      })
      .catch(() => {
        if (!cancelled) setAccounts([])
      })
    return () => {
      cancelled = true
    }
  }, [permissions.viewUsers])

  const q = query.trim()
  const groups = useMemo(
    () =>
      buildGlobalSearchResults(q, {
        members,
        payload,
        permissions,
        accounts,
        rules,
      }),
    [q, members, payload, permissions, accounts, rules],
  )
  const total = countSearchHits(groups)
  const showPanel = open && q.length > 0

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (path) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  return (
    <div className="relative flex-1 max-w-md hidden sm:block" ref={rootRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            const first = firstSearchHit(groups)
            if (!first) return
            e.preventDefault()
            go(first.to)
          }}
          placeholder="Search members, services, pages…"
          className="pmss-input pl-9 h-9 bg-neutral-50/80 border-neutral-200/80 focus:bg-white"
          aria-label="Global search"
          aria-expanded={showPanel}
          aria-controls="pmss-global-search-results"
          autoComplete="off"
        />
      </div>

      {showPanel && (
        <div
          id="pmss-global-search-results"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden max-h-[24rem] overflow-y-auto"
          role="listbox"
        >
          {total === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">No matches for “{q}”</p>
          ) : (
            groups.map((g) => (
              <ResultGroup key={g.group} title={g.group}>
                {g.items.map((item) => {
                  const Icon = item.Icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 flex items-start gap-2.5"
                      onClick={() => go(item.to)}
                    >
                      {Icon ? <Icon className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" /> : null}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-neutral-900 truncate">{item.title}</span>
                        {item.subtitle && (
                          <span className="block text-[11px] text-neutral-500 truncate">{item.subtitle}</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </ResultGroup>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ResultGroup({ title, children }) {
  return (
    <div className="border-b border-neutral-100 last:border-0">
      <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {title}
      </p>
      {children}
    </div>
  )
}
