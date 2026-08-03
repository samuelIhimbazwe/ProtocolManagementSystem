import { NavLink } from 'react-router-dom'
import { useRole } from '../context/RoleContext'

export default function MembersSubnav() {
  const { permissions } = useRole()
  if (!permissions.viewUsers) return null

  const tabClass = ({ isActive }) =>
    `px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
      isActive
        ? 'bg-white text-primary-800 shadow-sm ring-1 ring-neutral-200/80'
        : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
    }`

  return (
    <nav
      className="inline-flex flex-wrap gap-1 mb-6 p-1 rounded-xl bg-neutral-100/80 border border-neutral-200/80 pmss-no-print"
      aria-label="Members section"
    >
      <NavLink to="/members" end className={tabClass}>
        Roster
      </NavLink>
      <NavLink to="/members/accounts" className={tabClass}>
        User accounts
      </NavLink>
    </nav>
  )
}
