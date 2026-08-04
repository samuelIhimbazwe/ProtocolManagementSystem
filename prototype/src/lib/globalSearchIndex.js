import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  CalendarDays,
  BarChart3,
  Settings,
  User,
  Music,
  UsersRound,
  Crown,
  ShieldCheck,
  KeyRound,
  FileText,
  Bell,
  Activity,
  BookOpen,
} from 'lucide-react'
import { NAV_ITEMS } from '../data/mock'
import { CHOIRS } from '../data/mock'
import { ROLES } from '../data/roles'
import { loadRuleConfiguration } from '../data/rules'
import { parseChoirList } from '../components/ChoirCardActions'

const MAX_PER_GROUP = 6

const EXTRA_PAGES = [
  { to: '/activity', label: 'Recent activity', keywords: 'audit log history events', icon: Activity },
  { to: '/notifications', label: 'Notifications', keywords: 'alerts bell unread', icon: Bell },
  { to: '/members/accounts', label: 'User accounts', keywords: 'login invite password users', icon: KeyRound },
  { to: '/settings#change-password', label: 'Change password', keywords: 'password security account', icon: KeyRound },
  { to: '/attendance/record', label: 'Record attendance', keywords: 'roll call present absent', icon: ClipboardCheck },
  {
    to: '/scheduling?tab=calendar',
    label: 'Calendar',
    keywords: 'month services dates',
    icon: CalendarDays,
    needs: '/scheduling',
  },
  {
    to: '/scheduling?tab=choir',
    label: 'Choir schedule',
    keywords: 'choirs music worship',
    icon: Music,
    needs: '/scheduling',
  },
  {
    to: '/scheduling?tab=teams',
    label: 'Service teams',
    keywords: 'protocol roster team leader',
    icon: UsersRound,
    needs: '/scheduling',
  },
  {
    to: '/scheduling?tab=leadership',
    label: 'Leadership',
    keywords: 'tl vtl approve',
    icon: Crown,
    needs: '/scheduling',
  },
  {
    to: '/scheduling?tab=validation',
    label: 'Validation',
    keywords: 'rules errors warnings',
    icon: ShieldCheck,
    needs: '/scheduling',
  },
  {
    to: '/scheduling?tab=publish',
    label: 'Publish schedule',
    keywords: 'release version',
    icon: FileText,
    needs: '/scheduling',
  },
  {
    to: '/scheduling?tab=history',
    label: 'Schedule history',
    keywords: 'versions changes archive',
    icon: BookOpen,
    needs: '/scheduling',
  },
]

const NAV_ICONS = {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  CalendarDays,
  BarChart3,
  Settings,
}

function matches(q, ...parts) {
  const hay = parts.filter(Boolean).join(' ').toLowerCase()
  return hay.includes(q)
}

function pushLimited(list, item, max = MAX_PER_GROUP) {
  if (list.length < max) list.push(item)
}

/**
 * Build searchable hits from everything currently loaded in the client.
 * @returns {{ group: string, items: Array }[]}
 */
export function buildGlobalSearchResults(q, ctx) {
  const query = String(q ?? '')
    .trim()
    .toLowerCase()
  if (!query) return []

  const {
    members = [],
    payload = {},
    permissions = {},
    accounts = [],
    rules = loadRuleConfiguration(),
  } = ctx

  const nav = new Set(permissions.nav ?? [])
  const can = (path) => nav.has(path)
  const groups = []

  // —— Pages ——
  const pages = []
  for (const item of NAV_ITEMS) {
    if (!can(item.to)) continue
    if (matches(query, item.label, item.to)) {
      pushLimited(pages, {
        id: `page-${item.to}`,
        title: item.label,
        subtitle: item.to === '/' ? 'Home' : item.to,
        to: item.to,
        Icon: NAV_ICONS[item.icon] ?? LayoutDashboard,
      })
    }
  }
  for (const item of EXTRA_PAGES) {
    if (item.to === '/members/accounts' && !permissions.viewUsers) continue
    if (item.to === '/attendance/record' && !permissions.recordAttendance) continue
    if (item.needs && !can(item.needs)) continue
    if (matches(query, item.label, item.keywords, item.to)) {
      pushLimited(pages, {
        id: `page-${item.to}`,
        title: item.label,
        subtitle: 'Page',
        to: item.to,
        Icon: item.icon,
      })
    }
  }
  if (pages.length) groups.push({ group: 'Pages', items: pages })

  // —— Members ——
  if (can('/members') || can('/attendance')) {
    const memberHits = []
    for (const m of members) {
      if (
        matches(
          query,
          m.name,
          m.phone,
          m.choir,
          m.role,
          m.status,
          m.id,
          String(m.attendanceRate ?? ''),
        )
      ) {
        const to = can('/members') ? `/members/${m.id}` : '/attendance'
        pushLimited(memberHits, {
          id: `member-${m.id}`,
          title: m.name,
          subtitle: [m.role, m.status, m.phone, m.choir].filter(Boolean).join(' · '),
          to,
          Icon: User,
        })
      }
    }
    if (memberHits.length) groups.push({ group: 'Members', items: memberHits })
  }

  // —— User accounts ——
  if (permissions.viewUsers && accounts.length) {
    const accountHits = []
    for (const u of accounts) {
      const roleLabel = ROLES.find((r) => r.id === u.appRole)?.label ?? u.appRole
      if (
        matches(query, u.username, u.email, u.displayName, u.status, roleLabel, u.memberId, u.id)
      ) {
        pushLimited(accountHits, {
          id: `user-${u.id}`,
          title: u.displayName || u.username,
          subtitle: [u.username, u.email, roleLabel, u.status].filter(Boolean).join(' · '),
          to: '/members/accounts',
          Icon: KeyRound,
        })
      }
    }
    if (accountHits.length) groups.push({ group: 'User accounts', items: accountHits })
  }

  // —— Services ——
  if (can('/scheduling')) {
    const serviceHits = []
    for (const s of payload.services ?? []) {
      if (matches(query, s.name, s.date, s.day, s.status, s.id)) {
        pushLimited(serviceHits, {
          id: `service-${s.id}`,
          title: s.name,
          subtitle: [s.date, s.day, s.status].filter(Boolean).join(' · '),
          to: '/scheduling?tab=calendar',
          Icon: CalendarDays,
        })
      }
    }
    if (serviceHits.length) groups.push({ group: 'Services', items: serviceHits })
  }

  // —— Choir catalog + assignments ——
  if (can('/scheduling')) {
    const choirHits = []
    const seen = new Set()
    const catalog = [...(CHOIRS.special ?? []), ...(CHOIRS.primary ?? []), ...(CHOIRS.secondary ?? [])]
    for (const name of catalog) {
      if (!matches(query, name) || seen.has(name)) continue
      seen.add(name)
      pushLimited(choirHits, {
        id: `choir-cat-${name}`,
        title: name,
        subtitle: 'Choir catalog',
        to: '/scheduling?tab=choir',
        Icon: Music,
      })
    }
    for (const row of payload.choirAssignments ?? []) {
      for (const name of parseChoirList(row.choirs)) {
        const key = `${name}|${row.date}|${row.service}`
        if (!matches(query, name, row.service, row.date, row.status) || seen.has(key)) continue
        if (seen.has(name) && !matches(query, row.service, row.date)) continue
        seen.add(key)
        pushLimited(choirHits, {
          id: `choir-${key}`,
          title: name,
          subtitle: `${row.service} · ${row.date}`,
          to: '/scheduling?tab=choir',
          Icon: Music,
        })
      }
    }
    if (choirHits.length) groups.push({ group: 'Choirs', items: choirHits })
  }

  // —— Service teams ——
  if (can('/scheduling')) {
    const teamHits = []
    const seenTeam = new Set()
    for (const t of payload.teamAssignments ?? []) {
      const roster = (t.members ?? []).join(' ')
      if (
        !matches(
          query,
          t.date,
          t.serviceName,
          t.teamLeader,
          t.viceTeamLeader,
          t.kind,
          t.status,
          roster,
        )
      ) {
        continue
      }
      const id = t.serviceId ?? t._key ?? t.date
      if (seenTeam.has(id)) continue
      seenTeam.add(id)
      pushLimited(teamHits, {
        id: `team-${id}`,
        title: t.serviceName ?? t.date,
        subtitle: [
          t.date,
          t.teamLeader ? `TL ${t.teamLeader}` : null,
          t.viceTeamLeader ? `VTL ${t.viceTeamLeader}` : null,
          t.size != null ? `${t.size} members` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        to: '/scheduling?tab=teams',
        Icon: UsersRound,
      })
    }
    // Also surface individual people found on teams when members nav is closed
    if (!can('/members')) {
      for (const t of payload.teamAssignments ?? []) {
        for (const name of t.members ?? []) {
          if (!matches(query, name)) continue
          const key = `roster-${name}-${t.serviceId ?? t.date}`
          if (seenTeam.has(key)) continue
          seenTeam.add(key)
          pushLimited(teamHits, {
            id: key,
            title: name,
            subtitle: `On team · ${t.serviceName ?? t.date}`,
            to: '/scheduling?tab=teams',
            Icon: User,
          })
        }
      }
    }
    if (teamHits.length) groups.push({ group: 'Service teams', items: teamHits })
  }

  // —— Leadership ——
  if (can('/scheduling')) {
    const leadHits = []
    for (const row of payload.leadershipReview ?? []) {
      if (matches(query, row.date, row.tl, row.vtl, row.status, 'leadership', 'team leader')) {
        pushLimited(leadHits, {
          id: `lead-${row.date}-${row.tl}`,
          title: `${row.tl ?? '—'} / ${row.vtl ?? '—'}`,
          subtitle: `Leadership · ${row.date}${row.status ? ` · ${row.status}` : ''}`,
          to: '/scheduling?tab=leadership',
          Icon: Crown,
        })
      }
    }
    if (leadHits.length) groups.push({ group: 'Leadership', items: leadHits })
  }

  // —— Validation ——
  if (can('/scheduling')) {
    const valHits = []
    for (const row of payload.validationRows ?? []) {
      if (matches(query, row.rule, row.issue, row.severity, row.service, row.status)) {
        pushLimited(valHits, {
          id: `val-${row.rule}-${row.service}`,
          title: row.rule,
          subtitle: [row.severity, row.issue, row.service].filter(Boolean).join(' · '),
          to: '/scheduling?tab=validation',
          Icon: ShieldCheck,
        })
      }
    }
    if (valHits.length) groups.push({ group: 'Validation', items: valHits })
  }

  // —— Rules (settings) ——
  if (can('/settings')) {
    const ruleHits = []
    for (const rule of rules) {
      if (
        matches(
          query,
          rule.name,
          rule.description,
          rule.category,
          rule.severity,
          rule.severity,
          rule.id,
        )
      ) {
        pushLimited(ruleHits, {
          id: `rule-${rule.id}`,
          title: rule.name,
          subtitle: [rule.category, rule.severity, rule.enabled === false ? 'Disabled' : 'Enabled']
            .filter(Boolean)
            .join(' · '),
          to: '/settings',
          Icon: Settings,
        })
      }
    }
    if (ruleHits.length) groups.push({ group: 'Rules', items: ruleHits })
  }

  return groups
}

export function firstSearchHit(groups) {
  for (const g of groups) {
    if (g.items?.[0]) return g.items[0]
  }
  return null
}

export function countSearchHits(groups) {
  return groups.reduce((n, g) => n + (g.items?.length ?? 0), 0)
}
