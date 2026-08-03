/** Grouped includable blocks for the ministry reports builder. */
export const MINISTRY_REPORT_BLOCKS = [
  {
    id: 'cover',
    label: 'Cover & filters',
    description: 'Title, date range, service filter, and generation timestamp',
    group: 'Cover',
  },
  {
    id: 'overview',
    label: 'Overview KPIs',
    description: 'Attendance rate, roster size, teams, choirs, validation counts',
    group: 'Cover',
  },
  {
    id: 'publication',
    label: 'Publication status',
    description: 'Published version, publisher, draft, and publish timestamp',
    group: 'Cover',
  },

  {
    id: 'attendance',
    label: 'Attendance by status',
    description: 'Present / half / quarter / absent totals and rate',
    group: 'Attendance',
  },
  {
    id: 'sessions',
    label: 'Attendance sessions',
    description: 'Each submitted session with recorded marks and rate',
    group: 'Attendance',
  },
  {
    id: 'memberAttendance',
    label: 'Member attendance detail',
    description: 'Per-member marks, status breakdown, and rate',
    group: 'Attendance',
  },

  {
    id: 'services',
    label: 'Services calendar',
    description: 'Scheduled services with date, day, and status',
    group: 'Scheduling',
  },
  {
    id: 'teamsByKind',
    label: 'Teams by service kind',
    description: 'Counts for Sunday, weekday, Igaburo, and other',
    group: 'Scheduling',
  },
  {
    id: 'teams',
    label: 'Team fill detail',
    description: 'Roster size vs target, TL/VTL, and fill status per service',
    group: 'Scheduling',
  },
  {
    id: 'choirFrequency',
    label: 'Choir frequency',
    description: 'How often each choir was assigned',
    group: 'Scheduling',
  },
  {
    id: 'choirAssignments',
    label: 'Choir assignments',
    description: 'Choirs assigned to each service date',
    group: 'Scheduling',
  },
  {
    id: 'dutyLoad',
    label: 'Member duty load',
    description: 'How many team slots and leadership turns per member',
    group: 'Scheduling',
  },
  {
    id: 'leadershipTally',
    label: 'Leadership tally',
    description: 'TL and VTL assignment counts by member',
    group: 'Scheduling',
  },
  {
    id: 'leadershipDetail',
    label: 'Leadership by date',
    description: 'Team leader and vice leader for each service',
    group: 'Scheduling',
  },
  {
    id: 'validation',
    label: 'Validation findings',
    description: 'Passed, warning, and error rule results',
    group: 'Scheduling',
  },
  {
    id: 'history',
    label: 'Schedule version history',
    description: 'Recent draft and published schedule versions',
    group: 'Scheduling',
  },

  {
    id: 'membersOverview',
    label: 'Member roster KPIs',
    description: 'Active, protocol, leadership, and choir coverage counts',
    group: 'Roster',
  },
  {
    id: 'membersByChoir',
    label: 'Members by choir',
    description: 'Active protocol members grouped by choir',
    group: 'Roster',
  },
  {
    id: 'usersOverview',
    label: 'User account KPIs',
    description: 'Active, invited, and deactivated system users',
    group: 'Roster',
  },

  {
    id: 'activity',
    label: 'System activity',
    description: 'Recent ministry activity log entries',
    group: 'Activity',
  },
]

/** Grouped includable blocks for finance reports builder. */
export const FINANCE_REPORT_BLOCKS = [
  {
    id: 'cover',
    label: 'Cover & meta',
    description: 'Title and generation timestamp',
    group: 'Cover',
  },
  {
    id: 'financeOverview',
    label: 'Finance KPIs',
    description: 'Collected total, pending, outstanding, goal achievement',
    group: 'Cover',
  },
  {
    id: 'publicGoals',
    label: 'Public ministry goals',
    description: 'Public contribution goals with progress',
    group: 'Cover',
  },

  {
    id: 'collection',
    label: 'Collection by type',
    description: 'Claimed vs collected toward each ministry goal',
    group: 'Collections',
  },
  {
    id: 'typesCatalog',
    label: 'Contribution types catalog',
    description: 'All contribution types, goals, frequency, and status',
    group: 'Collections',
  },
  {
    id: 'methodsCatalog',
    label: 'Payment methods',
    description: 'Configured MoMo / bank / cash channels',
    group: 'Collections',
  },

  {
    id: 'members',
    label: 'Member contribution performance',
    description: 'Claimed and confirmed amounts per member',
    group: 'Members',
  },
  {
    id: 'outstanding',
    label: 'Outstanding balances',
    description: 'Open follow-up amounts still owed',
    group: 'Members',
  },
  {
    id: 'followups',
    label: 'Follow-up cases',
    description: 'Open and in-progress follow-up records',
    group: 'Members',
  },

  {
    id: 'pending',
    label: 'Pending verification',
    description: 'Submissions awaiting treasurer confirmation',
    group: 'Ledger',
  },
  {
    id: 'confirmed',
    label: 'Confirmed payments',
    description: 'Verified contribution submissions',
    group: 'Ledger',
  },
  {
    id: 'partials',
    label: 'Partial payments',
    description: 'Partially confirmed submissions',
    group: 'Ledger',
  },
  {
    id: 'declined',
    label: 'Declined payments',
    description: 'Declined contribution submissions',
    group: 'Ledger',
  },
]

export const MINISTRY_REPORT_PRESETS = [
  {
    id: 'full',
    label: 'Full ministry report',
    description: 'Every available section',
    ids: MINISTRY_REPORT_BLOCKS.map((b) => b.id),
  },
  {
    id: 'executive',
    label: 'Executive summary',
    description: 'Cover, KPIs, publication, attendance totals',
    ids: ['cover', 'overview', 'publication', 'attendance'],
  },
  {
    id: 'attendance',
    label: 'Attendance pack',
    description: 'Status totals, sessions, and member detail',
    ids: ['cover', 'overview', 'attendance', 'sessions', 'memberAttendance'],
  },
  {
    id: 'scheduling',
    label: 'Scheduling pack',
    description: 'Services, teams, choirs, leadership, validation',
    ids: [
      'cover',
      'overview',
      'publication',
      'services',
      'teamsByKind',
      'teams',
      'choirFrequency',
      'choirAssignments',
      'dutyLoad',
      'leadershipTally',
      'leadershipDetail',
      'validation',
      'history',
    ],
  },
  {
    id: 'roster',
    label: 'Roster & accounts',
    description: 'Member and user account summaries',
    ids: ['cover', 'overview', 'membersOverview', 'membersByChoir', 'usersOverview'],
  },
  {
    id: 'audit',
    label: 'Audit trail',
    description: 'Validation, version history, and activity',
    ids: ['cover', 'publication', 'validation', 'history', 'activity'],
  },
]

export const FINANCE_REPORT_PRESETS = [
  {
    id: 'full',
    label: 'Full finance report',
    description: 'Every available section',
    ids: FINANCE_REPORT_BLOCKS.map((b) => b.id),
  },
  {
    id: 'executive',
    label: 'Executive summary',
    description: 'KPIs, public goals, and collection by type',
    ids: ['cover', 'financeOverview', 'publicGoals', 'collection'],
  },
  {
    id: 'collections',
    label: 'Collections pack',
    description: 'Types, methods, and collection progress',
    ids: ['cover', 'financeOverview', 'collection', 'typesCatalog', 'methodsCatalog'],
  },
  {
    id: 'members',
    label: 'Member & arrears',
    description: 'Performance, outstanding, and follow-ups',
    ids: ['cover', 'financeOverview', 'members', 'outstanding', 'followups'],
  },
  {
    id: 'exceptions',
    label: 'Exceptions & verification',
    description: 'Pending, partial, and declined payments',
    ids: ['cover', 'financeOverview', 'pending', 'partials', 'declined'],
  },
  {
    id: 'ledger',
    label: 'Full ledger pack',
    description: 'Pending, confirmed, partial, and declined',
    ids: ['cover', 'pending', 'confirmed', 'partials', 'declined'],
  },
]

export function defaultIncludeMap(blocks) {
  return Object.fromEntries(blocks.map((b) => [b.id, true]))
}

export function includeMapFromIds(blocks, ids) {
  const set = new Set(ids)
  return Object.fromEntries(blocks.map((b) => [b.id, set.has(b.id)]))
}

export function groupBlocks(blocks) {
  const order = []
  const map = new Map()
  for (const b of blocks) {
    const g = b.group || 'Sections'
    if (!map.has(g)) {
      map.set(g, [])
      order.push(g)
    }
    map.get(g).push(b)
  }
  return order.map((name) => ({ name, blocks: map.get(name) }))
}

export function selectedBlockIds(includeMap) {
  return Object.entries(includeMap)
    .filter(([, on]) => on)
    .map(([id]) => id)
}

export function slugifyTitle(title) {
  return (
    String(title || 'report')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'report'
  )
}
