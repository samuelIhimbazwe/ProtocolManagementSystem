import { buildMonthlyServiceTeams } from './teamEngine'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { to: '/members', label: 'Members', icon: 'Users' },
  { to: '/attendance', label: 'Attendance', icon: 'ClipboardCheck' },
  { to: '/scheduling', label: 'Scheduling Center', icon: 'CalendarDays' },
  { to: '/finance', label: 'Finance', icon: 'Wallet' },
  { to: '/reports', label: 'Reports', icon: 'BarChart3' },
]

export const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: 'LayoutDashboard' },
  { to: '/members', label: 'Members', icon: 'Users' },
  { to: '/scheduling', label: 'Schedule', icon: 'CalendarDays' },
  { to: '/finance', label: 'Finance', icon: 'Wallet' },
  { to: '/attendance', label: 'Attendance', icon: 'ClipboardCheck' },
  { to: '/reports', label: 'Reports', icon: 'BarChart3' },
]

export const CHOIRS = {
  primary: ['El Bethel Choir', "Ijwi ry'Umwami Yesu Choir", 'Elim Choir', 'Integuza Choir'],
  secondary: ['Yerusalemu Choir', 'Beulah Choir'],
  special: ['Hope Choir'],
}

export const DASHBOARD_STATS = {
  totalMembers: 75,
  activeMembers: 70,
  upcomingServices: 19,
  attendanceRate: '87%',
  publishedSchedule: 'August 2026',
  scheduleStatus: 'Published',
}

export const PROTOCOL_MEMBER_COUNT = 70

export const PUBLISH_INFO = {
  version: 'V3',
  status: 'Published',
  publishedBy: 'David Mugisha',
  publishedDate: '31 July 2026',
}

export const VALIDATION_SUMMARY = {
  passed: 28,
  warnings: 2,
  errors: 0,
  status: 'PASS',
}

export const ADMIN_MEMBERS = [
  { id: '1', name: 'Samuel Niyonzima', role: 'President' },
  { id: '2', name: 'Emmanuel Habimana', role: 'Vice President' },
  { id: '3', name: 'Alice Mukamana', role: 'Secretary' },
  { id: '4', name: 'Jean Claude Uwimana', role: 'Treasurer' },
  { id: '5', name: 'David Mugisha', role: 'Coordinator' },
]

/** 70 unique protocol members — Kinyarwanda given + family names (no duplicate full names). */
const PROTOCOL_NAMES = [
  'Jean Bosco Ndayisaba',
  'Marie Claire Uwamahoro',
  'Théogène Hakizimana',
  'Vestine Mukamurenzi',
  'Consolee Uwizeye',
  'Alexis Mbarushimana',
  'Chantal Nyiraneza',
  'Innocent Bizimana',
  'Donatille Uwiringiyimana',
  'Valens Nkurikiyimana',
  'Beatha Nshimiyimana',
  'Moise Uwamariya',
  'Goretti Hategekimana',
  'Placide Ingabire',
  'Joselyne Gasana',
  'Fabrice Umutoni',
  'Liliane Niyonkuru',
  'Pascal Mukandori',
  'Immaculée Ndayambaje',
  'Olivier Uwimana',
  'Tharcisse Mugabo',
  'Gaudence Nkurunziza',
  'Speciose Mukandayisenga',
  'Annonciata Uwera',
  'Viateur Irakoze',
  'Deogratias Niyonsaba',
  'Fidèle Niyonsenga',
  'Liberata Uwimbabazi',
  'Athanase Kamanzi',
  'Gérard Murekatete',
  'Solange Nshuti',
  'Bernadette Habyarimana',
  'Odette Mukamana',
  'Cyprien Bizimana',
  'Callixte Nyirahabimana',
  'Félicien Munezero',
  'Angélique Mukarukundo',
  'Ildephonse Ntirenganya',
  'Josephine Ndayisenga',
  'Alphonse Niyigena',
  'Delphine Uwiragiye',
  'Boniface Nsengimana',
  'Jeannette Mukeshimana',
  'Edouard Niyitegeka',
  'Colette Habiyakare',
  'Augustin Nsabimana',
  'Scholastique Mukamuhizi',
  'Léonard Niyonzima',
  'Vénuste Nsengiyumva',
  'Pacifique Niyomugabo',
  'Clarisse Mukamurigo',
  'Faustin Niyonshuti',
  'Seraphine Mukamuhaye',
  'Théophile Niyonsaba',
  'Marie Grace Uwiringiyimana',
  'Jean Paul Nkurunziza',
  'Pierre Claver Mbarushimana',
  'Marie Thérèse Nyiraneza',
  'Elie Ndayambaje',
  'Esther Mukandori',
  'Samuel Niyonkuru',
  'Ruth Umutoni',
  'Daniel Gasana',
  'Sarah Ingabire',
  'James Irakoze',
  'Andrew Kamanzi',
  'Grace Murekatete',
  'Peter Nshuti',
  'Alice Nyirahabimana',
  'Joseph Niyigena',
  'Rose Uwiragiye',
  'Simon Nsengimana',
  'Joyce Mukeshimana',
  'Paul Ntaganda',
  'Vestine Nyiraminani',
].slice(0, PROTOCOL_MEMBER_COUNT)

const CHOIR_ROTATION = [
  'El Bethel Choir',
  "Ijwi ry'Umwami Yesu Choir",
  'Elim Choir',
  'Integuza Choir',
  'Yerusalemu Choir',
  'Beulah Choir',
  null,
]

function protocolMetaForIndex(i) {
  return {
    choir: CHOIR_ROTATION[i % CHOIR_ROTATION.length],
    attendanceRate: 72 + (i * 5) % 27,
  }
}

function phoneForIndex(i) {
  return `+250 78${String(1000000 + i).slice(-7)}`
}

export const MEMBERS = [
  ...ADMIN_MEMBERS.map((a, i) => ({
    ...a,
    phone: phoneForIndex(i),
    status: 'Active',
    attendanceRate: null,
    choir: null,
  })),
  ...PROTOCOL_NAMES.map((name, i) => {
    const meta = protocolMetaForIndex(i)
    return {
      id: String(6 + i),
      name,
      phone: phoneForIndex(10 + i),
      role: 'Member',
      status: 'Active',
      attendanceRate: meta.attendanceRate,
      choir: meta.choir,
    }
  }),
]

export const SERVICES = [
  { id: 's01', name: 'Sunday Service 1', date: '2026-08-02', day: 'Sunday', status: 'Published' },
  { id: 's02', name: 'Sunday Service 2', date: '2026-08-02', day: 'Sunday', status: 'Published' },
  { id: 's03', name: 'Tuesday Service', date: '2026-08-04', day: 'Tuesday', status: 'Published' },
  { id: 's04', name: 'Friday Service', date: '2026-08-07', day: 'Friday', status: 'Published' },
  { id: 's05', name: 'Sunday Service 1', date: '2026-08-09', day: 'Sunday', status: 'Published' },
  { id: 's06', name: 'Sunday Service 2', date: '2026-08-09', day: 'Sunday', status: 'Published' },
  { id: 's07', name: 'Tuesday Service', date: '2026-08-11', day: 'Tuesday', status: 'Published' },
  { id: 's08', name: 'Friday Service', date: '2026-08-14', day: 'Friday', status: 'Published' },
  { id: 's09', name: 'Sunday Service 1', date: '2026-08-16', day: 'Sunday', status: 'Published' },
  { id: 's10', name: 'Sunday Service 2', date: '2026-08-16', day: 'Sunday', status: 'Published' },
  { id: 's11', name: 'Tuesday Service', date: '2026-08-18', day: 'Tuesday', status: 'Published' },
  { id: 's12', name: 'Friday Service', date: '2026-08-21', day: 'Friday', status: 'Published' },
  { id: 's13', name: 'Sunday Service 1', date: '2026-08-23', day: 'Sunday', status: 'Published' },
  { id: 's14', name: 'Sunday Service 2', date: '2026-08-23', day: 'Sunday', status: 'Published' },
  { id: 's15', name: 'Tuesday Service', date: '2026-08-25', day: 'Tuesday', status: 'Published' },
  { id: 's16', name: 'Friday Service', date: '2026-08-28', day: 'Friday', status: 'Published' },
  { id: 's17', name: 'Igaburo Service', date: '2026-08-29', day: 'Saturday', status: 'Published' },
  { id: 's18', name: 'Sunday Service 1', date: '2026-08-30', day: 'Sunday', status: 'Published' },
  { id: 's19', name: 'Sunday Service 2', date: '2026-08-30', day: 'Sunday', status: 'Published' },
]

export const CHOIR_ASSIGNMENTS = [
  { service: 'Sunday Service 1', date: '02 Aug', choirs: 'Hope Choir, El Bethel Choir, Elim Choir', status: 'Assigned' },
  { service: 'Sunday Service 2', date: '02 Aug', choirs: "Ijwi ry'Umwami Yesu Choir, Integuza Choir, Yerusalemu Choir", status: 'Assigned' },
  { service: 'Sunday Service 1', date: '09 Aug', choirs: "Hope Choir, Ijwi ry'Umwami Yesu Choir, Integuza Choir", status: 'Assigned' },
  { service: 'Sunday Service 2', date: '09 Aug', choirs: 'El Bethel Choir, Elim Choir', status: 'Assigned' },
  { service: 'Sunday Service 1', date: '16 Aug', choirs: 'Hope Choir, El Bethel Choir, Integuza Choir', status: 'Assigned' },
  { service: 'Sunday Service 2', date: '16 Aug', choirs: "Ijwi ry'Umwami Yesu Choir, Elim Choir, Beulah Choir", status: 'Assigned' },
  { service: 'Sunday Service 1', date: '23 Aug', choirs: "Hope Choir, Elim Choir, Ijwi ry'Umwami Yesu Choir", status: 'Assigned' },
  { service: 'Sunday Service 2', date: '23 Aug', choirs: 'El Bethel Choir, Integuza Choir', status: 'Assigned' },
  { service: 'Sunday Service 1', date: '30 Aug', choirs: "Hope Choir, El Bethel Choir, Ijwi ry'Umwami Yesu Choir", status: 'Assigned' },
  { service: 'Sunday Service 2', date: '30 Aug', choirs: 'Elim Choir, Integuza Choir', status: 'Assigned' },
  { service: 'Tuesday Service', date: '04 Aug', choirs: 'El Bethel Choir', status: 'Assigned' },
  { service: 'Tuesday Service', date: '11 Aug', choirs: "Ijwi ry'Umwami Yesu Choir", status: 'Assigned' },
  { service: 'Tuesday Service', date: '18 Aug', choirs: 'Elim Choir', status: 'Assigned' },
  { service: 'Tuesday Service', date: '25 Aug', choirs: 'Integuza Choir', status: 'Assigned' },
  { service: 'Friday Service', date: '07 Aug', choirs: 'Integuza Choir', status: 'Assigned' },
  { service: 'Friday Service', date: '14 Aug', choirs: 'El Bethel Choir', status: 'Assigned' },
  { service: 'Friday Service', date: '21 Aug', choirs: "Ijwi ry'Umwami Yesu Choir", status: 'Assigned' },
  { service: 'Friday Service', date: '28 Aug', choirs: 'Elim Choir', status: 'Assigned' },
  { service: 'Igaburo Service', date: '29 Aug', choirs: 'El Bethel Choir, Integuza Choir', status: 'Assigned' },
]

export const TEAM_ASSIGNMENTS = buildMonthlyServiceTeams(PROTOCOL_NAMES, SERVICES, { shuffle: false })

export const LEADERSHIP = TEAM_ASSIGNMENTS.filter((t) => t.kind === 'sunday')
  .slice(0, 4)
  .map((t, i) => ({
    date: t.date,
    tl: t.teamLeader,
    vtl: t.viceTeamLeader,
    status: i < 3 ? 'Approved' : 'Pending approval',
  }))

export const VALIDATION_ROWS = [
  { rule: 'Hope Choir on Sunday Service 1', issue: 'Confirmed for all August Sunday Service 1 dates', severity: 'Passed', service: 'All SS1', status: 'Resolved' },
  { rule: 'Choir rotation', issue: 'El Bethel scheduled within 7-day window twice', severity: 'Warning', service: '14 Aug Friday', status: 'Open' },
  { rule: 'Secondary choir balance', issue: 'Beulah Choir used once this month', severity: 'Warning', service: '16 Aug SS2', status: 'Open' },
  { rule: 'Sunday team size', issue: 'All Sunday services filled with 10 members (incl. TL/VTL)', severity: 'Passed', service: 'August Sundays', status: 'Resolved' },
  { rule: 'Igaburo team size', issue: 'Igaburo Service filled with 10 members (incl. TL/VTL)', severity: 'Passed', service: '29 Aug Igaburo', status: 'Resolved' },
]

export const SCHEDULE_HISTORY = [
  { version: 'V3', date: '31 Jul 2026', by: 'David Mugisha', changes: 'Published August 2026 schedule' },
  { version: 'V2', date: '24 Jul 2026', by: 'David Mugisha', changes: 'Leadership assignments approved' },
  { version: 'V1', date: '17 Jul 2026', by: 'David Mugisha', changes: 'Choir schedule generated' },
]

export const ACTIVITIES = [
  { text: 'Schedule V3 published for August 2026', time: 'Today' },
  { text: 'Leadership assignments approved', time: '1d ago' },
  { text: 'Service teams built for August', time: '2d ago' },
  { text: 'Choir schedule generated for August', time: '3d ago' },
]

export const NOTIFICATIONS = [
  { title: 'Choir schedule generated', body: 'Choir schedule generated successfully', unread: false },
  { title: 'Service teams built', body: 'Service teams built successfully', unread: false },
  { title: 'Leadership approved', body: 'Leadership assignments approved', unread: false },
  { title: 'Schedule published', body: 'Schedule published for August 2026', unread: true },
]

export const ATTENDANCE_MONTHLY = {
  present: 145,
  halfPresent: 18,
  quarterPresent: 7,
  absent: 12,
  rate: '87%',
}

export const ATTENDANCE_SESSION_DEMO = {
  serviceDate: '2026-08-02',
  serviceType: 'Sunday Service 1',
  records: [
    { memberId: '6', status: 'Present' },
    { memberId: '8', status: 'Present' },
    { memberId: '7', status: 'Half Present' },
    { memberId: '11', status: 'Present' },
    { memberId: '12', status: 'Present' },
    { memberId: '13', status: 'Quarter Present' },
    { memberId: '15', status: 'Present' },
    { memberId: '17', status: 'Present' },
    { memberId: '19', status: 'Absent' },
    { memberId: '22', status: 'Present' },
  ],
}

export const LEADERSHIP_REPORT = [
  { member: 'Jean Bosco Ndayisaba', teamLeader: 3, viceLeader: 1 },
  { member: 'Marie Claire Uwamahoro', teamLeader: 2, viceLeader: 3 },
  { member: 'Théogène Hakizimana', teamLeader: 1, viceLeader: 2 },
  { member: 'Vestine Mukamurenzi', teamLeader: 2, viceLeader: 2 },
]

export const RECENT_ATTENDANCE = [
  { id: 1, service: 'Sunday Service 1', date: '02 Aug 2026', rate: '90%', status: 'Submitted' },
  { id: 2, service: 'Sunday Service 2', date: '02 Aug 2026', rate: '88%', status: 'Submitted' },
  { id: 3, service: 'Tuesday Service', date: '04 Aug 2026', rate: '85%', status: 'Submitted' },
  { id: 4, service: 'Friday Service', date: '07 Aug 2026', rate: '86%', status: 'Submitted' },
]
