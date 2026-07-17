export enum Permission {
  // Tenant management
  TENANT_CREATE = 'tenant:create',
  TENANT_READ = 'tenant:read',
  TENANT_UPDATE = 'tenant:update',
  TENANT_DELETE = 'tenant:delete',

  // User management
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Student management
  STUDENT_CREATE = 'student:create',
  STUDENT_READ = 'student:read',
  STUDENT_UPDATE = 'student:update',
  STUDENT_DELETE = 'student:delete',
  STUDENT_ENROLL = 'student:enroll',

  // Academic management
  ACADEMIC_CREATE = 'academic:create',
  ACADEMIC_READ = 'academic:read',
  ACADEMIC_UPDATE = 'academic:update',
  ACADEMIC_DELETE = 'academic:delete',

  // Attendance
  ATTENDANCE_MARK = 'attendance:mark',
  ATTENDANCE_READ = 'attendance:read',
  ATTENDANCE_UPDATE = 'attendance:update',
  ATTENDANCE_REPORT = 'attendance:report',

  // Fees & Finance
  FEE_CREATE = 'fee:create',
  FEE_READ = 'fee:read',
  FEE_UPDATE = 'fee:update',
  FEE_DELETE = 'fee:delete',
  FEE_COLLECT = 'fee:collect',
  FEE_REPORT = 'fee:report',

  // Payroll
  PAYROLL_CREATE = 'payroll:create',
  PAYROLL_READ = 'payroll:read',
  PAYROLL_UPDATE = 'payroll:update',
  PAYROLL_APPROVE = 'payroll:approve',

  // Examinations
  EXAM_CREATE = 'exam:create',
  EXAM_READ = 'exam:read',
  EXAM_UPDATE = 'exam:update',
  EXAM_DELETE = 'exam:delete',
  EXAM_GRADE = 'exam:grade',
  EXAM_PUBLISH = 'exam:publish',

  // Library
  LIBRARY_MANAGE = 'library:manage',
  LIBRARY_READ = 'library:read',
  LIBRARY_ISSUE = 'library:issue',

  // Transport
  TRANSPORT_MANAGE = 'transport:manage',
  TRANSPORT_READ = 'transport:read',

  // Communication
  COMMUNICATION_SEND = 'communication:send',
  COMMUNICATION_READ = 'communication:read',

  // Reports
  REPORT_GENERATE = 'report:generate',
  REPORT_READ = 'report:read',
  REPORT_EXPORT = 'report:export',

  // Settings
  SETTINGS_READ = 'settings:read',
  SETTINGS_UPDATE = 'settings:update',
}
