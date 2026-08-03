/** Settings section catalog — content blocks composed per role in ROLE_SETTINGS_LAYOUT. */

export const SETTINGS_SECTIONS = {
  service: {
    title: 'Service configuration',
    fields: [
      { label: 'Default service types', value: 'Sunday 1 & 2, Tuesday, Friday, Igaburo' },
      { label: 'Service times', value: 'Configured in admin' },
    ],
  },
  team: {
    title: 'Team size',
    fields: [
      { label: 'Minimum protocol team', value: '4' },
      { label: 'Maximum protocol team', value: '10' },
      { label: 'Sunday / Igaburo roster', value: '10 (TL + VTL included)' },
    ],
  },
  assignments: {
    title: 'Assignment limits',
    fields: [
      { label: 'Max services per member / month', value: '4' },
      { label: 'Rest between assignments', value: '1 service' },
    ],
  },
  leadership: {
    title: 'Leadership rotation',
    fields: [
      { label: 'TL cooldown', value: '2 services' },
      { label: 'VTL rotation weights', value: 'Attendance + tenure' },
    ],
  },
  notifications: {
    title: 'Ministry notifications',
    fields: [
      { label: 'Email digest', value: 'Weekly' },
      { label: 'Publish alerts', value: 'President, Secretary, Coordinator' },
      { label: 'Validation warnings', value: 'Coordinator, Secretary' },
    ],
  },
  system: {
    title: 'System preferences',
    fields: [
      { label: 'Timezone', value: 'Africa/Kigali' },
      { label: 'Date format', value: 'DD MMM YYYY' },
    ],
  },
  governance: {
    title: 'Governance & approvals',
    fields: [
      { label: 'Schedule publish approval', value: 'President or Vice President' },
      { label: 'Leadership roster approval', value: 'President' },
      { label: 'Audit log retention', value: '12 months' },
    ],
  },
  reportsPrefs: {
    title: 'Reports & exports',
    fields: [
      { label: 'Default export format', value: 'PDF' },
      { label: 'Include attendance breakdown', value: 'Yes' },
      { label: 'Monthly close date', value: 'Last day of month' },
    ],
  },
  attendanceOverview: {
    title: 'Attendance policy (summary)',
    fields: [
      { label: 'Recording window', value: 'During service + 24h after' },
      { label: 'Who can record', value: 'Secretary, Coordinator, TL/VTL on duty' },
      { label: 'Minimum rate for priority scheduling', value: '70% (optional rule)' },
    ],
  },
  account: {
    title: 'My account',
    fields: [], // filled dynamically from member
  },
  memberNotifications: {
    title: 'My notifications',
    fields: [
      { label: 'Schedule published', value: 'In-app + email' },
      { label: 'Team assignment', value: 'In-app' },
      { label: 'TL / VTL duty reminder', value: 'In-app' },
    ],
  },
  display: {
    title: 'Display & language',
    fields: [
      { label: 'Default scheduling view', value: 'Cards' },
      { label: 'Language', value: 'English' },
    ],
  },
}

/** Per-role settings screen: copy, visible sections, rule panel mode, editable sections. */
export const ROLE_SETTINGS_LAYOUT = {
  coordinator: {
    description: 'Full ministry configuration — services, teams, rules, rotation, and notifications',
    rulesAccess: 'edit',
    ruleCategories: null,
    sections: ['service', 'team', 'assignments', 'leadership', 'notifications', 'system'],
    editableSections: ['service', 'team', 'assignments', 'leadership', 'notifications', 'system'],
    rulesFootnote: 'You can enable, disable, and edit rule parameters.',
  },
  president: {
    description: 'Oversight settings — review rules and governance (view only)',
    rulesAccess: 'view',
    ruleCategories: null,
    sections: ['governance', 'service', 'leadership', 'notifications', 'system'],
    editableSections: [],
    rulesFootnote: 'View validation rules used before publish. Contact the coordinator to change parameters.',
  },
  vice_president: {
    description: 'Oversight settings — review scheduling rules and ministry notifications',
    rulesAccess: 'view',
    ruleCategories: null,
    sections: ['governance', 'service', 'team', 'notifications', 'system'],
    editableSections: [],
    rulesFootnote: 'View only. Coordinators manage rule parameters.',
  },
  secretary: {
    description: 'Secretary settings — notifications, assignments, and attendance policy',
    rulesAccess: 'view',
    ruleCategories: ['Attendance', 'Service team', 'Schedule'],
    sections: ['notifications', 'assignments', 'attendanceOverview', 'system'],
    editableSections: ['notifications'],
    rulesFootnote: 'View rules that affect attendance recording and team assignments.',
  },
  treasurer: {
    description: 'Treasurer settings — reports, attendance policy summary, and exports',
    rulesAccess: 'view',
    ruleCategories: ['Attendance'],
    sections: ['reportsPrefs', 'attendanceOverview', 'system'],
    editableSections: ['reportsPrefs'],
    rulesFootnote: 'Attendance-related validation rules (view only).',
  },
  member: {
    description: 'Personal settings — your account, alerts, and display preferences',
    rulesAccess: 'none',
    ruleCategories: null,
    sections: ['account', 'memberNotifications', 'display'],
    editableSections: ['memberNotifications', 'display'],
    rulesFootnote: null,
  },
}

export function getSettingsLayout(roleId) {
  return ROLE_SETTINGS_LAYOUT[roleId] ?? ROLE_SETTINGS_LAYOUT.member
}

export const MEMBER_PREFS_STORAGE_KEY = 'pmss-member-prefs'

export function loadMemberPrefs() {
  try {
    const raw = localStorage.getItem(MEMBER_PREFS_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return {
    schedulePublished: 'In-app + email',
    teamAssignment: 'In-app',
    dutyReminder: 'In-app',
    defaultView: 'Cards',
    language: 'English',
  }
}

export function saveMemberPrefs(prefs) {
  try {
    localStorage.setItem(MEMBER_PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

export function memberAccountFields(member) {
  if (!member) {
    return [
      { label: 'Signed in as', value: 'Protocol member' },
    ]
  }
  return [
    { label: 'Full name', value: member.name },
    { label: 'Phone', value: member.phone },
    { label: 'Choir', value: member.choir ?? 'Not assigned' },
    { label: 'Role', value: 'Protocol member' },
  ]
}

export function memberNotificationFields(prefs) {
  return [
    { label: 'Schedule published', value: prefs.schedulePublished, prefKey: 'schedulePublished' },
    { label: 'Team assignment', value: prefs.teamAssignment, prefKey: 'teamAssignment' },
    { label: 'TL / VTL duty reminder', value: prefs.dutyReminder, prefKey: 'dutyReminder' },
  ]
}

export function memberDisplayFields(prefs) {
  return [
    { label: 'Default scheduling view', value: prefs.defaultView, prefKey: 'defaultView' },
    { label: 'Language', value: prefs.language, prefKey: 'language' },
  ]
}
