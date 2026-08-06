import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  CalendarDays,
  BarChart3,
  Settings,
  Menu,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  LogOut,
  Church,
  Wallet,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, Navigate, useNavigate, Link } from 'react-router-dom'
import { NAV_ITEMS, MOBILE_NAV, MEMBERS } from '../data/mock'
import { useRole } from '../context/RoleContext'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../data/roles'
import { canRecordAttendance } from '../data/memberAttendance'
import GlobalSearch from '../components/GlobalSearch'
import NotificationBell from '../components/NotificationBell'
import ForcePasswordChangeModal from '../components/ForcePasswordChangeModal'
import ColorModeToggle from '../components/ColorModeToggle'

const SIDEBAR_COLLAPSED_KEY = 'pmss-sidebar-collapsed'

const iconMap = {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  CalendarDays,
  BarChart3,
  Settings,
  Menu,
  Wallet,
}

function NavIcon({ name }) {
  const Icon = iconMap[name] || LayoutDashboard
  return <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
}

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function initialsFrom(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0] ?? 'U').slice(0, 2).toUpperCase()
}

function AccountMenu({ displayName, roleLabel, onSignOut, canSignOut }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

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

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg hover:bg-neutral-100/80 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold flex items-center justify-center ring-1 ring-primary-200/60">
          {initialsFrom(displayName)}
        </span>
        <span className="hidden md:flex flex-col items-start min-w-0 max-w-[9.5rem]">
          <span className="text-xs font-semibold text-neutral-900 truncate w-full leading-tight">
            {displayName}
          </span>
          <span className="text-[10px] text-neutral-500 truncate w-full leading-tight">{roleLabel}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 hidden sm:block transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-neutral-200 bg-white shadow-lg z-50 overflow-hidden"
          role="menu"
        >
          <div className="px-3.5 py-3 border-b border-neutral-100 bg-neutral-50/80">
            <p className="text-sm font-semibold text-neutral-900 truncate">{displayName}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{roleLabel}</p>
          </div>
          <div className="p-1.5">
            <ColorModeToggle variant="menu" onSelect={() => setOpen(false)} />
            <Link
              to="/settings"
              role="menuitem"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={() => setOpen(false)}
            >
              <Settings className="w-4 h-4 text-neutral-400" />
              Settings
            </Link>
            {canSignOut && (
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-red-700 hover:bg-red-50"
                onClick={() => {
                  setOpen(false)
                  onSignOut()
                }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AppShell() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { roleId, setRoleId, permissions, memberId, setMemberId, member, demoMode, authUser } = useRole()
  const location = useLocation()
  const roleLabel = ROLES.find((r) => r.id === roleId)?.label ?? 'User'
  const protocolMembers = MEMBERS.filter((m) => m.role === 'Member')
  const displayName =
    authUser?.displayName ?? (roleId === 'member' && member?.name ? member.name : roleLabel)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const navItems = NAV_ITEMS.filter((item) => permissions.nav.includes(item.to))
  const mobileItems = MOBILE_NAV.filter((item) => permissions.mobileNav.includes(item.to))

  const pathAllowed =
    permissions.nav.includes(location.pathname) ||
    location.pathname === '/settings' ||
    location.pathname === '/activity' ||
    location.pathname === '/notifications' ||
    location.pathname === '/office-reports' ||
    location.pathname.startsWith('/finance') ||
    (location.pathname.startsWith('/members/') && permissions.nav.includes('/members')) ||
    (location.pathname === '/attendance/record' && canRecordAttendance(roleId, permissions)) ||
    (location.pathname.startsWith('/attendance/') &&
      location.pathname !== '/attendance/record' &&
      permissions.nav.includes('/attendance'))

  if (!pathAllowed) {
    return <Navigate to="/" replace />
  }

  const signOut = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="pmss-app-shell min-h-screen flex flex-col md:flex-row">
      <aside
        className={`pmss-sidebar hidden md:flex md:flex-col shrink-0 pmss-no-print transition-[width] duration-200 ease-out ${
          sidebarCollapsed ? 'w-[4.25rem]' : 'w-[15.5rem]'
        }`}
      >
        <div
          className={`h-14 flex items-center border-b border-white/10 ${
            sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
          }`}
        >
          <div className="pmss-brand-mark w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
            <Church className="w-5 h-5" strokeWidth={1.75} />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="pmss-brand-title text-sm font-semibold leading-tight text-white tracking-wide">PMSS</p>
              <p className="pmss-brand-eyebrow text-[10px] text-white/55 leading-tight truncate">
                Protocol Ministry
              </p>
            </div>
          )}
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
        <nav className={`flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={sidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `pmss-nav-item flex items-center rounded-lg text-sm font-medium transition-colors ${
                  sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'is-active bg-white/12 text-white shadow-sm'
                    : 'text-white/65 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <NavIcon name={item.icon} />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div
          className={`border-t border-white/10 pmss-sidebar-footer ${
            sidebarCollapsed ? 'px-2 py-2 flex justify-center' : 'px-4 py-3'
          }`}
        >
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-2 rounded-lg text-white/55 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <p className="pmss-sidebar-footer-text text-[10px] text-white/40 leading-relaxed">
              ADEPR Kacyiru · Internal
            </p>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="pmss-topbar h-14 shrink-0 bg-white/95 backdrop-blur-sm border-b border-neutral-200/90 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 pmss-no-print sticky top-0 z-40">
          <div className="md:hidden flex items-center gap-2 shrink-0">
            <div className="pmss-brand-mark w-8 h-8 rounded-lg bg-primary-700 flex items-center justify-center text-white">
              <Church className="w-4 h-4" strokeWidth={2} />
            </div>
            <span className="pmss-brand-title font-semibold text-sm text-neutral-900">PMSS</span>
          </div>
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:inline-flex p-2 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors shrink-0"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <GlobalSearch />
          <div className="flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
            {demoMode && (
              <select
                className="hidden lg:block text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-700 max-w-[140px]"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                aria-label="Preview role"
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}
            {demoMode && roleId === 'member' && (
              <select
                className="hidden xl:block text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-700 max-w-[180px]"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                aria-label="Preview member"
              >
                {protocolMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <ColorModeToggle />
            <NotificationBell />
            <AccountMenu
              displayName={displayName}
              roleLabel={roleLabel}
              canSignOut={!demoMode}
              onSignOut={signOut}
            />
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 md:p-8 pb-24 md:pb-10 overflow-x-hidden overflow-y-auto pmss-main-scroll min-w-0">
          <Outlet />
          <ForcePasswordChangeModal />
        </main>
      </div>

      <nav className="pmss-mobile-nav md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-neutral-200 flex items-stretch z-50 pmss-no-print safe-bottom">
        {mobileItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary-700' : 'text-neutral-500'
              }`
            }
          >
            <NavIcon name={item.icon} />
            <span className="pmss-mobile-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-5 sm:mb-7">
      <div className="min-w-0">
        <h1 className="pmss-page-title text-xl sm:text-[1.65rem] md:text-2xl font-semibold tracking-tight text-neutral-900">
          {title}
        </h1>
        {description && (
          <p className="pmss-page-description text-sm text-neutral-500 mt-1.5 leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto sm:justify-end">{actions}</div>
      )}
    </div>
  )
}

export function StatCard({ label, value, sub, trend, icon: Icon, to }) {
  const body = (
    <>
      <div className="flex justify-between items-start gap-2">
        <p className="pmss-stat-label text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </p>
        {Icon && (
          <div className="p-1.5 rounded-lg bg-primary-50 text-primary-700 shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <p className="text-[1.65rem] font-semibold mt-2.5 tabular-nums tracking-tight text-neutral-900 leading-none">
        {value}
      </p>
      {(sub || trend) && (
        <p
          className={`text-xs mt-2 ${
            to
              ? 'text-primary-700 font-medium group-hover:text-primary-800'
              : trend === 'up'
                ? 'text-emerald-700'
                : 'text-neutral-500'
          }`}
        >
          {sub || trend}
        </p>
      )}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="pmss-card p-4 md:p-5 block group hover:border-primary-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        {body}
      </Link>
    )
  }

  return <div className="pmss-card p-4 md:p-5">{body}</div>
}

export function Badge({ variant = 'neutral', children }) {
  const styles = {
    neutral: 'bg-neutral-100 text-neutral-700',
    success: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
    warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
    error: 'bg-red-50 text-red-700 ring-1 ring-red-100',
    primary: 'pmss-badge-primary bg-primary-50 text-primary-800 ring-1 ring-primary-100',
  }
  return (
    <span className={`pmss-badge ${styles[variant] || styles.neutral}`}>{children}</span>
  )
}

export function EmptyState({ title = 'Nothing here yet', description, action }) {
  return (
    <div className="pmss-empty-state px-6 py-10 text-center">
      <p className="text-sm font-semibold text-neutral-800">{title}</p>
      {description && <p className="text-sm text-neutral-500 mt-1.5 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function DataTable({ columns, rows, renderActions, emptyTitle, emptyDescription }) {
  if (!rows?.length) {
    return (
      <div className="pmss-card overflow-hidden">
        <EmptyState title={emptyTitle ?? 'No records'} description={emptyDescription} />
      </div>
    )
  }

  return (
    <div className="pmss-card overflow-hidden">
      <div className="pmss-scroll-x">
        <table className="pmss-data-table">
          <thead>
            <tr className="bg-neutral-50/90 border-b border-neutral-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="pmss-table-head text-left text-[11px] uppercase tracking-wider font-semibold text-neutral-500 px-3 sm:px-4 py-3 whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
              {renderActions && <th className="w-12 px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id || i}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3 sm:px-4 py-3 text-neutral-700 whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                {renderActions && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
                      aria-label="Row actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ServiceCard({ title, date, children, actions }) {
  return (
    <div className="pmss-card p-4 flex flex-col gap-3">
      <div className="flex justify-between items-start gap-2">
        <div>
          <Badge variant="primary">{date}</Badge>
          <h3 className="font-semibold text-neutral-900 mt-2">{title}</h3>
        </div>
      </div>
      {children}
      {actions && <div className="flex flex-wrap gap-2 pt-1 border-t border-neutral-100">{actions}</div>}
    </div>
  )
}
