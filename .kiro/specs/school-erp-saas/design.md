# Technical Design: School ERP SaaS Platform

## 1. System Architecture Overview

### 1.1 Monorepo Structure

The platform is organised as a monorepo using a turborepo-compatible layout:

```
school-erp/
├── apps/
│   ├── api/                  # NestJS backend
│   ├── web/                  # Next.js 14 frontend
│   └── worker/               # BullMQ queue worker process
├── packages/
│   ├── shared/               # Shared types, DTOs, constants, enums
│   ├── ui/                   # Shared ShadCN/TailwindCSS component library
│   └── config/               # Shared ESLint, TypeScript, Tailwind configs
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── turbo.json
└── package.json
```

### 1.2 High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client Browser                            │
│              Next.js 14 App Router (apps/web)                    │
│         ShadCN UI · TailwindCSS · Zustand · TanStack Query       │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS (subdomain-based)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Nginx Reverse Proxy                             │
│        Subdomain routing: *.school-erp.com → API/Web            │
└────────────────┬──────────────────────────┬─────────────────────┘
                 │                          │
                 ▼                          ▼
┌────────────────────────┐    ┌─────────────────────────────────┐
│   NestJS REST API      │    │   Next.js SSR/SSG Server        │
│   (apps/api)           │    │   (apps/web)                    │
│   Port 3001            │    │   Port 3000                     │
│                        │    └─────────────────────────────────┘
│  • Tenant Middleware   │
│  • JWT Auth Guards     │
│  • RBAC Guards         │
│  • Swagger Docs        │
│  • Rate Limiting       │
└──────┬──────┬──────────┘
       │      │
       │      └──────────────────────────┐
       ▼                                 ▼
┌──────────────┐  ┌──────────┐  ┌───────────────┐
│  PostgreSQL  │  │  Redis   │  │  MinIO / S3   │
│  (Prisma)    │  │  Cache + │  │  File Storage │
│  Port 5432   │  │  BullMQ  │  │  Port 9000    │
└──────────────┘  │  Port    │  └───────────────┘
                  │  6379    │
                  └────┬─────┘
                       │
                       ▼
              ┌────────────────┐
              │  BullMQ Worker │
              │  (apps/worker) │
              │                │
              │ • Notifications│
              │ • CSV Imports  │
              │ • Report Gen   │
              │ • Payroll Gen  │
              │ • Fee Reminders│
              └────────────────┘
```

### 1.3 Request Lifecycle

Every inbound API request passes through this middleware chain:

```
Request
  └─► Nginx (TLS termination, subdomain extract)
        └─► NestJS Global Middleware
              └─► TenantResolverMiddleware  (resolves tenantId from Host header)
                    └─► JwtAuthGuard        (validates Bearer token)
                          └─► RbacGuard     (checks role permissions)
                                └─► Controller
                                      └─► Service (Prisma with tenantId filter)
                                            └─► Response
```

---

## 2. Multi-Tenant Strategy

### 2.1 Subdomain-Based Tenant Resolution

Each school is assigned a unique subdomain at onboarding (e.g., `greenwood.school-erp.com`). The subdomain is the primary tenant identifier on every request.

```typescript
// apps/api/src/common/middleware/tenant-resolver.middleware.ts
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = req.hostname; // e.g., "greenwood.school-erp.com"
    const subdomain = host.split('.')[0];

    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain, deletedAt: null },
      select: { id: true, status: true, subdomain: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant '${subdomain}' not found`);
    }

    if (tenant.status === 'SUSPENDED') {
      throw new ForbiddenException('Tenant account is suspended');
    }

    req['tenantContext'] = { tenantId: tenant.id, subdomain: tenant.subdomain };
    next();
  }
}
```

### 2.2 Tenant Context Propagation

The tenant context is attached to every request via a custom decorator and propagated through the entire NestJS request scope:

```typescript
// apps/api/src/common/decorators/tenant.decorator.ts
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request['tenantContext']?.tenantId;
  },
);
```

### 2.3 Row-Level Data Isolation via Prisma Middleware

A global Prisma extension enforces `tenantId` filtering on every query automatically, preventing cross-tenant data leakage:

```typescript
// apps/api/src/common/prisma/prisma.service.ts
export class PrismaService extends PrismaClient {
  withTenant(tenantId: string) {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query, operation, model }) {
            const TENANT_EXEMPT = ['Tenant', 'SubscriptionPlan', 'Permission'];
            if (TENANT_EXEMPT.includes(model)) return query(args);

            if (['findMany', 'findFirst', 'count', 'aggregate'].includes(operation)) {
              args.where = { ...args.where, tenantId };
            }
            if (['create'].includes(operation)) {
              args.data = { ...args.data, tenantId };
            }
            if (['updateMany', 'deleteMany'].includes(operation)) {
              args.where = { ...args.where, tenantId };
            }
            return query(args);
          },
        },
      },
    });
  }
}
```

### 2.4 Tenant Provisioning Flow

When a new school signs up, the following steps execute atomically in a database transaction:

```
1. Create Tenant record (subdomain, name, branding, trial dates)
2. Create default SubscriptionPlan link (trial)
3. Seed system Roles for tenant (Super Admin skipped — platform level)
   - School Owner, Principal, Vice Principal, Accountant, Teacher,
     Class Teacher, Librarian, Transport Manager, Hostel Warden,
     Receptionist, Parent, Student
4. Create default AcademicYear (current year)
5. Create School Owner User account
6. Send welcome email with login credentials (via notifications queue)
7. Log onboarding event in AuditLog
```

---

## 3. Authentication & RBAC Design

### 3.1 JWT + Refresh Token Flow

```
┌──────────┐        POST /auth/login         ┌───────────────────┐
│  Client  │──── { email, password } ───────►│  AuthService      │
│          │                                 │                   │
│          │◄── { accessToken, expiresIn } ──│  Issues:          │
│          │    Set-Cookie: refreshToken      │  • Access JWT     │
│          │    (httpOnly, Secure, SameSite)  │    (15 min)       │
│          │                                 │  • Refresh Token  │
│          │    API calls with               │    (7 days)       │
│          │    Authorization: Bearer <AT>   │                   │
│          │──────────────────────────────► │                   │
│          │                                 │                   │
│          │    POST /auth/refresh           │                   │
│          │    Cookie: refreshToken ───────►│  Validates hash,  │
│          │◄── { accessToken, expiresIn } ──│  issues new AT    │
└──────────┘                                 └───────────────────┘
```

**Token specifications:**
- Access Token: JWT signed with RS256, 15-minute TTL, stored in memory (never localStorage)
- Refresh Token: Cryptographically random 64-byte hex string, hashed (bcrypt) before storage in Session table, 7-day TTL, stored in httpOnly Secure SameSite=Strict cookie
- Rotation: Every refresh issues a new refresh token and invalidates the old one (single-use tokens)

### 3.2 Token Storage Strategy

| Token | Storage | Why |
|-------|---------|-----|
| Access Token | In-memory (Zustand store) | No XSS persistence; lost on tab close forces refresh |
| Refresh Token | httpOnly Secure cookie | Not accessible by JS; prevents XSS token theft |
| 2FA Secret | Encrypted DB column | Never exposed via API |

### 3.3 RBAC Guard Implementation

```typescript
// apps/api/src/common/guards/rbac.guard.ts
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException();

    const userPermissions: string[] = user.role?.permissions ?? [];
    const hasAll = requiredPermissions.every(p => userPermissions.includes(p));

    if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

// Usage on controllers:
@RequirePermissions('students:read')
@Get()
findAll() { ... }
```

### 3.4 Permission Matrix (13 Roles × Key Modules)

| Module | Super Admin | School Owner | Principal | Vice Principal | Accountant | Teacher | Class Teacher | Librarian | Transport Mgr | Hostel Warden | Receptionist | Parent | Student |
|--------|:-----------:|:------------:|:---------:|:--------------:|:----------:|:-------:|:-------------:|:---------:|:-------------:|:-------------:|:------------:|:------:|:-------:|
| Tenants (CRUD) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Users (CRUD) | ✅ | ✅ | R | R | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Students (CRUD) | ✅ | ✅ | ✅ | ✅ | R | R | R | R | ❌ | R | ✅ | R-own | R-own |
| Academic Config | ✅ | ✅ | ✅ | ✅ | ❌ | R | R | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Attendance | ✅ | ✅ | R | R | ❌ | CRU | CRU | ❌ | ❌ | ❌ | R | R-own | R-own |
| Fees | ✅ | ✅ | R | R | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | R | R-own | R-own |
| Exams | ✅ | ✅ | ✅ | ✅ | ❌ | CRU | CRU | ❌ | ❌ | ❌ | ❌ | R-own | R-own |
| Homework | ✅ | ✅ | R | R | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | R-own | CR |
| Staff (CRUD) | ✅ | ✅ | ✅ | R | R | R-own | R-own | R-own | R-own | R-own | ❌ | ❌ | ❌ |
| Payroll | ✅ | ✅ | R | ❌ | ✅ | R-own | R-own | R-own | R-own | R-own | ❌ | ❌ | ❌ |
| Leave | ✅ | ✅ | ✅ | ✅ | R | CR | CR | CR | CR | CR | ❌ | ❌ | ❌ |
| Library | ✅ | ✅ | R | R | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | R-own |
| Transport | ✅ | ✅ | R | R | R | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | R-own | R-own |
| Hostel | ✅ | ✅ | R | R | R | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | R-own | R-own |
| Inventory | ✅ | ✅ | ✅ | R | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Communication | ✅ | ✅ | ✅ | ✅ | R | CRU | CRU | R | R | R | R | R-own | R-own |
| Reports | ✅ | ✅ | ✅ | ✅ | ✅ | R-own | R-own | R-own | R-own | R-own | ❌ | ❌ | ❌ |
| Settings | ✅ | ✅ | R | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Subscriptions | ✅ | R | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Legend: ✅ Full CRUD · R Read · CR Create+Read · CRU Create+Read+Update · R-own Read own records · ❌ No access

### 3.5 Custom Roles with JSON Permission Array

```typescript
// Permissions stored as JSON array in Role.permissions
// Format: "<module>:<action>"
const exampleCustomRole = {
  name: "Academic Coordinator",
  tenantId: "tenant-uuid",
  isSystem: false,
  permissions: [
    "students:read",
    "academic:read",
    "academic:create",
    "academic:update",
    "timetable:manage",
    "attendance:read",
    "exams:read",
    "exams:create",
    "exams:update",
  ],
};
```

---

## 4. Database Schema Design (Prisma)

### 4.1 Complete Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────

enum TenantStatus {
  ACTIVE
  SUSPENDED
  TRIAL
  CANCELLED
}

enum SubscriptionStatus {
  ACTIVE
  TRIAL
  PAST_DUE
  CANCELLED
  EXPIRED
}

enum BillingCycle {
  MONTHLY
  QUARTERLY
  ANNUAL
}

enum UserStatus {
  ACTIVE
  INACTIVE
  LOCKED
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum StudentStatus {
  ENQUIRY
  REGISTERED
  ADMITTED
  ALUMNI
  WITHDRAWN
}

enum SubjectType {
  CORE
  ELECTIVE
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

enum StaffAttendanceStatus {
  PRESENT
  ABSENT
  ON_LEAVE
  HALF_DAY
}

enum FeeType {
  TUITION
  TRANSPORT
  HOSTEL
  LIBRARY
  LATE
  OTHER
}

enum FeeFrequency {
  MONTHLY
  QUARTERLY
  ANNUAL
  ONE_TIME
}

enum PaymentMethod {
  CASH
  UPI
  BANK_TRANSFER
  RAZORPAY
  STRIPE
  CHEQUE
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
  PARTIAL
}

enum ExamStatus {
  SCHEDULED
  ONGOING
  COMPLETED
  PUBLISHED
}

enum AssignmentStatus {
  ACTIVE
  CLOSED
}

enum SubmissionStatus {
  PENDING
  SUBMITTED
  EVALUATED
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  PROBATION
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum PayrollStatus {
  DRAFT
  FINALISED
}

enum PayrollItemType {
  ALLOWANCE
  DEDUCTION
  BONUS
}

enum BookIssueStatus {
  ISSUED
  RETURNED
  LOST
}

enum FineStatus {
  PENDING
  PAID
  WAIVED
}

enum BorrowerType {
  STUDENT
  STAFF
}

enum TransportVehicleType {
  BUS
  VAN
  AUTO
  OTHER
}

enum MealPlan {
  NONE
  BREAKFAST
  BREAKFAST_DINNER
  ALL
}

enum HostelAllocationStatus {
  ACTIVE
  VACATED
}

enum MealType {
  BREAKFAST
  LUNCH
  DINNER
}

enum NotificationChannel {
  IN_APP
  SMS
  EMAIL
  WHATSAPP
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  READ
}

enum AnnouncementTarget {
  ALL
  STAFF
  PARENTS
  CLASS
  STUDENTS
}

enum EventType {
  ACADEMIC
  SPORTS
  CULTURAL
  HOLIDAY
  OTHER
}

enum EventAudience {
  ALL
  STUDENTS
  STAFF
  PARENTS
}

enum EventRegistrationStatus {
  REGISTERED
  CANCELLED
  ATTENDED
}

enum InventoryPurchaseStatus {
  DRAFT
  ORDERED
  PARTIAL
  RECEIVED
  CANCELLED
}

enum MaintenanceStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum PromotionStatus {
  PROMOTED
  RETAINED
  TC
}

enum HolidayType {
  NATIONAL
  REGIONAL
  SCHOOL
  RELIGIOUS
}

enum RelationType {
  FATHER
  MOTHER
  GUARDIAN
  SIBLING
  OTHER
}

enum BloodGroup {
  A_POS
  A_NEG
  B_POS
  B_NEG
  AB_POS
  AB_NEG
  O_POS
  O_NEG
}
```

```prisma
// ─────────────────────────────────────────────────────
// PLATFORM / CORE TABLES
// ─────────────────────────────────────────────────────

model Tenant {
  id              String        @id @default(cuid())
  subdomain       String        @unique
  name            String
  logoUrl         String?
  primaryColor    String        @default("#4F46E5")
  secondaryColor  String        @default("#818CF8")
  address         String?
  phone           String?
  email           String?
  website         String?
  status          TenantStatus  @default(TRIAL)
  trialEndsAt     DateTime?
  subscriptionId  String?
  timezone        String        @default("Asia/Kolkata")
  currency        String        @default("INR")
  locale          String        @default("en")
  settings        Json          @default("{}")
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  deletedAt       DateTime?

  subscription    Subscription?
  users           User[]
  academicYears   AcademicYear[]
  auditLogs       AuditLog[]
  sessions        Session[]

  @@index([subdomain])
  @@index([status])
  @@map("tenants")
}

model User {
  id                String      @id @default(cuid())
  tenantId          String?     // null for Super Admin (platform level)
  email             String
  passwordHash      String
  firstName         String
  lastName          String
  phone             String?
  roleId            String
  isActive          Boolean     @default(true)
  status            UserStatus  @default(ACTIVE)
  emailVerifiedAt   DateTime?
  twoFactorSecret   String?
  twoFactorEnabled  Boolean     @default(false)
  failedLoginCount  Int         @default(0)
  lockedUntil       DateTime?
  lastLoginAt       DateTime?
  passwordChangedAt DateTime?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  deletedAt         DateTime?

  tenant            Tenant?     @relation(fields: [tenantId], references: [id])
  role              Role        @relation(fields: [roleId], references: [id])
  sessions          Session[]
  auditLogs         AuditLog[]
  staff             Staff?
  parent            Parent?
  studentProfile    Student?    @relation("StudentUser")
  sentMessages      Message[]   @relation("MessageSender")
  receivedMessages  Message[]   @relation("MessageRecipient")
  announcements     Announcement[] @relation("AnnouncementAuthor")
  notifications     Notification[]
  assignments       Assignment[] @relation("AssignmentTeacher")
  leaveApplications LeaveApplication[]
  approvedLeaves    LeaveApplication[] @relation("LeaveApprover")
  eventRegistrations EventRegistration[]

  @@unique([tenantId, email])
  @@index([tenantId])
  @@index([roleId])
  @@index([email])
  @@map("users")
}

model Role {
  id          String    @id @default(cuid())
  tenantId    String?   // null = platform-level role (Super Admin)
  name        String
  permissions Json      @default("[]") // string[] of "module:action"
  isSystem    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  users       User[]
  tenant      Tenant?   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("roles")
}

model Permission {
  id          String  @id @default(cuid())
  module      String
  action      String
  description String?

  @@unique([module, action])
  @@map("permissions")
}

model Session {
  id               String    @id @default(cuid())
  userId           String
  tenantId         String?
  refreshTokenHash String
  deviceInfo       Json?     // { userAgent, platform, browser }
  ipAddress        String?
  expiresAt        DateTime
  revokedAt        DateTime?
  createdAt        DateTime  @default(now())

  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant           Tenant?   @relation(fields: [tenantId], references: [id])

  @@index([userId])
  @@index([tenantId])
  @@index([refreshTokenHash])
  @@map("sessions")
}

model AuditLog {
  id         String    @id @default(cuid())
  tenantId   String?
  userId     String?
  action     String    // e.g. "student.create", "fee.payment", "login"
  entity     String?   // e.g. "Student"
  entityId   String?
  oldValues  Json?
  newValues  Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime  @default(now())

  tenant     Tenant?   @relation(fields: [tenantId], references: [id])
  user       User?     @relation(fields: [userId], references: [id])

  @@index([tenantId])
  @@index([userId])
  @@index([entity, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}

model SubscriptionPlan {
  id            String       @id @default(cuid())
  name          String       @unique
  price         Decimal      @db.Decimal(10, 2)
  billingCycle  BillingCycle
  studentLimit  Int
  staffLimit    Int?
  features      Json         @default("[]")
  isActive      Boolean      @default(true)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  subscriptions Subscription[]

  @@map("subscription_plans")
}

model Subscription {
  id             String             @id @default(cuid())
  tenantId       String             @unique
  planId         String
  status         SubscriptionStatus @default(TRIAL)
  startDate      DateTime
  endDate        DateTime?
  trialStartDate DateTime?
  trialEndDate   DateTime?
  cancelledAt    DateTime?
  cancelReason   String?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  tenant         Tenant             @relation(fields: [tenantId], references: [id])
  plan           SubscriptionPlan   @relation(fields: [planId], references: [id])

  @@index([tenantId])
  @@map("subscriptions")
}
```

```prisma
// ─────────────────────────────────────────────────────
// ACADEMIC TABLES
// ─────────────────────────────────────────────────────

model AcademicYear {
  id          String    @id @default(cuid())
  tenantId    String
  name        String    // e.g. "2024-25"
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  classes     Class[]
  timetables  Timetable[]
  holidays    Holiday[]
  exams       Exam[]
  feeStructures FeeStructure[]
  promotions  PromotionHistory[]
  students    Student[]
  leaveBalances LeaveBalance[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@index([isActive])
  @@map("academic_years")
}

model Class {
  id             String    @id @default(cuid())
  tenantId       String
  academicYearId String
  name           String    // e.g. "Grade 1", "Class 10"
  displayOrder   Int       @default(0)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  tenant         Tenant    @relation(fields: [tenantId], references: [id])
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  sections       Section[]
  classSubjects  ClassSubject[]
  students       Student[]
  attendance     Attendance[]
  feeStructures  FeeStructure[]
  examSchedules  ExamSchedule[]
  assignments    Assignment[]
  promotionsFrom PromotionHistory[] @relation("PromotionFromClass")
  promotionsTo   PromotionHistory[] @relation("PromotionToClass")
  examAnalytics  ExamAnalytics[]

  @@unique([tenantId, academicYearId, name])
  @@index([tenantId])
  @@index([academicYearId])
  @@map("classes")
}

model Section {
  id             String    @id @default(cuid())
  tenantId       String
  classId        String
  name           String    // e.g. "A", "B", "Rose"
  classTeacherId String?
  maxStudents    Int       @default(40)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  tenant         Tenant    @relation(fields: [tenantId], references: [id])
  class          Class     @relation(fields: [classId], references: [id])
  classTeacher   Staff?    @relation("SectionClassTeacher", fields: [classTeacherId], references: [id])
  students       Student[]
  timetables     Timetable[]
  attendance     Attendance[]
  examSchedules  ExamSchedule[]
  assignments    Assignment[]

  @@unique([tenantId, classId, name])
  @@index([tenantId])
  @@index([classId])
  @@map("sections")
}

model Subject {
  id           String      @id @default(cuid())
  tenantId     String
  name         String
  code         String
  type         SubjectType @default(CORE)
  description  String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  deletedAt    DateTime?

  tenant       Tenant      @relation(fields: [tenantId], references: [id])
  classSubjects ClassSubject[]
  timetables   Timetable[]
  attendance   Attendance[]
  examSchedules ExamSchedule[]
  examResults  ExamResult[]
  assignments  Assignment[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@map("subjects")
}

model ClassSubject {
  id           String   @id @default(cuid())
  tenantId     String
  classId      String
  subjectId    String
  teacherId    String?
  isElective   Boolean  @default(false)
  createdAt    DateTime @default(now())

  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  class        Class    @relation(fields: [classId], references: [id])
  subject      Subject  @relation(fields: [subjectId], references: [id])
  teacher      Staff?   @relation(fields: [teacherId], references: [id])

  @@unique([tenantId, classId, subjectId])
  @@index([tenantId])
  @@map("class_subjects")
}

model Period {
  id           String   @id @default(cuid())
  tenantId     String
  name         String   // e.g. "Period 1", "Lunch Break"
  startTime    String   // "HH:mm"
  endTime      String   // "HH:mm"
  dayOfWeek    Int      // 1=Monday ... 7=Sunday
  displayOrder Int      @default(0)
  isBreak      Boolean  @default(false)

  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  timetables   Timetable[]
  attendance   Attendance[]

  @@index([tenantId])
  @@map("periods")
}

model Timetable {
  id             String    @id @default(cuid())
  tenantId       String
  sectionId      String
  periodId       String
  subjectId      String
  teacherId      String
  academicYearId String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenant         Tenant       @relation(fields: [tenantId], references: [id])
  section        Section      @relation(fields: [sectionId], references: [id])
  period         Period       @relation(fields: [periodId], references: [id])
  subject        Subject      @relation(fields: [subjectId], references: [id])
  teacher        Staff        @relation(fields: [teacherId], references: [id])
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])

  @@unique([tenantId, sectionId, periodId, academicYearId])
  @@index([tenantId])
  @@index([teacherId])
  @@map("timetables")
}

model Holiday {
  id             String      @id @default(cuid())
  tenantId       String
  academicYearId String
  name           String
  date           DateTime    @db.Date
  type           HolidayType @default(SCHOOL)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  tenant         Tenant       @relation(fields: [tenantId], references: [id])
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])

  @@index([tenantId])
  @@index([date])
  @@map("holidays")
}
```

```prisma
// ─────────────────────────────────────────────────────
// STUDENT TABLES
// ─────────────────────────────────────────────────────

model Student {
  id             String        @id @default(cuid())
  tenantId       String
  userId         String?       @unique // linked User for student portal login
  admissionNo    String
  rollNo         String?
  firstName      String
  lastName       String
  dateOfBirth    DateTime      @db.Date
  gender         Gender
  bloodGroup     BloodGroup?
  photo          String?
  address        Json?         // { street, city, state, pincode, country }
  medicalInfo    Json?         // { allergies, conditions, doctorName, doctorPhone }
  admissionDate  DateTime      @db.Date
  status         StudentStatus @default(ADMITTED)
  classId        String?
  sectionId      String?
  academicYearId String?
  nationality    String?
  religion       String?
  category       String?       // SC/ST/OBC/General
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  deletedAt      DateTime?

  tenant         Tenant        @relation(fields: [tenantId], references: [id])
  user           User?         @relation("StudentUser", fields: [userId], references: [id])
  class          Class?        @relation(fields: [classId], references: [id])
  section        Section?      @relation(fields: [sectionId], references: [id])
  academicYear   AcademicYear? @relation(fields: [academicYearId], references: [id])
  parents        StudentParent[]
  documents      StudentDocument[]
  transferCerts  TransferCertificate[]
  promotions     PromotionHistory[]
  scholarships   StudentScholarship[]
  attendance     Attendance[]
  feePayments    FeePayment[]
  examResults    ExamResult[]
  reportCards    ReportCard[]
  coScholastic   CoScholasticResult[]
  submissions    AssignmentSubmission[]
  transport      StudentTransport?
  hostelAllocation HostelAllocation?
  bookIssues     BookIssue[]
  feeReminders   FeeReminder[]
  messages       Message[]

  @@unique([tenantId, admissionNo])
  @@index([tenantId])
  @@index([classId, sectionId])
  @@index([status])
  @@map("students")
}

model Parent {
  id           String   @id @default(cuid())
  tenantId     String
  userId       String?  @unique // linked User for parent portal login
  fatherName   String?
  motherName   String?
  fatherPhone  String?
  motherPhone  String?
  fatherEmail  String?
  motherEmail  String?
  occupation   String?
  annualIncome String?
  address      Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  user         User?    @relation(fields: [userId], references: [id])
  students     StudentParent[]

  @@index([tenantId])
  @@map("parents")
}

model StudentParent {
  id        String       @id @default(cuid())
  studentId String
  parentId  String
  relation  RelationType
  isPrimary Boolean      @default(false)

  student   Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  parent    Parent       @relation(fields: [parentId], references: [id], onDelete: Cascade)

  @@unique([studentId, parentId])
  @@map("student_parents")
}

model StudentDocument {
  id          String   @id @default(cuid())
  tenantId    String
  studentId   String
  category    String   // "birth_certificate", "marksheet", "transfer_cert", "photo_id"
  fileName    String
  fileUrl     String
  fileSize    Int
  mimeType    String?
  uploadedBy  String
  version     Int      @default(1)
  isVerified  Boolean  @default(false)
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@index([tenantId, studentId])
  @@map("student_documents")
}

model TransferCertificate {
  id            String   @id @default(cuid())
  tenantId      String
  studentId     String
  certificateNo String
  issueDate     DateTime @db.Date
  reason        String?
  conductGrade  String?
  remarks       String?
  issuedBy      String
  createdAt     DateTime @default(now())

  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  student       Student  @relation(fields: [studentId], references: [id])

  @@unique([tenantId, certificateNo])
  @@index([tenantId])
  @@map("transfer_certificates")
}

model PromotionHistory {
  id             String          @id @default(cuid())
  tenantId       String
  studentId      String
  fromClassId    String
  toClassId      String?
  academicYearId String
  status         PromotionStatus
  promotedAt     DateTime        @default(now())
  promotedBy     String

  tenant         Tenant          @relation(fields: [tenantId], references: [id])
  student        Student         @relation(fields: [studentId], references: [id])
  fromClass      Class           @relation("PromotionFromClass", fields: [fromClassId], references: [id])
  toClass        Class?          @relation("PromotionToClass", fields: [toClassId], references: [id])
  academicYear   AcademicYear    @relation(fields: [academicYearId], references: [id])

  @@index([tenantId, studentId])
  @@map("promotion_history")
}

model StudentScholarship {
  id          String   @id @default(cuid())
  tenantId    String
  studentId   String
  name        String
  type        String   // "PERCENTAGE" | "FIXED"
  value       Decimal  @db.Decimal(10, 2)
  validFrom   DateTime @db.Date
  validTo     DateTime? @db.Date
  description String?
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  student     Student  @relation(fields: [studentId], references: [id])

  @@index([tenantId, studentId])
  @@map("student_scholarships")
}
```

```prisma
// ─────────────────────────────────────────────────────
// ATTENDANCE TABLES
// ─────────────────────────────────────────────────────

model Attendance {
  id        String           @id @default(cuid())
  tenantId  String
  studentId String
  classId   String
  sectionId String
  subjectId String?
  date      DateTime         @db.Date
  status    AttendanceStatus
  markedBy  String
  periodId  String?
  remarks   String?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  student   Student  @relation(fields: [studentId], references: [id])
  class     Class    @relation(fields: [classId], references: [id])
  section   Section  @relation(fields: [sectionId], references: [id])
  subject   Subject? @relation(fields: [subjectId], references: [id])
  period    Period?  @relation(fields: [periodId], references: [id])

  @@unique([tenantId, studentId, date, periodId])
  @@index([tenantId, classId, sectionId, date])
  @@index([tenantId, studentId])
  @@map("attendance")
}

model StaffAttendance {
  id        String               @id @default(cuid())
  tenantId  String
  staffId   String
  date      DateTime             @db.Date
  checkIn   DateTime?
  checkOut  DateTime?
  status    StaffAttendanceStatus @default(PRESENT)
  remarks   String?
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt

  tenant    Tenant  @relation(fields: [tenantId], references: [id])
  staff     Staff   @relation(fields: [staffId], references: [id])

  @@unique([tenantId, staffId, date])
  @@index([tenantId, date])
  @@map("staff_attendance")
}
```

```prisma
// ─────────────────────────────────────────────────────
// FEE TABLES
// ─────────────────────────────────────────────────────

model FeeCategory {
  id           String    @id @default(cuid())
  tenantId     String
  name         String
  description  String?
  type         FeeType   @default(OTHER)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  tenant       Tenant    @relation(fields: [tenantId], references: [id])
  structures   FeeStructure[]
  payments     FeePayment[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("fee_categories")
}

model FeeStructure {
  id             String       @id @default(cuid())
  tenantId       String
  academicYearId String
  classId        String
  feeCategoryId  String
  amount         Decimal      @db.Decimal(10, 2)
  dueDate        DateTime?    @db.Date
  frequency      FeeFrequency @default(ANNUAL)
  lateFeePerDay  Decimal?     @db.Decimal(10, 2)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  tenant         Tenant       @relation(fields: [tenantId], references: [id])
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  class          Class        @relation(fields: [classId], references: [id])
  feeCategory    FeeCategory  @relation(fields: [feeCategoryId], references: [id])

  @@unique([tenantId, academicYearId, classId, feeCategoryId])
  @@index([tenantId])
  @@map("fee_structures")
}

model FeePayment {
  id              String        @id @default(cuid())
  tenantId        String
  studentId       String
  feeCategoryId   String
  academicYearId  String?
  amount          Decimal       @db.Decimal(10, 2)
  discount        Decimal       @db.Decimal(10, 2) @default(0)
  lateFee         Decimal       @db.Decimal(10, 2) @default(0)
  netAmount       Decimal       @db.Decimal(10, 2)
  paymentMethod   PaymentMethod
  transactionRef  String?
  gatewayOrderId  String?
  status          PaymentStatus @default(PENDING)
  receiptNo       String
  paidAt          DateTime?
  collectedBy     String?
  remarks         String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  tenant          Tenant        @relation(fields: [tenantId], references: [id])
  student         Student       @relation(fields: [studentId], references: [id])
  feeCategory     FeeCategory   @relation(fields: [feeCategoryId], references: [id])
  refunds         FeeRefund[]

  @@unique([tenantId, receiptNo])
  @@index([tenantId, studentId])
  @@index([status])
  @@index([paidAt])
  @@map("fee_payments")
}

model FeeRefund {
  id          String   @id @default(cuid())
  tenantId    String
  paymentId   String
  amount      Decimal  @db.Decimal(10, 2)
  reason      String
  refundedAt  DateTime
  refundedBy  String
  createdAt   DateTime @default(now())

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  payment     FeePayment  @relation(fields: [paymentId], references: [id])

  @@index([tenantId])
  @@map("fee_refunds")
}

model FeeReminder {
  id        String   @id @default(cuid())
  tenantId  String
  studentId String
  sentAt    DateTime
  channel   String   // "SMS" | "EMAIL" | "WHATSAPP"
  status    String   // "SENT" | "FAILED"
  amount    Decimal? @db.Decimal(10, 2)
  createdAt DateTime @default(now())

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  student   Student  @relation(fields: [studentId], references: [id])

  @@index([tenantId, studentId])
  @@map("fee_reminders")
}
```

```prisma
// ─────────────────────────────────────────────────────
// EXAM TABLES
// ─────────────────────────────────────────────────────

model ExamType {
  id          String   @id @default(cuid())
  tenantId    String
  name        String   // "Unit Test", "Mid-Term", "Final", "Pre-Board"
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  exams       Exam[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("exam_types")
}

model Exam {
  id             String     @id @default(cuid())
  tenantId       String
  examTypeId     String
  name           String
  academicYearId String
  startDate      DateTime   @db.Date
  endDate        DateTime   @db.Date
  status         ExamStatus @default(SCHEDULED)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  tenant         Tenant       @relation(fields: [tenantId], references: [id])
  examType       ExamType     @relation(fields: [examTypeId], references: [id])
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  schedules      ExamSchedule[]
  results        ExamResult[]
  reportCards    ReportCard[]
  coScholastic   CoScholasticResult[]
  analytics      ExamAnalytics[]

  @@index([tenantId])
  @@index([academicYearId])
  @@map("exams")
}

model ExamSchedule {
  id           String   @id @default(cuid())
  tenantId     String
  examId       String
  classId      String
  sectionId    String
  subjectId    String
  date         DateTime @db.Date
  startTime    String   // "HH:mm"
  duration     Int      // minutes
  maxMarks     Decimal  @db.Decimal(6, 2)
  passingMarks Decimal  @db.Decimal(6, 2)
  venue        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  exam         Exam     @relation(fields: [examId], references: [id])
  class        Class    @relation(fields: [classId], references: [id])
  section      Section  @relation(fields: [sectionId], references: [id])
  subject      Subject  @relation(fields: [subjectId], references: [id])

  @@unique([tenantId, examId, sectionId, subjectId])
  @@index([tenantId, examId])
  @@map("exam_schedules")
}

model ExamResult {
  id             String   @id @default(cuid())
  tenantId       String
  examId         String
  studentId      String
  subjectId      String
  marksObtained  Decimal? @db.Decimal(6, 2)
  grade          String?
  gradePoint     Decimal? @db.Decimal(4, 2)
  remarks        String?
  isAbsent       Boolean  @default(false)
  enteredBy      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  tenant         Tenant   @relation(fields: [tenantId], references: [id])
  exam           Exam     @relation(fields: [examId], references: [id])
  student        Student  @relation(fields: [studentId], references: [id])
  subject        Subject  @relation(fields: [subjectId], references: [id])

  @@unique([tenantId, examId, studentId, subjectId])
  @@index([tenantId, examId])
  @@index([tenantId, studentId])
  @@map("exam_results")
}

model GradeScale {
  id             String  @id @default(cuid())
  tenantId       String
  name           String
  minPercentage  Decimal @db.Decimal(5, 2)
  maxPercentage  Decimal @db.Decimal(5, 2)
  grade          String
  gradePoint     Decimal @db.Decimal(4, 2)
  description    String?
  createdAt      DateTime @default(now())

  tenant         Tenant  @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, grade])
  @@index([tenantId])
  @@map("grade_scales")
}

model ReportCard {
  id             String    @id @default(cuid())
  tenantId       String
  studentId      String
  examId         String
  totalMarks     Decimal   @db.Decimal(8, 2)
  marksObtained  Decimal   @db.Decimal(8, 2)
  percentage     Decimal   @db.Decimal(5, 2)
  grade          String?
  gpa            Decimal?  @db.Decimal(4, 2)
  rank           Int?
  attendancePct  Decimal?  @db.Decimal(5, 2)
  remarks        String?
  generatedAt    DateTime  @default(now())
  publishedAt    DateTime?

  tenant         Tenant    @relation(fields: [tenantId], references: [id])
  student        Student   @relation(fields: [studentId], references: [id])
  exam           Exam      @relation(fields: [examId], references: [id])

  @@unique([tenantId, studentId, examId])
  @@index([tenantId])
  @@map("report_cards")
}

model CoScholasticResult {
  id        String   @id @default(cuid())
  tenantId  String
  studentId String
  examId    String
  area      String   // "Sports", "Arts", "Behaviour", "Discipline"
  rating    String   // "A+", "A", "B", "C" or numeric
  remarks   String?
  createdAt DateTime @default(now())

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  student   Student  @relation(fields: [studentId], references: [id])
  exam      Exam     @relation(fields: [examId], references: [id])

  @@unique([tenantId, studentId, examId, area])
  @@index([tenantId])
  @@map("co_scholastic_results")
}
```

```prisma
// ─────────────────────────────────────────────────────
// HOMEWORK / ASSIGNMENT TABLES
// ─────────────────────────────────────────────────────

model Assignment {
  id          String           @id @default(cuid())
  tenantId    String
  classId     String
  sectionId   String
  subjectId   String
  teacherId   String
  title       String
  description String?
  dueDate     DateTime
  maxMarks    Decimal?         @db.Decimal(6, 2)
  status      AssignmentStatus @default(ACTIVE)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  deletedAt   DateTime?

  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  class       Class        @relation(fields: [classId], references: [id])
  section     Section      @relation(fields: [sectionId], references: [id])
  subject     Subject      @relation(fields: [subjectId], references: [id])
  teacher     User         @relation("AssignmentTeacher", fields: [teacherId], references: [id])
  attachments AssignmentAttachment[]
  submissions AssignmentSubmission[]

  @@index([tenantId])
  @@index([classId, sectionId])
  @@index([dueDate])
  @@map("assignments")
}

model AssignmentAttachment {
  id           String   @id @default(cuid())
  assignmentId String
  fileUrl      String
  fileName     String
  fileSize     Int
  mimeType     String?
  createdAt    DateTime @default(now())

  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  @@map("assignment_attachments")
}

model AssignmentSubmission {
  id           String           @id @default(cuid())
  tenantId     String
  assignmentId String
  studentId    String
  content      String?
  submittedAt  DateTime?
  isLate       Boolean          @default(false)
  status       SubmissionStatus @default(PENDING)
  marks        Decimal?         @db.Decimal(6, 2)
  feedback     String?
  evaluatedAt  DateTime?
  evaluatedBy  String?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  tenant       Tenant      @relation(fields: [tenantId], references: [id])
  assignment   Assignment  @relation(fields: [assignmentId], references: [id])
  student      Student     @relation(fields: [studentId], references: [id])
  attachments  SubmissionAttachment[]

  @@unique([assignmentId, studentId])
  @@index([tenantId])
  @@map("assignment_submissions")
}

model SubmissionAttachment {
  id           String   @id @default(cuid())
  submissionId String
  fileUrl      String
  fileName     String
  fileSize     Int
  mimeType     String?
  createdAt    DateTime @default(now())

  submission   AssignmentSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@map("submission_attachments")
}
```

```prisma
// ─────────────────────────────────────────────────────
// STAFF / HR TABLES
// ─────────────────────────────────────────────────────

model Staff {
  id                String         @id @default(cuid())
  tenantId          String
  userId            String?        @unique
  employeeCode      String
  firstName         String
  lastName          String
  dateOfBirth       DateTime?      @db.Date
  gender            Gender?
  phone             String?
  email             String?
  photo             String?
  departmentId      String?
  designationId     String?
  qualifications    Json?          @default("[]")
  joiningDate       DateTime       @db.Date
  employmentType    EmploymentType @default(FULL_TIME)
  salaryStructureId String?
  isActive          Boolean        @default(true)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  deletedAt         DateTime?

  tenant            Tenant          @relation(fields: [tenantId], references: [id])
  user              User?           @relation(fields: [userId], references: [id])
  department        Department?     @relation(fields: [departmentId], references: [id])
  designation       Designation?    @relation(fields: [designationId], references: [id])
  salaryStructure   SalaryStructure? @relation(fields: [salaryStructureId], references: [id])
  sectionAsTeacher  Section[]       @relation("SectionClassTeacher")
  classSubjects     ClassSubject[]
  timetables        Timetable[]
  attendance        StaffAttendance[]
  leaveApplications LeaveApplication[]
  leaveBalances     LeaveBalance[]
  payrolls          Payroll[]
  hostel            Hostel[]        @relation("HostelWarden")
  vehicle           Vehicle[]

  @@unique([tenantId, employeeCode])
  @@index([tenantId])
  @@index([departmentId])
  @@map("staff")
}

model Department {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  headId    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  staff        Staff[]
  designations Designation[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("departments")
}

model Designation {
  id           String   @id @default(cuid())
  tenantId     String
  name         String
  departmentId String?
  level        Int?     @default(1)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant       Tenant     @relation(fields: [tenantId], references: [id])
  department   Department? @relation(fields: [departmentId], references: [id])
  staff        Staff[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("designations")
}

model SalaryStructure {
  id               String   @id @default(cuid())
  tenantId         String
  name             String
  basicPay         Decimal  @db.Decimal(10, 2)
  hra              Decimal  @db.Decimal(10, 2) @default(0)
  ta               Decimal  @db.Decimal(10, 2) @default(0)
  da               Decimal  @db.Decimal(10, 2) @default(0)
  otherAllowances  Json     @default("[]")
  pf               Decimal  @db.Decimal(10, 2) @default(0)
  esi              Decimal  @db.Decimal(10, 2) @default(0)
  tds              Decimal  @db.Decimal(10, 2) @default(0)
  otherDeductions  Json     @default("[]")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  tenant           Tenant   @relation(fields: [tenantId], references: [id])
  staff            Staff[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("salary_structures")
}

model LeaveType {
  id            String   @id @default(cuid())
  tenantId      String
  name          String   // "Casual", "Sick", "Earned", "Maternity", "LOP"
  annualBalance Int
  carryForward  Boolean  @default(false)
  isPaid        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant        Tenant             @relation(fields: [tenantId], references: [id])
  leaveBalances LeaveBalance[]
  applications  LeaveApplication[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("leave_types")
}

model LeaveBalance {
  id             String       @id @default(cuid())
  tenantId       String
  staffId        String
  leaveTypeId    String
  academicYearId String
  totalDays      Int
  usedDays       Int          @default(0)
  remainingDays  Int
  updatedAt      DateTime     @updatedAt

  tenant         Tenant       @relation(fields: [tenantId], references: [id])
  staff          Staff        @relation(fields: [staffId], references: [id])
  leaveType      LeaveType    @relation(fields: [leaveTypeId], references: [id])
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])

  @@unique([tenantId, staffId, leaveTypeId, academicYearId])
  @@index([tenantId, staffId])
  @@map("leave_balances")
}

model LeaveApplication {
  id           String      @id @default(cuid())
  tenantId     String
  staffId      String
  leaveTypeId  String
  startDate    DateTime    @db.Date
  endDate      DateTime    @db.Date
  totalDays    Int
  reason       String
  documentUrl  String?
  isLop        Boolean     @default(false)  // Leave Without Pay
  status       LeaveStatus @default(PENDING)
  appliedAt    DateTime    @default(now())
  approvedBy   String?
  approvedAt   DateTime?
  remarks      String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  tenant       Tenant     @relation(fields: [tenantId], references: [id])
  staff        Staff      @relation(fields: [staffId], references: [id])
  leaveType    LeaveType  @relation(fields: [leaveTypeId], references: [id])
  approver     User?      @relation("LeaveApprover", fields: [approvedBy], references: [id])

  @@index([tenantId, staffId])
  @@index([status])
  @@map("leave_applications")
}

model Payroll {
  id           String        @id @default(cuid())
  tenantId     String
  staffId      String
  month        Int           // 1-12
  year         Int
  basicPay     Decimal       @db.Decimal(10, 2)
  totalAllowances Decimal    @db.Decimal(10, 2)
  totalDeductions Decimal    @db.Decimal(10, 2)
  netSalary    Decimal       @db.Decimal(10, 2)
  workingDays  Int
  presentDays  Int
  lopDays      Int           @default(0)
  status       PayrollStatus @default(DRAFT)
  finalisedAt  DateTime?
  finalisedBy  String?
  payslipUrl   String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  staff        Staff    @relation(fields: [staffId], references: [id])
  items        PayrollItem[]

  @@unique([tenantId, staffId, month, year])
  @@index([tenantId])
  @@map("payrolls")
}

model PayrollItem {
  id        String          @id @default(cuid())
  payrollId String
  type      PayrollItemType
  name      String
  amount    Decimal         @db.Decimal(10, 2)
  createdAt DateTime        @default(now())

  payroll   Payroll @relation(fields: [payrollId], references: [id], onDelete: Cascade)

  @@index([payrollId])
  @@map("payroll_items")
}
```

```prisma
// ─────────────────────────────────────────────────────
// LIBRARY TABLES
// ─────────────────────────────────────────────────────

model Book {
  id               String   @id @default(cuid())
  tenantId         String
  isbn             String?
  title            String
  author           String?
  publisher        String?
  publishedYear    Int?
  category         String?
  quantity         Int      @default(1)
  availableQty     Int      @default(1)
  shelfLocation    String?
  coverUrl         String?
  replacementCost  Decimal? @db.Decimal(10, 2)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime?

  tenant           Tenant    @relation(fields: [tenantId], references: [id])
  issues           BookIssue[]

  @@index([tenantId])
  @@index([isbn])
  @@map("books")
}

model BookIssue {
  id           String          @id @default(cuid())
  tenantId     String
  bookId       String
  borrowerId   String          // studentId or staffId
  borrowerType BorrowerType
  issueDate    DateTime        @db.Date
  dueDate      DateTime        @db.Date
  returnDate   DateTime?       @db.Date
  fine         Decimal         @db.Decimal(10, 2) @default(0)
  fineStatus   FineStatus      @default(PENDING)
  status       BookIssueStatus @default(ISSUED)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  tenant       Tenant    @relation(fields: [tenantId], references: [id])
  book         Book      @relation(fields: [bookId], references: [id])
  student      Student?  @relation(fields: [borrowerId], references: [id], map: "book_issue_student_fk")

  @@index([tenantId])
  @@index([borrowerId, borrowerType])
  @@index([status])
  @@map("book_issues")
}

// ─────────────────────────────────────────────────────
// TRANSPORT TABLES
// ─────────────────────────────────────────────────────

model Driver {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  licenceNo   String
  phone       String
  address     String?
  joiningDate DateTime @db.Date
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  vehicles    Vehicle[]

  @@index([tenantId])
  @@map("drivers")
}

model Vehicle {
  id               String               @id @default(cuid())
  tenantId         String
  regNo            String
  type             TransportVehicleType @default(BUS)
  make             String?
  model            String?
  capacity         Int
  driverId         String?
  insuranceExpiry  DateTime?            @db.Date
  fitnessExpiry    DateTime?            @db.Date
  isActive         Boolean              @default(true)
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  tenant           Tenant  @relation(fields: [tenantId], references: [id])
  driver           Staff?  @relation(fields: [driverId], references: [id])
  routes           Route[]

  @@unique([tenantId, regNo])
  @@index([tenantId])
  @@map("vehicles")
}

model Route {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  vehicleId String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant    Tenant         @relation(fields: [tenantId], references: [id])
  vehicle   Vehicle?       @relation(fields: [vehicleId], references: [id])
  stops     RouteStop[]
  students  StudentTransport[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("routes")
}

model RouteStop {
  id           String   @id @default(cuid())
  tenantId     String
  routeId      String
  name         String
  pickupTime   String?  // "HH:mm"
  dropTime     String?  // "HH:mm"
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant       Tenant    @relation(fields: [tenantId], references: [id])
  route        Route     @relation(fields: [routeId], references: [id])
  students     StudentTransport[]

  @@index([tenantId, routeId])
  @@map("route_stops")
}

model StudentTransport {
  id             String       @id @default(cuid())
  tenantId       String
  studentId      String       @unique
  routeId        String
  stopId         String
  academicYearId String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  tenant         Tenant       @relation(fields: [tenantId], references: [id])
  student        Student      @relation(fields: [studentId], references: [id])
  route          Route        @relation(fields: [routeId], references: [id])
  stop           RouteStop    @relation(fields: [stopId], references: [id])

  @@index([tenantId])
  @@map("student_transport")
}
```

```prisma
// ─────────────────────────────────────────────────────
// HOSTEL TABLES
// ─────────────────────────────────────────────────────

model Hostel {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  wardenId  String?
  address   String?
  type      String?  // "Boys" | "Girls" | "Mixed"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant    Tenant        @relation(fields: [tenantId], references: [id])
  warden    Staff?        @relation("HostelWarden", fields: [wardenId], references: [id])
  rooms     HostelRoom[]
  visitors  HostelVisitor[]
  messRecords MessRecord[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("hostels")
}

model HostelRoom {
  id           String   @id @default(cuid())
  tenantId     String
  hostelId     String
  roomNo       String
  type         String?  // "Single", "Double", "Dormitory"
  capacity     Int
  occupiedBeds Int      @default(0)
  floor        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant       Tenant      @relation(fields: [tenantId], references: [id])
  hostel       Hostel      @relation(fields: [hostelId], references: [id])
  beds         HostelBed[]

  @@unique([tenantId, hostelId, roomNo])
  @@index([tenantId])
  @@map("hostel_rooms")
}

model HostelBed {
  id          String   @id @default(cuid())
  tenantId    String
  roomId      String
  bedNo       String
  isOccupied  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  room        HostelRoom  @relation(fields: [roomId], references: [id])
  allocation  HostelAllocation?

  @@unique([tenantId, roomId, bedNo])
  @@index([tenantId])
  @@map("hostel_beds")
}

model HostelAllocation {
  id                String                 @id @default(cuid())
  tenantId          String
  studentId         String                 @unique
  bedId             String                 @unique
  admissionDate     DateTime               @db.Date
  expectedDeparture DateTime?              @db.Date
  mealPlan          MealPlan               @default(NONE)
  status            HostelAllocationStatus @default(ACTIVE)
  vacatedAt         DateTime?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  tenant            Tenant     @relation(fields: [tenantId], references: [id])
  student           Student    @relation(fields: [studentId], references: [id])
  bed               HostelBed  @relation(fields: [bedId], references: [id])

  @@index([tenantId])
  @@map("hostel_allocations")
}

model HostelVisitor {
  id          String    @id @default(cuid())
  tenantId    String
  hostelId    String
  studentId   String?
  visitorName String
  visitorPhone String?
  relation    String?
  purpose     String?
  entryTime   DateTime
  exitTime    DateTime?
  idProof     String?
  createdAt   DateTime  @default(now())

  tenant      Tenant  @relation(fields: [tenantId], references: [id])
  hostel      Hostel  @relation(fields: [hostelId], references: [id])

  @@index([tenantId, hostelId])
  @@map("hostel_visitors")
}

model MessRecord {
  id           String   @id @default(cuid())
  tenantId     String
  hostelId     String
  date         DateTime @db.Date
  mealType     MealType
  count        Int
  costPerMeal  Decimal  @db.Decimal(8, 2)
  totalCost    Decimal  @db.Decimal(10, 2)
  createdAt    DateTime @default(now())

  tenant       Tenant  @relation(fields: [tenantId], references: [id])
  hostel       Hostel  @relation(fields: [hostelId], references: [id])

  @@unique([tenantId, hostelId, date, mealType])
  @@index([tenantId])
  @@map("mess_records")
}

// ─────────────────────────────────────────────────────
// COMMUNICATION TABLES
// ─────────────────────────────────────────────────────

model Message {
  id              String    @id @default(cuid())
  tenantId        String
  senderId        String
  recipientId     String?
  subject         String?
  body            String
  isRead          Boolean   @default(false)
  readAt          DateTime?
  parentMessageId String?   // for threading
  createdAt       DateTime  @default(now())
  deletedAt       DateTime?

  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  sender          User      @relation("MessageSender", fields: [senderId], references: [id])
  recipient       User?     @relation("MessageRecipient", fields: [recipientId], references: [id])
  student         Student?  @relation(fields: [recipientId], references: [id], map: "message_student_fk")
  parentMessage   Message?  @relation("MessageThread", fields: [parentMessageId], references: [id])
  replies         Message[] @relation("MessageThread")

  @@index([tenantId, recipientId])
  @@index([tenantId, senderId])
  @@map("messages")
}

model Announcement {
  id           String             @id @default(cuid())
  tenantId     String
  authorId     String
  title        String
  body         String
  targetType   AnnouncementTarget @default(ALL)
  targetId     String?            // classId if target is CLASS
  publishedAt  DateTime?
  expiresAt    DateTime?
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  tenant       Tenant @relation(fields: [tenantId], references: [id])
  author       User   @relation("AnnouncementAuthor", fields: [authorId], references: [id])

  @@index([tenantId])
  @@index([publishedAt])
  @@map("announcements")
}

model Notification {
  id            String              @id @default(cuid())
  tenantId      String
  userId        String
  type          String
  title         String
  body          String
  channel       NotificationChannel @default(IN_APP)
  status        NotificationStatus  @default(PENDING)
  sentAt        DateTime?
  readAt        DateTime?
  referenceId   String?
  referenceType String?
  retryCount    Int                 @default(0)
  createdAt     DateTime            @default(now())

  tenant        Tenant @relation(fields: [tenantId], references: [id])
  user          User   @relation(fields: [userId], references: [id])

  @@index([tenantId, userId])
  @@index([status])
  @@map("notifications")
}

model Circular {
  id          String    @id @default(cuid())
  tenantId    String
  authorId    String
  title       String
  description String?
  fileUrl     String?
  publishedAt DateTime?
  createdAt   DateTime  @default(now())

  tenant      Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@map("circulars")
}
```

```prisma
// ─────────────────────────────────────────────────────
// INVENTORY TABLES
// ─────────────────────────────────────────────────────

model InventoryCategory {
  id        String    @id @default(cuid())
  tenantId  String
  name      String
  createdAt DateTime  @default(now())

  tenant    Tenant          @relation(fields: [tenantId], references: [id])
  items     InventoryItem[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("inventory_categories")
}

model InventoryItem {
  id            String    @id @default(cuid())
  tenantId      String
  categoryId    String
  name          String
  quantity      Int       @default(0)
  minStockLevel Int       @default(0)
  unitPrice     Decimal   @db.Decimal(10, 2)
  vendor        String?
  purchaseDate  DateTime? @db.Date
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tenant        Tenant              @relation(fields: [tenantId], references: [id])
  category      InventoryCategory   @relation(fields: [categoryId], references: [id])
  orderItems    PurchaseOrderItem[]
  maintenance   MaintenanceRecord[]

  @@index([tenantId])
  @@map("inventory_items")
}

model PurchaseOrder {
  id               String                  @id @default(cuid())
  tenantId         String
  vendorName       String
  orderDate        DateTime                @db.Date
  expectedDelivery DateTime?               @db.Date
  status           InventoryPurchaseStatus @default(DRAFT)
  totalAmount      Decimal                 @db.Decimal(12, 2)
  notes            String?
  createdAt        DateTime                @default(now())
  updatedAt        DateTime                @updatedAt

  tenant           Tenant              @relation(fields: [tenantId], references: [id])
  items            PurchaseOrderItem[]

  @@index([tenantId])
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id          String   @id @default(cuid())
  orderId     String
  itemId      String
  quantity    Int
  unitPrice   Decimal  @db.Decimal(10, 2)
  receivedQty Int      @default(0)
  createdAt   DateTime @default(now())

  order       PurchaseOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  item        InventoryItem @relation(fields: [itemId], references: [id])

  @@index([orderId])
  @@map("purchase_order_items")
}

model MaintenanceRecord {
  id            String            @id @default(cuid())
  tenantId      String
  itemId        String
  description   String
  scheduledDate DateTime          @db.Date
  completedDate DateTime?         @db.Date
  cost          Decimal?          @db.Decimal(10, 2)
  status        MaintenanceStatus @default(SCHEDULED)
  assignedTo    String?
  notes         String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  tenant        Tenant        @relation(fields: [tenantId], references: [id])
  item          InventoryItem @relation(fields: [itemId], references: [id])

  @@index([tenantId])
  @@map("maintenance_records")
}

// ─────────────────────────────────────────────────────
// EVENT TABLES
// ─────────────────────────────────────────────────────

model Event {
  id             String        @id @default(cuid())
  tenantId       String
  title          String
  description    String?
  eventType      EventType     @default(OTHER)
  startDate      DateTime
  endDate        DateTime
  venue          String?
  targetAudience EventAudience @default(ALL)
  organizerId    String
  imageUrl       String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  tenant         Tenant              @relation(fields: [tenantId], references: [id])
  registrations  EventRegistration[]

  @@index([tenantId])
  @@index([startDate])
  @@map("events")
}

model EventRegistration {
  id           String                  @id @default(cuid())
  tenantId     String
  eventId      String
  userId       String
  registeredAt DateTime                @default(now())
  status       EventRegistrationStatus @default(REGISTERED)

  tenant       Tenant @relation(fields: [tenantId], references: [id])
  event        Event  @relation(fields: [eventId], references: [id])
  user         User   @relation(fields: [userId], references: [id])

  @@unique([eventId, userId])
  @@index([tenantId])
  @@map("event_registrations")
}

// ─────────────────────────────────────────────────────
// ANALYTICS (AI-READY) TABLES
// ─────────────────────────────────────────────────────

model AttendanceAnalytics {
  id           String   @id @default(cuid())
  tenantId     String
  entityType   String   // "CLASS" | "SECTION" | "STUDENT" | "SCHOOL"
  entityId     String
  date         DateTime @db.Date
  presentCount Int
  absentCount  Int
  lateCount    Int      @default(0)
  percentage   Decimal  @db.Decimal(5, 2)

  @@unique([tenantId, entityType, entityId, date])
  @@index([tenantId, date])
  @@map("attendance_analytics")
}

model FeeAnalytics {
  id          String   @id @default(cuid())
  tenantId    String
  date        DateTime @db.Date
  collected   Decimal  @db.Decimal(12, 2)
  outstanding Decimal  @db.Decimal(12, 2)
  refunded    Decimal  @db.Decimal(12, 2) @default(0)

  @@unique([tenantId, date])
  @@index([tenantId])
  @@map("fee_analytics")
}

model ExamAnalytics {
  id         String   @id @default(cuid())
  tenantId   String
  examId     String
  classId    String
  avgMarks   Decimal  @db.Decimal(6, 2)
  passCount  Int
  failCount  Int
  topScore   Decimal  @db.Decimal(6, 2)
  createdAt  DateTime @default(now())

  exam       Exam     @relation(fields: [examId], references: [id])
  class      Class    @relation(fields: [classId], references: [id])

  @@unique([tenantId, examId, classId])
  @@index([tenantId])
  @@map("exam_analytics")
}
```

---

## 5. Backend Module Structure (NestJS)

### 5.1 Directory Layout

```
apps/api/src/
├── app.module.ts                   # Root module — imports all feature modules
├── main.ts                         # Bootstrap, Swagger, global pipes/filters
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts      # /auth/login, /refresh, /logout, etc.
│   │   ├── auth.service.ts         # Credential validation, token issuance
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts     # Passport JWT strategy
│   │   │   └── local.strategy.ts   # Passport local strategy
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       ├── refresh-token.dto.ts
│   │       └── forgot-password.dto.ts
│   │
│   ├── tenants/
│   │   ├── tenants.module.ts
│   │   ├── tenants.controller.ts   # Super Admin CRUD + impersonation
│   │   ├── tenants.service.ts
│   │   ├── tenant.middleware.ts    # Subdomain → tenantId resolution
│   │   └── dto/
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   │
│   ├── students/
│   │   ├── students.module.ts
│   │   ├── students.controller.ts
│   │   ├── students.service.ts
│   │   ├── students-import.service.ts   # CSV bulk import via queue
│   │   └── dto/
│   │
│   ├── academic/
│   │   ├── academic.module.ts
│   │   ├── academic-year.controller.ts
│   │   ├── classes.controller.ts
│   │   ├── sections.controller.ts
│   │   ├── subjects.controller.ts
│   │   ├── timetable.controller.ts
│   │   ├── timetable.service.ts         # Conflict detection logic
│   │   └── dto/
│   │
│   ├── attendance/
│   │   ├── attendance.module.ts
│   │   ├── attendance.controller.ts
│   │   ├── attendance.service.ts
│   │   └── dto/
│   │
│   ├── fees/
│   │   ├── fees.module.ts
│   │   ├── fees.controller.ts
│   │   ├── fees.service.ts
│   │   ├── payment-gateway.service.ts   # Razorpay / Stripe abstraction
│   │   ├── receipt.service.ts           # PDF receipt generation
│   │   └── dto/
│   │
│   ├── exams/
│   │   ├── exams.module.ts
│   │   ├── exams.controller.ts
│   │   ├── exams.service.ts
│   │   ├── report-card.service.ts       # PDF report card generation
│   │   └── dto/
│   │
│   ├── homework/
│   │   ├── homework.module.ts
│   │   ├── homework.controller.ts
│   │   ├── homework.service.ts
│   │   └── dto/
│   │
│   ├── staff/
│   │   ├── staff.module.ts
│   │   ├── staff.controller.ts
│   │   ├── staff.service.ts
│   │   └── dto/
│   │
│   ├── payroll/
│   │   ├── payroll.module.ts
│   │   ├── payroll.controller.ts
│   │   ├── payroll.service.ts          # Net salary calculation
│   │   └── dto/
│   │
│   ├── leave/
│   │   ├── leave.module.ts
│   │   ├── leave.controller.ts
│   │   ├── leave.service.ts
│   │   └── dto/
│   │
│   ├── library/
│   │   ├── library.module.ts
│   │   ├── library.controller.ts
│   │   ├── library.service.ts
│   │   └── dto/
│   │
│   ├── transport/
│   │   ├── transport.module.ts
│   │   ├── transport.controller.ts
│   │   ├── transport.service.ts
│   │   └── dto/
│   │
│   ├── hostel/
│   │   ├── hostel.module.ts
│   │   ├── hostel.controller.ts
│   │   ├── hostel.service.ts
│   │   └── dto/
│   │
│   ├── inventory/
│   │   ├── inventory.module.ts
│   │   ├── inventory.controller.ts
│   │   ├── inventory.service.ts
│   │   └── dto/
│   │
│   ├── events/
│   │   ├── events.module.ts
│   │   ├── events.controller.ts
│   │   ├── events.service.ts
│   │   └── dto/
│   │
│   ├── communication/
│   │   ├── communication.module.ts
│   │   ├── messages.controller.ts
│   │   ├── announcements.controller.ts
│   │   ├── circulars.controller.ts
│   │   ├── communication.service.ts
│   │   └── dto/
│   │
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.service.ts    # Fan-out to channels
│   │   ├── providers/
│   │   │   ├── sms.provider.ts         # Twilio / MSG91 adapter
│   │   │   ├── email.provider.ts       # SendGrid / SES adapter
│   │   │   └── whatsapp.provider.ts    # WhatsApp Business API adapter
│   │   └── dto/
│   │
│   ├── documents/
│   │   ├── documents.module.ts
│   │   ├── documents.controller.ts     # Signed URL generation
│   │   └── documents.service.ts
│   │
│   ├── reports/
│   │   ├── reports.module.ts
│   │   ├── reports.controller.ts
│   │   └── reports.service.ts          # Delegates to domain services
│   │
│   ├── storage/
│   │   ├── storage.module.ts
│   │   └── storage.service.ts          # S3 / MinIO presigned URLs
│   │
│   ├── queue/
│   │   ├── queue.module.ts
│   │   └── processors/
│   │       ├── notifications.processor.ts
│   │       ├── import.processor.ts
│   │       ├── export.processor.ts
│   │       ├── reminder.processor.ts
│   │       └── payroll.processor.ts
│   │
│   ├── settings/
│   │   ├── settings.module.ts
│   │   ├── settings.controller.ts
│   │   └── settings.service.ts
│   │
│   ├── subscriptions/
│   │   ├── subscriptions.module.ts
│   │   ├── subscriptions.controller.ts
│   │   └── subscriptions.service.ts
│   │
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts        # /health → DB, Redis, S3 checks
│
└── common/
    ├── decorators/
    │   ├── current-user.decorator.ts
    │   ├── tenant-id.decorator.ts
    │   ├── roles.decorator.ts
    │   └── permissions.decorator.ts
    ├── filters/
    │   └── global-exception.filter.ts  # Normalises all errors to ApiError shape
    ├── guards/
    │   ├── jwt-auth.guard.ts
    │   ├── rbac.guard.ts
    │   └── tenant.guard.ts
    ├── interceptors/
    │   ├── logging.interceptor.ts      # Winston/Pino request logging
    │   └── transform.interceptor.ts    # Wraps responses in { data, meta }
    ├── middleware/
    │   └── tenant-resolver.middleware.ts
    ├── pipes/
    │   └── validation.pipe.ts          # Global class-validator pipe
    ├── prisma/
    │   ├── prisma.module.ts
    │   └── prisma.service.ts           # Tenant-scoped Prisma extensions
    └── types/
        ├── tenant-context.type.ts
        ├── jwt-payload.type.ts
        └── api-response.type.ts
```

### 5.2 Key Service Patterns

**Tenant-scoped service base:**
```typescript
// All services receive tenantId from the controller and pass it to Prisma
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListStudentsDto) {
    const db = this.prisma.withTenant(tenantId);
    return db.student.findMany({
      where: {
        deletedAt: null,
        ...(query.classId && { classId: query.classId }),
        ...(query.search && {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { admissionNo: { contains: query.search } },
          ],
        }),
      },
      include: { class: true, section: true },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

**Standardised API response shape:**
```typescript
// Every endpoint returns:
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
// Error shape:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

---

## 6. Frontend Structure (Next.js App Router)

### 6.1 Directory Layout

```
apps/web/
├── app/
│   ├── layout.tsx                      # Root layout (fonts, providers)
│   ├── (auth)/
│   │   ├── layout.tsx                  # Auth shell (centered card)
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── verify-email/page.tsx
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Sidebar + Topbar shell
│   │   ├── page.tsx                    # Role-based dashboard redirect
│   │   │
│   │   ├── students/
│   │   │   ├── page.tsx                # Student list (DataTable + filters)
│   │   │   ├── new/page.tsx            # Multi-step admission form
│   │   │   ├── import/page.tsx         # CSV import wizard
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Student profile overview
│   │   │       ├── edit/page.tsx
│   │   │       ├── fees/page.tsx
│   │   │       ├── attendance/page.tsx
│   │   │       └── results/page.tsx
│   │   │
│   │   ├── academic/
│   │   │   ├── classes/page.tsx
│   │   │   ├── sections/page.tsx
│   │   │   ├── subjects/page.tsx
│   │   │   ├── timetable/page.tsx      # Drag-and-drop timetable editor
│   │   │   └── calendar/page.tsx       # Holiday & events calendar
│   │   │
│   │   ├── attendance/
│   │   │   ├── page.tsx                # Mark attendance (bulk or QR)
│   │   │   └── reports/page.tsx
│   │   │
│   │   ├── fees/
│   │   │   ├── page.tsx                # Fee collection dashboard
│   │   │   ├── structures/page.tsx
│   │   │   ├── collect/page.tsx        # Collect fee form
│   │   │   ├── defaulters/page.tsx
│   │   │   └── reports/page.tsx
│   │   │
│   │   ├── exams/
│   │   │   ├── page.tsx
│   │   │   ├── schedule/page.tsx
│   │   │   ├── results/page.tsx        # Bulk marks entry
│   │   │   └── report-cards/
│   │   │       ├── page.tsx
│   │   │       └── [studentId]/page.tsx
│   │   │
│   │   ├── homework/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx           # Submissions list + evaluation
│   │   │
│   │   ├── staff/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── payroll/page.tsx
│   │   │       └── leaves/page.tsx
│   │   │
│   │   ├── payroll/
│   │   │   ├── page.tsx                # Generate + manage payroll
│   │   │   └── reports/page.tsx
│   │   │
│   │   ├── leaves/
│   │   │   ├── page.tsx                # Leave applications list
│   │   │   └── apply/page.tsx
│   │   │
│   │   ├── library/
│   │   │   ├── page.tsx
│   │   │   ├── books/page.tsx
│   │   │   └── issues/page.tsx
│   │   │
│   │   ├── transport/
│   │   │   ├── page.tsx
│   │   │   ├── routes/page.tsx
│   │   │   └── vehicles/page.tsx
│   │   │
│   │   ├── hostel/
│   │   │   ├── page.tsx
│   │   │   ├── rooms/page.tsx
│   │   │   └── visitors/page.tsx
│   │   │
│   │   ├── inventory/
│   │   │   ├── page.tsx
│   │   │   └── purchase-orders/page.tsx
│   │   │
│   │   ├── events/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   │
│   │   ├── communication/
│   │   │   ├── page.tsx                # Inbox / messages
│   │   │   └── announcements/page.tsx
│   │   │
│   │   ├── reports/
│   │   │   └── page.tsx                # Report builder
│   │   │
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── school/page.tsx         # Branding, timezone, etc.
│   │       └── roles/page.tsx          # Custom role editor
│   │
│   └── admin/
│       ├── layout.tsx                  # Super Admin shell
│       ├── page.tsx                    # Platform dashboard
│       ├── schools/page.tsx
│       ├── subscriptions/page.tsx
│       └── monitoring/page.tsx
│
├── components/
│   ├── ui/                             # ShadCN components (Button, Input, etc.)
│   ├── layout/
│   │   ├── Sidebar.tsx                 # Collapsible, permission-filtered nav
│   │   ├── Topbar.tsx                  # Search, notifications bell, avatar
│   │   └── MobileNav.tsx
│   ├── tables/
│   │   └── DataTable.tsx               # TanStack Table + filters + export
│   ├── forms/
│   │   └── FormField.tsx               # React Hook Form + Zod wrappers
│   ├── charts/
│   │   ├── BarChart.tsx                # Recharts bar chart wrapper
│   │   ├── LineChart.tsx
│   │   ├── PieChart.tsx
│   │   └── AreaChart.tsx
│   └── common/
│       ├── Avatar.tsx
│       ├── Badge.tsx
│       ├── EmptyState.tsx
│       ├── LoadingSpinner.tsx
│       ├── ConfirmDialog.tsx
│       └── PageHeader.tsx
│
├── features/
│   ├── auth/
│   │   ├── auth.store.ts               # Zustand: accessToken, user, role
│   │   ├── LoginForm.tsx
│   │   └── useSession.ts               # Token refresh logic
│   ├── students/
│   │   ├── useStudents.ts              # TanStack Query hooks
│   │   ├── StudentForm.tsx             # Multi-step RHF form
│   │   └── StudentTable.tsx
│   ├── attendance/
│   │   ├── AttendanceGrid.tsx          # Bulk mark UI
│   │   └── QrScanner.tsx              # Camera-based QR attendance
│   ├── fees/
│   │   ├── FeeCollectionForm.tsx
│   │   └── ReceiptViewer.tsx           # PDF receipt preview
│   ├── exams/
│   │   ├── MarksEntryTable.tsx         # Inline editable marks grid
│   │   └── ReportCardViewer.tsx
│   └── notifications/
│       ├── NotificationBell.tsx
│       └── NotificationInbox.tsx
│
├── lib/
│   ├── api.ts                          # Axios instance + interceptors
│   ├── auth.ts                         # Token storage helpers
│   ├── utils.ts                        # cn(), formatDate(), formatCurrency()
│   └── i18n/
│       ├── en.json
│       └── hi.json
│
├── store/
│   ├── auth.store.ts                   # User, token, tenant branding
│   └── ui.store.ts                     # Theme, language, sidebar open state
│
└── types/
    ├── api.types.ts                    # ApiResponse<T>, PaginatedResponse<T>
    └── models.types.ts                 # Frontend-side model interfaces
```

### 6.2 State Management Strategy

```typescript
// store/auth.store.ts
interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  tenantBranding: TenantBranding | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string) => void;
  setUser: (user: UserProfile) => void;
  logout: () => void;
}

// store/ui.store.ts
interface UiState {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'hi';
  sidebarOpen: boolean;
  setTheme: (theme: UiState['theme']) => void;
  toggleSidebar: () => void;
}
```

### 6.3 API Client Pattern

```typescript
// lib/api.ts
const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

// Request interceptor: inject access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: silent refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
      useAuthStore.getState().setTokens(data.accessToken);
      return api(error.config);
    }
    return Promise.reject(error);
  },
);
```

---

## 7. API Endpoints Summary

All endpoints are prefixed with `/api/v1` and require `Authorization: Bearer <token>` except where noted.

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | No | Email + password login, returns access token |
| POST | `/auth/refresh` | Cookie | Refresh access token using httpOnly cookie |
| POST | `/auth/logout` | Yes | Revoke refresh token |
| POST | `/auth/forgot-password` | No | Send OTP to email |
| POST | `/auth/reset-password` | No | Verify OTP + set new password |
| POST | `/auth/verify-email` | No | Verify email from link |
| GET | `/auth/me` | Yes | Get current user profile |
| GET | `/auth/sessions` | Yes | List active sessions |
| DELETE | `/auth/sessions/:id` | Yes | Revoke a session |

### Students
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/students` | students:read |
| POST | `/students` | students:create |
| GET | `/students/:id` | students:read |
| PUT | `/students/:id` | students:update |
| DELETE | `/students/:id` | students:delete |
| POST | `/students/import` | students:create |
| GET | `/students/:id/documents` | students:read |
| POST | `/students/:id/documents` | students:update |
| POST | `/students/:id/transfer-certificate` | students:manage |
| POST | `/students/:id/promote` | students:manage |

### Academic Management
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/academic/years` | academic:read / academic:create |
| PUT/DELETE | `/academic/years/:id` | academic:update / academic:delete |
| GET/POST | `/academic/classes` | academic:read / academic:create |
| GET/POST | `/academic/sections` | academic:read / academic:create |
| GET/POST | `/academic/subjects` | academic:read / academic:create |
| GET/POST/PUT | `/academic/timetable` | timetable:manage |
| GET/POST | `/academic/holidays` | academic:manage |

### Attendance
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/attendance` | attendance:read |
| POST | `/attendance` | attendance:create |
| PUT | `/attendance/:id` | attendance:update |
| GET | `/attendance/reports` | attendance:read |
| POST | `/attendance/bulk` | attendance:create |
| GET | `/attendance/staff` | attendance:read |
| POST | `/attendance/staff` | attendance:create |

### Fees
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/fees/categories` | fees:manage |
| GET/POST/PUT | `/fees/structures` | fees:manage |
| GET | `/fees/payments` | fees:read |
| POST | `/fees/payments` | fees:create |
| GET | `/fees/payments/:id/receipt` | fees:read |
| POST | `/fees/refunds` | fees:manage |
| GET | `/fees/defaulters` | fees:read |
| GET | `/fees/reports` | fees:read |
| POST | `/fees/reminders/send` | fees:manage |

### Examinations
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/exams` | exams:read / exams:create |
| PUT/DELETE | `/exams/:id` | exams:update / exams:delete |
| GET/POST | `/exams/:id/schedules` | exams:manage |
| POST | `/exams/results` | exams:results:enter |
| POST | `/exams/results/import` | exams:results:enter |
| GET | `/exams/:id/results` | exams:read |
| GET | `/exams/report-cards/:studentId` | exams:read |
| POST | `/exams/:id/publish` | exams:publish |

### Homework
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/homework` | homework:read / homework:create |
| GET/PUT/DELETE | `/homework/:id` | homework:read / homework:manage |
| POST | `/homework/:id/submit` | homework:submit |
| GET | `/homework/:id/submissions` | homework:read |
| PUT | `/homework/:id/submissions/:subId/evaluate` | homework:evaluate |

### Staff & HR
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/staff` | staff:read / staff:create |
| GET/PUT/DELETE | `/staff/:id` | staff:manage |
| GET/POST | `/staff/departments` | staff:manage |
| GET/POST | `/staff/designations` | staff:manage |
| GET/POST | `/staff/salary-structures` | payroll:manage |

### Payroll
| Method | Endpoint | Permission |
|--------|----------|------------|
| POST | `/payroll/generate` | payroll:generate |
| GET | `/payroll` | payroll:read |
| GET | `/payroll/:staffId/:month/:year` | payroll:read |
| PUT | `/payroll/:id/finalise` | payroll:finalise |
| GET | `/payroll/:id/payslip` | payroll:read |
| GET | `/payroll/reports` | payroll:read |

### Leave Management
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/leaves/types` | leave:manage |
| GET | `/leaves` | leave:read |
| POST | `/leaves` | leave:apply |
| PUT | `/leaves/:id/approve` | leave:approve |
| PUT | `/leaves/:id/reject` | leave:approve |
| GET | `/leaves/balances/:staffId` | leave:read |

### Library
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/library/books` | library:read / library:manage |
| PUT/DELETE | `/library/books/:id` | library:manage |
| POST | `/library/issue` | library:manage |
| POST | `/library/return` | library:manage |
| GET | `/library/issues` | library:read |
| GET | `/library/reports` | library:read |

### Transport
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/transport/vehicles` | transport:manage |
| GET/POST | `/transport/routes` | transport:manage |
| POST/GET | `/transport/routes/:id/stops` | transport:manage |
| POST/GET | `/transport/assignments` | transport:manage |

### Hostel
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/hostel/hostels` | hostel:manage |
| GET/POST | `/hostel/rooms` | hostel:manage |
| POST | `/hostel/allocations` | hostel:manage |
| GET/POST | `/hostel/visitors` | hostel:manage |
| GET/POST | `/hostel/mess` | hostel:manage |

### Communication
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/communication/messages` | communication:read / communication:send |
| GET/POST | `/communication/announcements` | communication:read / communication:broadcast |
| GET/POST | `/communication/circulars` | communication:manage |

### Events & Inventory
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/events` | events:read / events:manage |
| POST | `/events/:id/register` | events:register |
| GET/POST | `/inventory/items` | inventory:manage |
| GET/POST | `/inventory/purchase-orders` | inventory:manage |

### Platform (Super Admin)
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/admin/tenants` | platform:manage |
| PUT | `/admin/tenants/:id` | platform:manage |
| GET/POST/PUT | `/admin/subscriptions` | platform:manage |
| GET | `/admin/monitoring` | platform:read |

### Utility
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/health` | No |
| GET | `/settings` | Yes |
| PUT | `/settings` | Yes |
| POST | `/storage/presign` | Yes |
| GET | `/reports/:type` | Yes |

---

## 8. Queue Architecture (BullMQ)

### 8.1 Queue Overview

All queues use Redis as the backing store via BullMQ. The queue worker runs as a separate Docker service (`apps/worker`) so queue processing does not block API response latency.

```
Redis (BullMQ)
├── notifications-queue      Priority: High
├── import-queue             Priority: Medium
├── export-queue             Priority: Medium
├── reminder-queue           Priority: Low (scheduled/cron)
└── payroll-queue            Priority: Medium
```

### 8.2 Queue Definitions and Job Schemas

```typescript
// Notifications queue — multi-channel delivery
interface NotificationJob {
  tenantId: string;
  userId: string;
  notificationId: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP' | 'IN_APP';
  template: string;
  data: Record<string, unknown>;
  recipientPhone?: string;
  recipientEmail?: string;
}

// Import queue — CSV bulk import
interface ImportJob {
  tenantId: string;
  userId: string;         // who triggered the import
  entity: 'STUDENT' | 'STAFF';
  fileKey: string;        // S3 key of uploaded CSV
  fieldMapping: Record<string, string>;
}

// Export queue — large report/data export
interface ExportJob {
  tenantId: string;
  userId: string;
  reportType: string;
  filters: Record<string, unknown>;
  format: 'PDF' | 'EXCEL' | 'CSV';
}

// Reminder queue — fee and assignment reminders
interface ReminderJob {
  tenantId: string;
  type: 'FEE_DUE' | 'FEE_OVERDUE' | 'ASSIGNMENT_DUE';
  entityId: string;
}

// Payroll queue — bulk payroll generation
interface PayrollJob {
  tenantId: string;
  month: number;
  year: number;
  triggeredBy: string;
  staffIds?: string[];    // optional: generate for specific staff only
}
```

### 8.3 Processor Implementation Pattern

```typescript
// modules/queue/processors/notifications.processor.ts
@Processor('notifications-queue')
export class NotificationsProcessor {
  constructor(
    private readonly smsProvider: SmsProvider,
    private readonly emailProvider: EmailProvider,
    private readonly whatsappProvider: WhatsappProvider,
    private readonly prisma: PrismaService,
  ) {}

  @Process()
  async handle(job: Job<NotificationJob>) {
    const { notificationId, channel, data } = job.data;

    try {
      switch (channel) {
        case 'SMS':
          await this.smsProvider.send(job.data);
          break;
        case 'EMAIL':
          await this.emailProvider.send(job.data);
          break;
        case 'WHATSAPP':
          await this.whatsappProvider.send(job.data);
          break;
      }
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      // BullMQ will auto-retry up to 3 times (configured on queue)
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { retryCount: { increment: 1 } },
      });
      throw err; // re-throw to trigger BullMQ retry
    }
  }
}
```

### 8.4 Scheduled Jobs (Cron via BullMQ Repeat)

| Job | Schedule | Description |
|-----|----------|-------------|
| Fee overdue reminders | Daily 8:00 AM | Check overdue fees, dispatch FEE_OVERDUE reminders |
| Assignment due reminders | Daily 7:00 AM | Notify students of assignments due today |
| Subscription expiry alerts | Daily 9:00 AM | Alert school owners of upcoming subscription expiry |
| Attendance analytics rollup | Daily midnight | Aggregate daily attendance into AttendanceAnalytics |
| Fee analytics rollup | Daily midnight | Aggregate daily payments into FeeAnalytics |
| Session cleanup | Hourly | Delete expired sessions from the Sessions table |

---

## 9. Docker & DevOps

### 9.1 docker-compose.yml

```yaml
version: '3.9'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - web
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
      - JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
      - S3_BUCKET=${S3_BUCKET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    depends_on:
      - api
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - S3_ENDPOINT=${S3_ENDPOINT}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 9.2 Nginx Configuration (Subdomain Routing)

```nginx
# nginx/nginx.conf
upstream api {
  server api:3001;
}

upstream web {
  server web:3000;
}

# Wildcard subdomain: *.school-erp.com → web frontend
server {
  listen 80;
  server_name ~^(?<subdomain>.+)\.school-erp\.com$;

  # API routes → NestJS
  location /api/ {
    proxy_pass http://api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # Everything else → Next.js
  location / {
    proxy_pass http://web;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### 9.3 Environment Variables

```bash
# .env.example
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/school_erp

# Redis
REDIS_URL=redis://:password@redis:6379
REDIS_PASSWORD=strong_password

# JWT (RS256 key pair — generate with openssl)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# S3 / MinIO
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=school-erp
S3_REGION=us-east-1

# Notification providers
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxx
SMS_PROVIDER=MSG91
MSG91_AUTH_KEY=xxx
WHATSAPP_API_URL=https://api.whatsapp.com/v1
WHATSAPP_TOKEN=xxx

# Frontend
NEXT_PUBLIC_API_URL=https://app.school-erp.com/api/v1
NEXT_PUBLIC_APP_URL=https://school-erp.com

# Postgres (Docker Compose)
POSTGRES_USER=school_erp
POSTGRES_PASSWORD=strong_password
POSTGRES_DB=school_erp
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
```

---

## 10. Security Considerations

### 10.1 Authentication Security

| Concern | Mitigation |
|---------|-----------|
| Token theft via XSS | Access token in memory only; refresh token in httpOnly Secure SameSite=Strict cookie |
| CSRF attacks | SameSite=Strict cookie; CSRF token on state-changing requests |
| Brute-force login | Account lock after 5 failed attempts in 15 min; rate limiting per IP via @nestjs/throttler |
| Session hijacking | Refresh token rotation (single-use); device fingerprint check |
| Token replay after logout | Refresh token hash stored in DB; invalidated on logout |
| 2FA bypass | 2FA check happens server-side before token issuance; cannot be skipped client-side |

### 10.2 Data Isolation

```typescript
// Prisma middleware extension enforces tenantId on every operation
// Applied globally in PrismaService — no per-service opt-in required
// Exempt models: Tenant, SubscriptionPlan, Permission (platform-level)

// Super Admin impersonation:
// 1. Super Admin calls POST /admin/tenants/:id/impersonate
// 2. Server issues a short-lived (1h) scoped token with tenantId claim
// 3. All actions under impersonation are recorded in AuditLog with
//    { actor: superAdminId, impersonatedTenantId, action }
```

### 10.3 API Security Layers

```
1. TLS termination at Nginx
2. Helmet.js — sets X-Frame-Options, HSTS, CSP, X-Content-Type-Options
3. CORS — origins restricted to *.school-erp.com only
4. Rate Limiting:
   - /auth/login: 5 req/15min per IP
   - /auth/forgot-password: 3 req/hour per IP
   - General API: 300 req/min per tenant
5. Request size limit: 10MB (configurable; large file uploads use presigned S3 URLs)
6. Input validation: class-validator on all DTOs; Prisma parameterised queries prevent SQL injection
7. File upload validation:
   - MIME type whitelist (images, PDF, XLSX, CSV)
   - Max file size per category (profile photo: 2MB; documents: 10MB)
   - Files go directly to S3 via presigned URL — API never buffers file content
```

### 10.4 Secrets Management

- All secrets loaded from environment variables at runtime
- Docker Compose uses `.env` file (never committed to git)
- Production: secrets stored in AWS Secrets Manager / HashiCorp Vault
- Prisma connection string never logged
- JWT private key loaded from environment, not from file
- AuditLog records action + metadata but never logs passwords, tokens, or payment card data

### 10.5 Database Security

```sql
-- Dedicated DB user with minimal privileges
CREATE USER school_erp_app WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE school_erp TO school_erp_app;
GRANT USAGE ON SCHEMA public TO school_erp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO school_erp_app;
-- No DROP, TRUNCATE, or schema-modification privileges

-- Row-level security (optional future enhancement for multi-schema migration)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
```

### 10.6 Sensitive Data Handling

| Field | Protection |
|-------|-----------|
| passwordHash | bcrypt, cost factor 12 |
| twoFactorSecret | AES-256 encrypted at application layer |
| refreshTokenHash | bcrypt before storage; raw token never stored |
| studentMedicalInfo | Encrypted JSON column (pgcrypto) |
| paymentTransactionRef | Stored, never logged in plaintext |
| staffSalary | Access restricted to Accountant + School Owner roles |

---

## 11. Phased Implementation Plan

| Phase | Scope | Key Deliverables | Estimated Effort |
|-------|-------|-----------------|-----------------|
| **1** | Foundation | Monorepo setup, Docker Compose, CI/CD skeleton, Prisma schema + migrations, Auth (JWT + 2FA + RBAC), Multi-tenancy middleware, Tenant provisioning, Super Admin panel scaffold | Week 1–3 |
| **2** | Core Academic | Student management (full lifecycle + documents), Academic year / class / section / subject CRUD, Timetable with conflict detection, Role-based dashboards | Week 4–6 |
| **3** | Engagement | Attendance module (bulk + QR), Homework + submission + evaluation, Internal messaging + announcements, Notification infrastructure (SMS/email/WhatsApp via queues) | Week 7–9 |
| **4** | Finance | Fee structure configuration, Payment collection (Razorpay/Stripe/Cash), Receipt PDF generation, Defaulters report, Late fees automation, Payroll with salary structures + payslip PDF, Leave management with approval workflow | Week 10–13 |
| **5** | Examinations | Exam scheduling, Marks entry + bulk CSV import, Grade scale + GPA calculation, Report card PDF generation + publishing, Co-scholastic assessments, Promotion logic | Week 14–16 |
| **6** | Operations | Library (catalogue + issue/return + fines), Transport (vehicles + routes + student assignment), Hostel (rooms + beds + visitors + mess), Inventory (assets + purchase orders + maintenance) | Week 17–20 |
| **7** | Intelligence | Report builder (PDF/Excel/CSV export), Analytics dashboards (attendance trends, fee collection, exam performance) using Recharts, Event management + calendar | Week 21–23 |
| **8** | SaaS Layer | Subscription plan management, Billing cycle enforcement, Trial period handling, Feature flag gating by plan, AI readiness (analytics tables seeding for future ML integration) | Week 24–26 |

### Key Milestones

```
Week 3  ✓ Working multi-tenant auth with subdomain isolation
Week 6  ✓ End-to-end student admission workflow
Week 9  ✓ Attendance marked + parents notified via WhatsApp
Week 13 ✓ Fee collected + receipt printed + payroll generated
Week 16 ✓ Report cards published to parents
Week 20 ✓ All operational modules live
Week 23 ✓ Analytics dashboard with charts
Week 26 ✓ SaaS billing + first paying customers onboarded
```

### Non-Functional Targets

| Metric | Target |
|--------|--------|
| API p95 response time | < 300ms (non-report endpoints) |
| Report generation | < 10s for up to 500 students |
| Concurrent tenants | 100+ tenants on single deployment |
| Uptime | 99.5% (Docker health checks + restart policies) |
| Data export | < 30s for 10,000 record CSV |
| Mobile responsiveness | All pages usable on 375px viewport |
| Accessibility | WCAG 2.1 AA for all primary workflows |
