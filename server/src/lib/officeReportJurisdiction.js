/**
 * Office report sections = everything the user can access in their jurisdiction.
 * Jurisdiction follows role module access (same idea as ROLE_PERMISSIONS nav/flags).
 */

export const OFFICE_BLOCK_CATALOG = {
  cover: {
    id: 'cover',
    label: 'Cover & author',
    description: 'Title, author role, date, and jurisdiction',
    group: 'Cover',
  },
  narrativeHow: {
    id: 'narrativeHow',
    label: 'How it went',
    description: 'Full written account of the period or service',
    group: 'Narrative',
    narrative: true,
  },
  narrativeIssues: {
    id: 'narrativeIssues',
    label: 'Issues & challenges',
    description: 'Problems faced during the duty or period',
    group: 'Narrative',
    narrative: true,
  },
  narrativeSolutions: {
    id: 'narrativeSolutions',
    label: 'Solutions used',
    description: 'Actions taken to address issues',
    group: 'Narrative',
    narrative: true,
  },
  narrativeRecs: {
    id: 'narrativeRecs',
    label: 'Recommendations',
    description: 'Future recommendations for leadership',
    group: 'Narrative',
    narrative: true,
  },
  dutyMeta: {
    id: 'dutyMeta',
    label: 'Duty assignment',
    description: 'Active TL/VTL services and duty window',
    group: 'Duty',
  },
  dutyTeam: {
    id: 'dutyTeam',
    label: 'Team roster',
    description: 'Members on your assigned service team(s)',
    group: 'Duty',
  },
  overview: {
    id: 'overview',
    label: 'Ministry overview KPIs',
    description: 'Attendance, roster, teams, and publication snapshot',
    group: 'Ministry',
  },
  publication: {
    id: 'publication',
    label: 'Publication status',
    description: 'Latest published schedule version and timestamp',
    group: 'Ministry',
  },
  attendance: {
    id: 'attendance',
    label: 'Attendance summary',
    description: 'Present / half / quarter / absent totals',
    group: 'Attendance',
  },
  sessions: {
    id: 'sessions',
    label: 'Attendance sessions',
    description: 'Recent submitted attendance sessions',
    group: 'Attendance',
  },
  memberAttendance: {
    id: 'memberAttendance',
    label: 'Member attendance detail',
    description: 'Per-member marks and attendance rate',
    group: 'Attendance',
  },
  services: {
    id: 'services',
    label: 'Services calendar',
    description: 'Scheduled services in the current month',
    group: 'Scheduling',
  },
  teamsByKind: {
    id: 'teamsByKind',
    label: 'Teams by service kind',
    description: 'Counts for Sunday, weekday, Igaburo, and other',
    group: 'Scheduling',
  },
  teams: {
    id: 'teams',
    label: 'Team fill',
    description: 'Protocol team sizes and leaders',
    group: 'Scheduling',
  },
  choirFrequency: {
    id: 'choirFrequency',
    label: 'Choir frequency',
    description: 'How often each choir was assigned',
    group: 'Scheduling',
  },
  choirs: {
    id: 'choirs',
    label: 'Choir assignments',
    description: 'Choirs assigned to each service',
    group: 'Scheduling',
  },
  dutyLoad: {
    id: 'dutyLoad',
    label: 'Member duty load',
    description: 'Team slots and leadership turns per member',
    group: 'Scheduling',
  },
  leadershipTally: {
    id: 'leadershipTally',
    label: 'Leadership tally',
    description: 'TL and VTL assignment counts by member',
    group: 'Scheduling',
  },
  leadershipDetail: {
    id: 'leadershipDetail',
    label: 'Leadership by date',
    description: 'Team leader and vice leader for each service',
    group: 'Scheduling',
  },
  validation: {
    id: 'validation',
    label: 'Validation findings',
    description: 'Schedule validation warnings and errors',
    group: 'Scheduling',
  },
  history: {
    id: 'history',
    label: 'Schedule version history',
    description: 'Recent draft and published schedule versions',
    group: 'Scheduling',
  },
  membersOverview: {
    id: 'membersOverview',
    label: 'Member roster KPIs',
    description: 'Active and protocol member counts',
    group: 'Roster',
  },
  membersByChoir: {
    id: 'membersByChoir',
    label: 'Members by choir',
    description: 'Active protocol members grouped by choir',
    group: 'Roster',
  },
  usersOverview: {
    id: 'usersOverview',
    label: 'User account KPIs',
    description: 'Active, invited, and deactivated system users',
    group: 'Roster',
  },
  financeOverview: {
    id: 'financeOverview',
    label: 'Finance KPIs',
    description: 'Collected, pending, outstanding, goal achievement',
    group: 'Finance',
  },
  publicGoals: {
    id: 'publicGoals',
    label: 'Public ministry goals',
    description: 'Public contribution goals with progress',
    group: 'Finance',
  },
  collection: {
    id: 'collection',
    label: 'Collection by type',
    description: 'Contribution progress toward ministry goals',
    group: 'Finance',
  },
  typesCatalog: {
    id: 'typesCatalog',
    label: 'Contribution types catalog',
    description: 'Contribution types, goals, frequency, and status',
    group: 'Finance',
  },
  methodsCatalog: {
    id: 'methodsCatalog',
    label: 'Payment methods',
    description: 'Configured MoMo / bank / cash channels',
    group: 'Finance',
  },
  memberFinance: {
    id: 'memberFinance',
    label: 'Member contribution performance',
    description: 'Claimed and confirmed amounts per member',
    group: 'Finance',
  },
  outstanding: {
    id: 'outstanding',
    label: 'Outstanding balances',
    description: 'Open follow-up amounts',
    group: 'Finance',
  },
  followups: {
    id: 'followups',
    label: 'Follow-up cases',
    description: 'Open and in-progress follow-up records',
    group: 'Finance',
  },
  pending: {
    id: 'pending',
    label: 'Pending verification',
    description: 'Submissions awaiting treasurer confirmation',
    group: 'Finance',
  },
  confirmed: {
    id: 'confirmed',
    label: 'Confirmed payments',
    description: 'Verified contribution submissions',
    group: 'Finance',
  },
  exceptions: {
    id: 'exceptions',
    label: 'Partial & declined',
    description: 'Exception payments needing attention',
    group: 'Finance',
  },
  activity: {
    id: 'activity',
    label: 'System activity',
    description: 'Recent ministry activity log entries',
    group: 'Activity',
  },
}

const ids = (...list) => list.map((id) => OFFICE_BLOCK_CATALOG[id]).filter(Boolean)

const CORE = ids(
  'cover',
  'narrativeHow',
  'narrativeIssues',
  'narrativeSolutions',
  'narrativeRecs',
)

const DUTY = ids('dutyMeta', 'dutyTeam')
const ATTENDANCE = ids('attendance', 'sessions', 'memberAttendance')
const SCHEDULING = ids(
  'overview',
  'publication',
  'services',
  'teamsByKind',
  'teams',
  'choirFrequency',
  'choirs',
  'dutyLoad',
  'leadershipTally',
  'leadershipDetail',
  'validation',
  'history',
)
const ROSTER = ids('membersOverview', 'membersByChoir')
const USERS = ids('usersOverview')
const FINANCE = ids(
  'financeOverview',
  'publicGoals',
  'collection',
  'typesCatalog',
  'methodsCatalog',
  'memberFinance',
  'outstanding',
  'followups',
  'pending',
  'confirmed',
  'exceptions',
)
const ACTIVITY = ids('activity')

/**
 * Module access per jurisdiction — mirrors app ROLE_PERMISSIONS nav / flags.
 * Users may include any section in these modules (their jurisdiction).
 */
export const JURISDICTION_ACCESS = {
  team_duty: {
    modules: ['duty', 'attendance', 'scheduling'],
    viewUsers: false,
    finance: false,
    reports: false,
  },
  treasurer: {
    modules: ['attendance', 'finance', 'reports'],
    viewUsers: false,
    finance: true,
    reports: true,
  },
  secretary: {
    modules: ['members', 'attendance', 'scheduling', 'finance', 'reports'],
    viewUsers: true,
    finance: true,
    reports: true,
  },
  coordinator: {
    modules: ['members', 'attendance', 'scheduling', 'finance', 'reports'],
    viewUsers: true,
    finance: true,
    reports: true,
  },
  vice_president: {
    modules: ['members', 'attendance', 'scheduling', 'finance', 'reports'],
    viewUsers: true,
    finance: true,
    reports: true,
  },
  president: {
    modules: ['members', 'attendance', 'scheduling', 'finance', 'reports'],
    viewUsers: true,
    finance: true,
    reports: true,
  },
}

function uniqueBlocks(list) {
  const seen = new Set()
  const out = []
  for (const b of list) {
    if (!b || seen.has(b.id)) continue
    seen.add(b.id)
    out.push(b)
  }
  return out
}

/** Blocks available inside each office jurisdiction (everything they can access). */
export function blocksForJurisdiction(jurisdiction) {
  const access = JURISDICTION_ACCESS[jurisdiction]
  if (!access) return []

  const list = [...CORE]
  const mods = new Set(access.modules)

  if (mods.has('duty')) list.push(...DUTY)
  if (mods.has('attendance')) list.push(...ATTENDANCE)
  if (mods.has('scheduling')) list.push(...SCHEDULING)
  if (mods.has('members')) list.push(...ROSTER)
  if (access.viewUsers) list.push(...USERS)
  if (access.finance || mods.has('finance')) list.push(...FINANCE)
  if (access.reports || mods.has('reports')) list.push(...ACTIVITY)

  return uniqueBlocks(list)
}

/** @deprecated Prefer blocksForJurisdiction — kept for any static lookups. */
export const JURISDICTION_BLOCKS = Object.fromEntries(
  Object.keys(JURISDICTION_ACCESS).map((j) => [j, blocksForJurisdiction(j)]),
)

/** Who each jurisdiction may submit reports to. */
export const JURISDICTION_RECIPIENT_ROLES = {
  team_duty: ['coordinator', 'secretary', 'vice_president', 'president'],
  treasurer: ['vice_president', 'president'],
  secretary: ['coordinator', 'vice_president', 'president'],
  coordinator: ['vice_president', 'president'],
  vice_president: ['president'],
  president: [],
}

export const ROLE_LABELS = {
  president: 'President',
  vice_president: 'Vice President',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  coordinator: 'Coordinator',
  member: 'Member',
  team_duty: 'Team Leader / VTL',
}

export function resolveJurisdiction(roleId, officeKind) {
  if (officeKind === 'team_duty' || officeKind === 'duty') return 'team_duty'
  if (JURISDICTION_ACCESS[roleId]) return roleId
  return null
}

export function recipientRolesFor(jurisdiction) {
  return JURISDICTION_RECIPIENT_ROLES[jurisdiction] ?? []
}
