import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../layouts/AppShell'
import { USE_API } from '../api/config'
import { fetchDashboardActivity } from '../api/schedule'
import { ACTIVITIES } from '../data/mock'

export default function ActivityPage() {
  const [activity, setActivity] = useState(ACTIVITIES)
  const [loading, setLoading] = useState(USE_API)

  useEffect(() => {
    if (!USE_API) return
    setLoading(true)
    fetchDashboardActivity(50)
      .then((d) => {
        if (d.activity?.length) {
          setActivity(
            d.activity.map((a) => ({
              text: a.text,
              time: a.time?.slice(0, 10) ?? a.time ?? 'Recent',
            })),
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Recent activity"
        description="Audit trail of sign-ins, schedule changes, and account events"
        actions={
          <Link to="/" className="text-sm text-primary-600 font-medium">
            ← Dashboard
          </Link>
        }
      />

      <div className="pmss-card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-neutral-500">Loading activity…</p>
        ) : activity.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {activity.map((a, i) => (
              <li key={i} className="px-5 py-3.5 flex justify-between gap-4">
                <p className="text-sm text-neutral-800">{a.text}</p>
                <p className="text-xs text-neutral-400 shrink-0 tabular-nums">{a.time}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
