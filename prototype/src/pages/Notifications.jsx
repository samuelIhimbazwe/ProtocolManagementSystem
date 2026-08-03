import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Badge } from '../layouts/AppShell'
import { USE_API } from '../api/config'
import { fetchNotifications, markNotificationsRead } from '../api/schedule'
import { NOTIFICATIONS } from '../data/mock'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS)
  const [loading, setLoading] = useState(USE_API)

  useEffect(() => {
    if (!USE_API) return
    setLoading(true)
    fetchNotifications()
      .then((d) => {
        if (d.notifications) setNotifications(d.notifications)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => n.unread && n.id != null).map((n) => n.id)
    if (!USE_API || unreadIds.length === 0) {
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
      return
    }
    try {
      await markNotificationsRead(unreadIds)
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Notifications"
        description="Ministry alerts and schedule updates"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="pmss-btn-secondary text-sm h-9" onClick={markAllRead}>
              Mark all read
            </button>
            <Link to="/" className="text-sm text-primary-600 font-medium">
              ← Dashboard
            </Link>
          </div>
        }
      />

      <div className="pmss-card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-neutral-500">Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No notifications.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {notifications.map((n, i) => (
              <li key={n.id ?? i} className={`px-5 py-4 ${n.unread ? 'bg-primary-50/40' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                      {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary-600 shrink-0" />}
                      {n.title}
                    </p>
                    <p className="text-sm text-neutral-500 mt-1">{n.body}</p>
                  </div>
                  {n.unread ? <Badge variant="primary">New</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
