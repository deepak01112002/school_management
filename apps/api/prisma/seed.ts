import { PrismaClient, BillingCycle, TenantStatus, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Permission sets per role
const PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  SCHOOL_OWNER: [
    'tenants:read', 'tenants:update',
    'users:read', 'users:create', 'users:update', 'users:delete',
    'students:read', 'students:create', 'students:update', 'students:delete', 'students:manage',
    'academic:read', 'academic:create', 'academic:update', 'academic:delete', 'academic:manage',
    'timetable:manage',
    'attendance:read', 'attendance:create', 'attendance:update',
    'fees:read', 'fees:create', 'fees:update', 'fees:manage',
    'exams:read', 'exams:create', 'exams:update', 'exams:delete', 'exams:publish',
    'exams:results:enter',
    'homework:read', 'homework:create', 'homework:manage', 'homework:evaluate',
    'staff:read', 'staff:create', 'staff:update', 'staff:delete', 'staff:manage',
    'payroll:read', 'payroll:generate', 'payroll:finalise', 'payroll:manage',
    'leave:read', 'leave:apply', 'leave:approve', 'leave:manage',
    'library:read', 'library:manage',
    'transport:read', 'transport:manage',
    'hostel:read', 'hostel:manage',
    'inventory:read', 'inventory:manage', 'inventory:create', 'inventory:update',
    'communication:read', 'communication:send', 'communication:broadcast', 'communication:manage',
    'reports:read', 'reports:export',
    'settings:read', 'settings:update',
    'subscriptions:read',
    'events:read', 'events:manage', 'events:register',
    'documents:read', 'documents:upload',
    'roles:read', 'roles:manage',
    'analytics:read',
  ],
  PRINCIPAL: [
    'users:read',
    'students:read', 'students:create', 'students:update', 'students:manage',
    'academic:read', 'academic:create', 'academic:update', 'academic:manage',
    'timetable:manage',
    'attendance:read', 'attendance:create', 'attendance:update',
    'fees:read',
    'exams:read', 'exams:create', 'exams:update', 'exams:publish',
    'exams:results:enter',
    'homework:read',
    'staff:read', 'staff:create', 'staff:update', 'staff:manage',
    'payroll:read',
    'leave:read', 'leave:approve',
    'library:read',
    'transport:read',
    'hostel:read',
    'inventory:read', 'inventory:manage', 'inventory:create', 'inventory:update',
    'communication:read', 'communication:send', 'communication:broadcast', 'communication:manage',
    'reports:read', 'reports:export',
    'settings:read',
    'events:read', 'events:manage', 'events:register',
    'documents:read', 'documents:upload',
    'roles:read',
    'analytics:read',
  ],
  VICE_PRINCIPAL: [
    'users:read',
    'students:read', 'students:create', 'students:update',
    'academic:read', 'academic:create', 'academic:update',
    'timetable:manage',
    'attendance:read',
    'fees:read',
    'exams:read', 'exams:create', 'exams:update',
    'homework:read',
    'staff:read',
    'payroll:read',
    'leave:read', 'leave:approve',
    'library:read',
    'transport:read',
    'hostel:read',
    'inventory:read',
    'communication:read', 'communication:send', 'communication:broadcast',
    'reports:read', 'reports:export',
    'events:read', 'events:register',
    'documents:read',
    'analytics:read',
  ],
  ACCOUNTANT: [
    'students:read',
    'fees:read', 'fees:create', 'fees:update', 'fees:manage',
    'payroll:read', 'payroll:generate', 'payroll:finalise', 'payroll:manage',
    'leave:read',
    'inventory:read', 'inventory:manage', 'inventory:create', 'inventory:update',
    'communication:read',
    'reports:read', 'reports:export',
    'documents:read',
    'analytics:read',
  ],
  TEACHER: [
    'students:read',
    'academic:read',
    'timetable:manage',
    'attendance:read', 'attendance:create', 'attendance:update',
    'exams:read', 'exams:create', 'exams:update',
    'exams:results:enter',
    'homework:read', 'homework:create', 'homework:manage', 'homework:evaluate',
    'staff:read',
    'leave:read', 'leave:apply', 'leave:approve',
    'communication:read', 'communication:send',
    'reports:read',
    'events:read', 'events:register',
    'documents:read', 'documents:upload',
  ],
  CLASS_TEACHER: [
    'students:read',
    'academic:read',
    'timetable:manage',
    'attendance:read', 'attendance:create', 'attendance:update',
    'exams:read', 'exams:create', 'exams:update',
    'exams:results:enter',
    'homework:read', 'homework:create', 'homework:manage', 'homework:evaluate', 'homework:submit',
    'staff:read',
    'leave:read', 'leave:apply', 'leave:approve',
    'communication:read', 'communication:send',
    'reports:read',
    'events:read', 'events:register',
    'documents:read', 'documents:upload',
  ],
  LIBRARIAN: [
    'students:read',
    'library:read', 'library:manage',
    'communication:read',
    'reports:read',
    'documents:read',
  ],
  TRANSPORT_MANAGER: [
    'students:read',
    'transport:read', 'transport:manage',
    'staff:read',
    'communication:read',
    'reports:read',
    'documents:read',
  ],
  HOSTEL_WARDEN: [
    'students:read',
    'hostel:read', 'hostel:manage',
    'staff:read',
    'communication:read',
    'reports:read',
    'documents:read',
  ],
  RECEPTIONIST: [
    'students:read', 'students:create', 'students:update',
    'communication:read',
    'events:read',
    'documents:read', 'documents:upload',
  ],
  PARENT: [
    'students:read',
    'attendance:read',
    'fees:read',
    'exams:read',
    'homework:read',
    'communication:read', 'communication:send',
    'events:read', 'events:register',
    'documents:read',
    'transport:read',
    'hostel:read',
  ],
  STUDENT: [
    'academic:read',
    'attendance:read',
    'fees:read',
    'exams:read',
    'homework:read', 'homework:submit',
    'communication:read',
    'events:read', 'events:register',
    'library:read',
    'transport:read',
    'hostel:read',
    'documents:read',
  ],
};

async function main() {
  console.log('🌱 Seeding database...');

  // ─── 1. Platform-level Super Admin role ───
  // tenantId is null for platform-level roles — use findFirst + create pattern
  let superAdminRole = await prisma.role.findFirst({
    where: { tenantId: null, name: 'Super Admin' },
  });
  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        tenantId: null,
        name: 'Super Admin',
        permissions: PERMISSIONS.SUPER_ADMIN,
        isSystem: true,
      },
    });
  }
  console.log('✅ Super Admin role created');

  // ─── 2. Super Admin User ───
  const superAdminPasswordHash = await bcrypt.hash('Admin@123456', 12);
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { tenantId: null, email: 'superadmin@school-erp.com' },
  });
  if (!existingSuperAdmin) {
    await prisma.user.create({
      data: {
        tenantId: null,
        email: 'superadmin@school-erp.com',
        passwordHash: superAdminPasswordHash,
        firstName: 'Super',
        lastName: 'Admin',
        roleId: superAdminRole.id,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
  }
  console.log('✅ Super Admin user created: superadmin@school-erp.com / Admin@123456');

  // ─── 3. Default Subscription Plans ───
  const plans = [
    {
      name: 'Starter',
      price: 2999,
      billingCycle: BillingCycle.MONTHLY,
      studentLimit: 200,
      staffLimit: 20,
      features: ['students', 'attendance', 'fees', 'exams', 'homework', 'communication'],
    },
    {
      name: 'Growth',
      price: 7999,
      billingCycle: BillingCycle.MONTHLY,
      studentLimit: 1000,
      staffLimit: 100,
      features: ['students', 'attendance', 'fees', 'exams', 'homework', 'communication', 'library', 'transport', 'hostel', 'payroll', 'leave'],
    },
    {
      name: 'Enterprise',
      price: 19999,
      billingCycle: BillingCycle.MONTHLY,
      studentLimit: 5000,
      staffLimit: 500,
      features: ['*'],
    },
    {
      name: 'Starter Annual',
      price: 29990,
      billingCycle: BillingCycle.ANNUAL,
      studentLimit: 200,
      staffLimit: 20,
      features: ['students', 'attendance', 'fees', 'exams', 'homework', 'communication'],
    },
    {
      name: 'Growth Annual',
      price: 79990,
      billingCycle: BillingCycle.ANNUAL,
      studentLimit: 1000,
      staffLimit: 100,
      features: ['students', 'attendance', 'fees', 'exams', 'homework', 'communication', 'library', 'transport', 'hostel', 'payroll', 'leave'],
    },
    {
      name: 'Enterprise Annual',
      price: 199990,
      billingCycle: BillingCycle.ANNUAL,
      studentLimit: 5000,
      staffLimit: 500,
      features: ['*'],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {},
      create: {
        name: plan.name,
        price: plan.price,
        billingCycle: plan.billingCycle,
        studentLimit: plan.studentLimit,
        staffLimit: plan.staffLimit,
        features: plan.features,
        isActive: true,
      },
    });
  }
  console.log('✅ Subscription plans created (6 plans)');

  // ─── 4. Demo Tenant ───
  const starterPlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Starter' } });
  if (!starterPlan) throw new Error('Starter plan not found');

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  const demoTenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      subdomain: 'demo',
      name: 'Demo School',
      email: 'info@demoschool.com',
      phone: '+91-9876543210',
      address: '123 School Street, Education City, Maharashtra 400001',
      status: TenantStatus.TRIAL,
      trialEndsAt: trialEnd,
      primaryColor: '#4F46E5',
      secondaryColor: '#818CF8',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      locale: 'en',
    },
  });
  console.log(`✅ Demo tenant created: demo.school-erp.com`);

  // Create subscription for demo tenant
  await prisma.subscription.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      planId: starterPlan.id,
      status: SubscriptionStatus.TRIAL,
      startDate: new Date(),
      trialStartDate: new Date(),
      trialEndDate: trialEnd,
    },
  });

  // ─── 5. Seed all 12 tenant-level roles for demo tenant ───
  const tenantRoles = [
    { name: 'School Owner', permissions: PERMISSIONS.SCHOOL_OWNER },
    { name: 'Principal', permissions: PERMISSIONS.PRINCIPAL },
    { name: 'Vice Principal', permissions: PERMISSIONS.VICE_PRINCIPAL },
    { name: 'Accountant', permissions: PERMISSIONS.ACCOUNTANT },
    { name: 'Teacher', permissions: PERMISSIONS.TEACHER },
    { name: 'Class Teacher', permissions: PERMISSIONS.CLASS_TEACHER },
    { name: 'Librarian', permissions: PERMISSIONS.LIBRARIAN },
    { name: 'Transport Manager', permissions: PERMISSIONS.TRANSPORT_MANAGER },
    { name: 'Hostel Warden', permissions: PERMISSIONS.HOSTEL_WARDEN },
    { name: 'Receptionist', permissions: PERMISSIONS.RECEPTIONIST },
    { name: 'Parent', permissions: PERMISSIONS.PARENT },
    { name: 'Student', permissions: PERMISSIONS.STUDENT },
  ];

  const createdRoles: Record<string, string> = {};
  for (const roleData of tenantRoles) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: demoTenant.id, name: roleData.name } },
      update: { permissions: roleData.permissions },
      create: {
        tenantId: demoTenant.id,
        name: roleData.name,
        permissions: roleData.permissions,
        isSystem: true,
      },
    });
    createdRoles[roleData.name] = role.id;
  }
  console.log('✅ 12 tenant roles created for demo tenant');

  // ─── 6. School Owner User for demo tenant ───
  const ownerPasswordHash = await bcrypt.hash('Owner@123456', 12);
  const schoolOwnerRoleId = createdRoles['School Owner'];

  const existingOwner = await prisma.user.findFirst({
    where: { tenantId: demoTenant.id, email: 'owner@demo.school-erp.com' },
  });
  if (!existingOwner) {
    await prisma.user.create({
      data: {
        tenantId: demoTenant.id,
        email: 'owner@demo.school-erp.com',
        passwordHash: ownerPasswordHash,
        firstName: 'School',
        lastName: 'Owner',
        roleId: schoolOwnerRoleId,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
  }
  console.log('✅ School Owner user created: owner@demo.school-erp.com / Owner@123456');

  // ─── 7. Seed default AcademicYear for demo tenant ───
  const currentYear = new Date().getFullYear();
  const academicYearName = `${currentYear}-${String(currentYear + 1).slice(2)}`;
  await prisma.academicYear.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: academicYearName } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: academicYearName,
      startDate: new Date(`${currentYear}-04-01`),
      endDate: new Date(`${currentYear + 1}-03-31`),
      isActive: true,
    },
  });
  console.log(`✅ Default academic year created: ${academicYearName}`);

  // ─── 8. Seed platform-level Permission catalog ───
  const permissionCatalog = [
    { module: 'tenants', action: 'read', description: 'View tenant list and details' },
    { module: 'tenants', action: 'create', description: 'Create new tenants' },
    { module: 'tenants', action: 'update', description: 'Update tenant details' },
    { module: 'tenants', action: 'delete', description: 'Delete/suspend tenants' },
    { module: 'users', action: 'read', description: 'View user profiles' },
    { module: 'users', action: 'create', description: 'Create new users' },
    { module: 'users', action: 'update', description: 'Update user profiles' },
    { module: 'users', action: 'delete', description: 'Deactivate users' },
    { module: 'students', action: 'read', description: 'View student records' },
    { module: 'students', action: 'create', description: 'Add new students' },
    { module: 'students', action: 'update', description: 'Update student records' },
    { module: 'students', action: 'delete', description: 'Delete student records' },
    { module: 'students', action: 'manage', description: 'Full student management' },
    { module: 'academic', action: 'read', description: 'View academic structure' },
    { module: 'academic', action: 'create', description: 'Create academic structures' },
    { module: 'academic', action: 'update', description: 'Update academic structures' },
    { module: 'academic', action: 'delete', description: 'Delete academic structures' },
    { module: 'academic', action: 'manage', description: 'Full academic management' },
    { module: 'timetable', action: 'manage', description: 'Manage timetables' },
    { module: 'attendance', action: 'read', description: 'View attendance records' },
    { module: 'attendance', action: 'create', description: 'Mark attendance' },
    { module: 'attendance', action: 'update', description: 'Update attendance records' },
    { module: 'fees', action: 'read', description: 'View fee records' },
    { module: 'fees', action: 'create', description: 'Record fee payments' },
    { module: 'fees', action: 'update', description: 'Update fee records' },
    { module: 'fees', action: 'manage', description: 'Full fee management' },
    { module: 'exams', action: 'read', description: 'View exam details' },
    { module: 'exams', action: 'create', description: 'Create exams' },
    { module: 'exams', action: 'update', description: 'Update exams' },
    { module: 'exams', action: 'delete', description: 'Delete exams' },
    { module: 'exams', action: 'publish', description: 'Publish exam results' },
    { module: 'exams', action: 'results:enter', description: 'Enter exam marks' },
    { module: 'homework', action: 'read', description: 'View assignments' },
    { module: 'homework', action: 'create', description: 'Create assignments' },
    { module: 'homework', action: 'manage', description: 'Manage assignments' },
    { module: 'homework', action: 'evaluate', description: 'Evaluate submissions' },
    { module: 'homework', action: 'submit', description: 'Submit homework' },
    { module: 'staff', action: 'read', description: 'View staff records' },
    { module: 'staff', action: 'create', description: 'Add new staff' },
    { module: 'staff', action: 'update', description: 'Update staff records' },
    { module: 'staff', action: 'delete', description: 'Remove staff' },
    { module: 'staff', action: 'manage', description: 'Full staff management' },
    { module: 'payroll', action: 'read', description: 'View payroll records' },
    { module: 'payroll', action: 'generate', description: 'Generate payroll' },
    { module: 'payroll', action: 'finalise', description: 'Finalise payroll' },
    { module: 'payroll', action: 'manage', description: 'Full payroll management' },
    { module: 'leave', action: 'read', description: 'View leave records' },
    { module: 'leave', action: 'apply', description: 'Apply for leave' },
    { module: 'leave', action: 'approve', description: 'Approve/reject leave' },
    { module: 'leave', action: 'manage', description: 'Manage leave policies' },
    { module: 'library', action: 'read', description: 'View library records' },
    { module: 'library', action: 'manage', description: 'Manage library' },
    { module: 'transport', action: 'read', description: 'View transport records' },
    { module: 'transport', action: 'manage', description: 'Manage transport' },
    { module: 'hostel', action: 'read', description: 'View hostel records' },
    { module: 'hostel', action: 'manage', description: 'Manage hostel' },
    { module: 'inventory', action: 'read', description: 'View inventory' },
    { module: 'inventory', action: 'create', description: 'Add inventory items' },
    { module: 'inventory', action: 'update', description: 'Update inventory' },
    { module: 'inventory', action: 'manage', description: 'Full inventory management' },
    { module: 'communication', action: 'read', description: 'View messages' },
    { module: 'communication', action: 'send', description: 'Send messages' },
    { module: 'communication', action: 'broadcast', description: 'Broadcast announcements' },
    { module: 'communication', action: 'manage', description: 'Manage communications' },
    { module: 'reports', action: 'read', description: 'View reports' },
    { module: 'reports', action: 'export', description: 'Export reports' },
    { module: 'settings', action: 'read', description: 'View settings' },
    { module: 'settings', action: 'update', description: 'Update settings' },
    { module: 'subscriptions', action: 'read', description: 'View subscriptions' },
    { module: 'subscriptions', action: 'manage', description: 'Manage subscriptions' },
    { module: 'events', action: 'read', description: 'View events' },
    { module: 'events', action: 'manage', description: 'Manage events' },
    { module: 'events', action: 'register', description: 'Register for events' },
    { module: 'documents', action: 'read', description: 'View documents' },
    { module: 'documents', action: 'upload', description: 'Upload documents' },
    { module: 'roles', action: 'read', description: 'View roles' },
    { module: 'roles', action: 'manage', description: 'Manage roles and permissions' },
    { module: 'analytics', action: 'read', description: 'View analytics' },
  ];

  for (const perm of permissionCatalog) {
    await prisma.permission.upsert({
      where: { module_action: { module: perm.module, action: perm.action } },
      update: {},
      create: perm,
    });
  }
  console.log(`✅ ${permissionCatalog.length} permissions seeded`);

  console.log('\n🎉 Seeding complete!\n');
  console.log('Demo credentials:');
  console.log('  Super Admin : superadmin@school-erp.com / Admin@123456');
  console.log('  School Owner: owner@demo.school-erp.com / Owner@123456');
  console.log('  Subdomain   : demo.school-erp.com\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
