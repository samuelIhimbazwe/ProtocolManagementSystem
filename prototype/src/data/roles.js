/** Roles that always see Dashboard → Office (ministry leadership). */
export const LEADERSHIP_ROLE_IDS = ['president', 'vice_president', 'secretary', 'treasurer', 'coordinator']

export const ROLES = [
  { id: 'president', label: 'President' },
  { id: 'vice_president', label: 'Vice President' },
  { id: 'secretary', label: 'Secretary' },
  { id: 'treasurer', label: 'Treasurer' },
  { id: 'coordinator', label: 'Coordinator' },
  { id: 'member', label: 'Member' },
]

const FINANCE_BASE = {
  viewFinance: true,
  manageContributionTypes: false,
  managePaymentMethods: false,
  verifyContributions: false,
  viewFinanceLedger: false,
  viewFinanceReports: false,
  /** Every roster-linked account can (and should) submit their own contributions. */
  submitContributions: true,
}

/** Permission flags — map to Figma role-based frame variants */
export const ROLE_PERMISSIONS = {
  president: {
    nav: ['/', '/members', '/attendance', '/scheduling', '/finance', '/reports'],
    mobileNav: ['/', '/members', '/scheduling', '/finance'],
    manageMembers: false,
    viewUsers: true,
    manageUsers: false,
    recordAttendance: false,
    manageSchedule: false,
    viewReports: true,
    editSettings: false,
    schedulingTabs: ['calendar', 'choir', 'teams', 'leadership', 'validation', 'publish', 'history'],
    ...FINANCE_BASE,
    manageContributionTypes: true,
    viewFinanceLedger: true,
    viewFinanceReports: true,
  },
  vice_president: {
    nav: ['/', '/members', '/attendance', '/scheduling', '/finance', '/reports'],
    mobileNav: ['/', '/members', '/scheduling', '/finance'],
    manageMembers: false,
    viewUsers: true,
    manageUsers: false,
    recordAttendance: false,
    manageSchedule: false,
    viewReports: true,
    editSettings: false,
    schedulingTabs: ['calendar', 'choir', 'teams', 'leadership', 'validation', 'publish', 'history'],
    ...FINANCE_BASE,
    manageContributionTypes: true,
    viewFinanceLedger: true,
    viewFinanceReports: true,
  },
  secretary: {
    nav: ['/', '/members', '/attendance', '/scheduling', '/finance', '/reports'],
    mobileNav: ['/', '/members', '/scheduling', '/finance'],
    manageMembers: true,
    viewUsers: true,
    manageUsers: true,
    recordAttendance: true,
    manageSchedule: false,
    viewReports: true,
    editSettings: false,
    schedulingTabs: ['calendar', 'choir', 'teams', 'leadership', 'validation', 'publish', 'history'],
    ...FINANCE_BASE,
    viewFinanceLedger: true,
    viewFinanceReports: true,
  },
  treasurer: {
    nav: ['/', '/finance', '/attendance', '/reports'],
    mobileNav: ['/', '/finance', '/attendance', '/reports'],
    manageMembers: false,
    viewUsers: false,
    manageUsers: false,
    recordAttendance: false,
    manageSchedule: false,
    viewReports: true,
    editSettings: false,
    schedulingTabs: ['calendar', 'history'],
    ...FINANCE_BASE,
    manageContributionTypes: true,
    managePaymentMethods: true,
    verifyContributions: true,
    viewFinanceLedger: true,
    viewFinanceReports: true,
  },
  coordinator: {
    nav: ['/', '/members', '/attendance', '/scheduling', '/finance', '/reports'],
    mobileNav: ['/', '/members', '/scheduling', '/finance'],
    manageMembers: true,
    viewUsers: true,
    manageUsers: true,
    recordAttendance: true,
    manageSchedule: true,
    viewReports: true,
    editSettings: true,
    schedulingTabs: ['calendar', 'choir', 'teams', 'leadership', 'validation', 'publish', 'history'],
    ...FINANCE_BASE,
    viewFinanceLedger: true,
    viewFinanceReports: true,
  },
  member: {
    nav: ['/', '/attendance', '/scheduling', '/finance'],
    mobileNav: ['/', '/scheduling', '/finance', '/attendance'],
    manageMembers: false,
    viewUsers: false,
    manageUsers: false,
    recordAttendance: false,
    manageSchedule: false,
    viewReports: false,
    editSettings: false,
    schedulingTabs: ['calendar', 'choir', 'teams', 'history'],
    ...FINANCE_BASE,
  },
}

export function getPermissions(roleId) {
  return ROLE_PERMISSIONS[roleId] || ROLE_PERMISSIONS.member
}

export const ROLE_STORAGE_KEY = 'pmss-demo-role'
