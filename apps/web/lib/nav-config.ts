export interface NavItem {
  title: string;
  href: string;
  icon: string; // lucide icon name
  permission?: string;   // single required permission (AND)
  permissions?: string[]; // any of these is sufficient (OR)
  children?: NavItem[];
}

export const navConfig: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
  {
    title: 'Students',
    href: '/students',
    icon: 'Users',
    permission: 'students:read',
  },
  {
    title: 'Academic',
    href: '/academic',
    icon: 'BookOpen',
    permission: 'academic:read',
    children: [
      {
        title: 'Classes',
        href: '/academic/classes',
        icon: 'School',
      },
      {
        title: 'Subjects',
        href: '/academic/subjects',
        icon: 'BookMarked',
      },
      {
        title: 'Timetable',
        href: '/academic/timetable',
        icon: 'Calendar',
      },
    ],
  },
  {
    title: 'Attendance',
    href: '/attendance',
    icon: 'ClipboardList',
    permission: 'attendance:read',
  },
  {
    title: 'Fees',
    href: '/fees',
    icon: 'CreditCard',
    permission: 'fees:read',
  },
  {
    title: 'Exams',
    href: '/exams',
    icon: 'FileText',
    permission: 'exams:read',
  },
  {
    title: 'Homework',
    href: '/homework',
    icon: 'PenLine',
    permission: 'homework:read',
  },
  {
    title: 'Staff',
    href: '/staff',
    icon: 'Briefcase',
    permission: 'staff:read',
  },
  {
    title: 'Payroll',
    href: '/payroll',
    icon: 'Wallet',
    permission: 'payroll:read',
  },
  {
    title: 'Leaves',
    href: '/leaves',
    icon: 'CalendarOff',
    // students: attendance:read, teachers: leave:read, admins: leave:approve
    permissions: ['attendance:read', 'leave:read', 'leave:approve'],
  },
  {
    title: 'Library',
    href: '/library',
    icon: 'Library',
    permission: 'library:read',
  },
  {
    title: 'Transport',
    href: '/transport',
    icon: 'Bus',
    permission: 'transport:read',
  },
  {
    title: 'Hostel',
    href: '/hostel',
    icon: 'Building2',
    permission: 'hostel:read',
  },
  {
    title: 'Inventory',
    href: '/inventory',
    icon: 'Package',
    permission: 'inventory:read',
  },
  {
    title: 'Events',
    href: '/events',
    icon: 'CalendarDays',
    permission: 'events:read',
  },
  {
    title: 'Messages',
    href: '/communication',
    icon: 'MessageSquare',
    permission: 'communication:read',
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: 'BarChart2',
    permission: 'reports:read',
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: 'Settings',
    permission: 'settings:read',
  },
];

export const superAdminNavConfig: NavItem[] = [
  { title: 'Platform', href: '/admin', icon: 'LayoutDashboard' },
  { title: 'Schools', href: '/admin/schools', icon: 'Building' },
  { title: 'Subscriptions', href: '/admin/subscriptions', icon: 'CreditCard' },
  { title: 'Monitoring', href: '/admin/monitoring', icon: 'Activity' },
];
