import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { USE_API } from '../api/config'
import { fetchNotifications, markNotificationsRead } from '../api/schedule'
import { NOTIFICATIONS } from '../data/mock'

const PREVIEW = 6

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(NOTIFICATIONS)
  const rootRef = useRef(null)

  const load = useCallback(async () => {
    if (!USE_API) {
      setItems(NOTIFICATIONS)
      return
    }
    try {
      const data = await fetchNotifications()
      if (data.notifications) setItems(data.notifications)
    } catch {
      /* keep previous */
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = items.filter((n) => n.unread)
  const unreadCount = unread.length
  const preview = items.slice(0, PREVIEW)

  const openPanel = async () => {
    const next = !open
    setOpen(next)
    if (!next) return

    let list = items
    if (USE_API) {
      try {
        const data = await fetchNotifications()
        if (data.notifications) {
          list = data.notifications
          setItems(list)
        }
      } catch {
        /* keep previous */
      }
    }

    const unreadIds = list.filter((n) => n.unread && n.id != null).map((n) => n.id)
    if (unreadIds.length === 0) return

    if (USE_API) {
      try {
        await markNotificationsRead(unreadIds)
        setItems((prev) => prev.map((n) => ({ ...n, unread: false })))
      } catch {
        /* ignore */
      }
    } else {
      setItems((prev) => prev.map((n) => ({ ...n, unread: false })))
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
        onClick={openPanel}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 w-[min(100vw-2rem,20rem)] rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden"
          role="menu"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-100">
            <p className="text-sm font-semibold text-neutral-900">Notifications</p>
            <button
              type="button"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
              onClick={() => {
                setOpen(false)
                navigate('/notifications')
              }}
            >
              View all
            </button>
          </div>

          {preview.length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-500 text-center">No notifications</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
              {preview.map((n, i) => (
                <li key={n.id ?? i}>
                  <button
                    type="button"
                    role="menuitem"
                    className={`w-full text-left px-3 py-2.5 hover:bg-neutral-50 ${n.unread ? 'bg-primary-50/50' : ''}`}
                    onClick={() => {
                      setOpen(false)
                      navigate('/notifications')
                    }}
                  >
                    <p className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                      {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary-600 shrink-0" />}
                      {n.title}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{n.body}</p>
                    {n.createdAt && (
                      <p className="text-[10px] text-neutral-400 mt-1 tabular-nums">
                        {String(n.createdAt).slice(0, 10)}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-neutral-100 px-3 py-2 bg-neutral-50">
            <Link
              to="/notifications"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
              onClick={() => setOpen(false)}
            >
              Open notifications page →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
