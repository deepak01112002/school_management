# Implementation Tasks

## Phase 1: Authentication + Multi-tenancy + Core Setup

- [x] 1. Initialize monorepo with Turborepo, NestJS API, Next.js web app, and worker app
  - Set up `apps/api`, `apps/web`, `apps/worker`, and `packages/shared` using Turborepo
  - Configure TypeScript, ESLint, Prettier across all apps and packages
  - Set up `packages/config` for shared ESLint, TypeScript, and Tailwind configs
  - Scaffold `packages/ui` with ShadCN/TailwindCSS component library base
  - _Requirements: 1, 2, 3_

- [x] 2. Configure Prisma schema and database migrations
  - Write complete `prisma/schema.prisma` with all models, enums, relations, and indexes as defined in the design
  - Run `prisma migrate dev` to generate the initial migration
  - Create seed script with platform roles, default subscription plans, and a demo Super Admin account
  - _Requirements: 1, 3, 5, 6_

- [x] 3. Set up Docker Compose services
  - Define `docker-compose.yml` with services: postgres, redis, minio, nginx, api, web, worker
  - Configure `docker-compose.dev.yml` with hot-reload volumes for local development
  - Write `.env.example` documenting all required environment variables
  - _Requirements: 1, 2_

- [x] 4. Configure Nginx subdomain routing
  - Write `nginx.conf` with wildcard subdomain routing (`*.school-erp.com` → API/Web)
  - Configure TLS termination and HTTP→HTTPS redirect
  - Route `/api/*` to NestJS and all other paths to Next.js
  - _Requirements: 1_


- [x] 5. Implement tenant resolver middleware and tenant context propagation
  - Build `TenantResolverMiddleware` to extract tenant from Host header and resolve `tenantId` from DB
  - Implement `TenantId` param decorator for controllers
  - Write Prisma extension (`withTenant`) to automatically scope all queries by `tenantId`
  - Return HTTP 404 for unresolvable subdomains and HTTP 403 for suspended tenants
  - _Requirements: 1_

- [~] 6. Implement JWT authentication service (login, logout, refresh)
  - Build `AuthService` with login endpoint returning RS256-signed access JWT (15 min) and httpOnly refresh token cookie (7 days)
  - Implement `POST /auth/refresh` with single-use refresh token rotation
  - Implement `POST /auth/logout` invalidating the refresh token in the Session table
  - Record every login, logout, and refresh as an `AuditLog` entry with IP, user agent, and timestamp
  - _Requirements: 2_

- [x] 7. Implement password reset with OTP and email verification
  - Build `POST /auth/forgot-password` to generate a time-limited OTP (10 min) and dispatch it via email within 60 seconds
  - Build `POST /auth/reset-password` validating the OTP and enforcing password policy
  - Build email verification flow: send token on registration, `GET /auth/verify-email?token=` to confirm
  - _Requirements: 2_

- [~] 8. Implement two-factor authentication (TOTP)
  - Build `POST /auth/2fa/enable` to generate a TOTP secret (stored encrypted) and return QR code URI
  - Build `POST /auth/2fa/verify` to confirm setup with a TOTP code
  - Require valid TOTP code after password verification when 2FA is enabled before issuing JWT
  - _Requirements: 2_

- [~] 9. Implement session and device management
  - Build `GET /auth/sessions` to list all active sessions with device info per user
  - Build `DELETE /auth/sessions/:id` to revoke a specific session
  - Send email notification when a new device logs in
  - Implement account lockout after 5 consecutive failed attempts within 15 minutes with unlock email
  - _Requirements: 2_

- [x] 10. Implement RBAC guard and permission decorator
  - Build `RbacGuard` checking `RequirePermissions` metadata against the user's resolved permission set
  - Build `@RequirePermissions(...perms)` decorator for controller methods
  - Return HTTP 403 with a descriptive message when permissions are insufficient
  - Seed the full 13-role permission matrix into the database on tenant provisioning
  - _Requirements: 3_


- [~] 11. Implement audit log service and IP restriction
  - Build `AuditLogService` with a `log(action, entity, entityId, oldValues, newValues)` method
  - Wire audit logging into auth events and permission changes
  - Implement IP allowlist middleware: read per-tenant IP restriction config and return HTTP 403 for disallowed IPs
  - _Requirements: 1, 2, 3_

- [~] 12. Add health check endpoint, global exception filter, and transform interceptor
  - Build `GET /health` returning service status for postgres, redis, and MinIO
  - Implement `GlobalExceptionFilter` mapping all NestJS and Prisma exceptions to consistent JSON error shapes
  - Implement `TransformInterceptor` wrapping successful responses in `{ data, meta, timestamp }` envelope
  - _Requirements: 1, 2_

- [~] 13. Configure rate limiting and CI/CD GitHub Actions pipeline
  - Apply `@nestjs/throttler` with per-tenant configurable limits; stricter limits on auth routes
  - Write GitHub Actions workflow: lint → typecheck → test → Docker build → push to registry
  - Add a deploy job triggered on `main` branch merge using Docker Compose rolling update
  - _Requirements: 2_

- [~] 14. Build Super Admin tenant management API and UI
  - Build CRUD endpoints under `/super-admin/tenants` for creating, viewing, suspending, and soft-deleting tenants
  - Build Next.js Super Admin pages: tenant list with filters, tenant detail, create/edit form
  - Implement impersonation mechanism (`POST /super-admin/tenants/:id/impersonate`) with audit log entry
  - _Requirements: 1_

- [~] 15. Build tenant provisioning flow
  - Implement `TenantProvisioningService` executing the full provisioning transaction: tenant record, subscription link, role seeding, default academic year, School Owner account, welcome email
  - Expose `POST /super-admin/tenants` triggering provisioning atomically
  - Verify idempotency: re-running provisioning on an existing tenant is a no-op
  - _Requirements: 1, 3_

- [~] 16. Build tenant branding API and frontend branding rendering
  - Build `PATCH /settings/branding` for School Owner to update logo URL, primary/secondary colour, and school name
  - In Next.js, fetch tenant branding server-side by subdomain and inject CSS custom properties and logo into layout
  - Store branding in `Tenant` record and cache in Redis with 5-minute TTL
  - _Requirements: 1_

- [~] 17. Build subscription plan CRUD for Super Admin
  - Build REST endpoints for creating, editing, activating, and deactivating subscription plans
  - Plans include name, price, billing cycle, student limit, staff limit, and feature flags
  - Build Super Admin UI: plan list, create/edit form, feature toggle checkboxes
  - _Requirements: 20_

- [~] 18. Build frontend auth pages
  - Build Next.js pages: `/login`, `/forgot-password`, `/reset-password`, `/verify-email`
  - Implement form validation with Zod and React Hook Form; show field-level error messages
  - Style with ShadCN components and apply tenant branding (logo + primary colour)
  - _Requirements: 2_

- [~] 19. Implement auth Zustand store and Axios interceptors with silent refresh
  - Create `useAuthStore` holding access token in memory, user profile, and role permissions
  - Configure Axios instance with a request interceptor injecting `Authorization: Bearer` header
  - Implement response interceptor that silently calls `POST /auth/refresh` on 401 and retries the original request
  - _Requirements: 2_

- [x] 20. Build role-based sidebar with permission filtering
  - Define navigation config as a tree of items each annotated with required permission strings
  - On mount, filter nav items against the authenticated user's resolved permission set from Zustand store
  - Persist sidebar collapsed/expanded state in localStorage; support mobile drawer variant
  - _Requirements: 3, 4_


---

## Phase 2: Students + Classes + Teachers

- [x] 21. Build academic year, class, and section CRUD API and UI
  - Implement REST endpoints for academic year create/list/activate/close under `/academic-years`
  - Implement class and section CRUD under `/classes` and `/sections` with duplicate name validation
  - Build Next.js UI: academic year switcher, class list with sections expandable per class
  - _Requirements: 6_

- [x] 22. Build subject CRUD and subject-teacher assignment API and UI
  - Implement subject CRUD under `/subjects` with subject code uniqueness per tenant
  - Implement `ClassSubject` linking: assign subjects to classes and assign a teacher to each class-subject
  - Build UI: subject list, assign-to-class modal, teacher assignment dropdown
  - _Requirements: 6_

- [~] 23. Build student admission multi-step form (enquiry → admitted)
  - Implement student CRUD API under `/students` with status transition: `ENQUIRY → REGISTERED → ADMITTED`
  - Build a multi-step Next.js form: personal details, parent/guardian, documents, confirmation
  - Validate required documents before allowing status transition to ADMITTED; flag incomplete admissions
  - _Requirements: 5_

- [~] 24. Implement roll number auto-generation and student profile
  - Implement configurable roll number format (prefix + year + sequence) auto-generated on admission
  - Store full student profile: photograph, medical info (allergies, doctor), parent/guardian linkage, address
  - Build student profile page with all sections: overview, documents, attendance summary, fee status
  - _Requirements: 5_

- [~] 25. Implement student document upload using S3 presigned URLs
  - Build `POST /students/:id/documents/upload-url` to generate MinIO/S3 presigned PUT URLs
  - Store `StudentDocument` record on upload confirmation with file URL, size, and MIME type
  - Enforce per-tenant access control: only users with `students:read` on the same tenant can retrieve URLs
  - _Requirements: 5_

- [~] 26. Build student ID card PDF generation
  - Implement `GET /students/:id/id-card` generating a PDF with photo, name, class, roll number, and QR code
  - Use a PDF library (e.g., `puppeteer` or `@react-pdf/renderer`) with tenant-branded header
  - Provide a bulk ID card generation endpoint accepting an array of student IDs
  - _Requirements: 5_

- [~] 27. Build bulk student CSV import via BullMQ queue
  - Implement `POST /students/import` accepting a CSV file, validating headers, and enqueuing a BullMQ job
  - Write `StudentImportProcessor` handling row-by-row validation, upsert, and error collection
  - Emit a progress event via SSE or WebSocket; notify the initiating user by email/in-app on completion
  - _Requirements: 5_

- [~] 28. Build bulk student export and transfer certificate issuance
  - Implement `GET /students/export` streaming a CSV or Excel file filtered by class, section, status
  - Implement `POST /students/:id/transfer-certificate` generating a TC PDF with unique cert number and issue date
  - Track TC issuance in `TransferCertificate` table and update student status to `ALUMNI` or `WITHDRAWN`
  - _Requirements: 5_

- [~] 29. Build promotion history and scholarship/discount management
  - Implement `POST /students/:id/promote` recording source class, target class, academic year, and promotion status
  - Implement `StudentScholarship` CRUD: link scholarship/discount (percentage or fixed) to a student
  - Build UI: promotion wizard per class/section, scholarship list with apply/remove actions
  - _Requirements: 5_

- [~] 30. Build timetable builder with conflict detection
  - Implement timetable CRUD under `/timetables` for assigning teacher + subject to a section's period
  - On create/update, validate that the same teacher is not assigned to two sections at the same period
  - Build a weekly grid UI per section showing all periods, with drag-or-select assignment and conflict highlighting
  - _Requirements: 6_

- [x] 31. Build class teacher assignment and role-specific dashboards
  - Implement `PATCH /sections/:id/class-teacher` to assign a staff member as class teacher for a section
  - Build role-specific dashboard pages for Principal, Teacher, Accountant, Parent, Student, and Super Admin
  - Populate each dashboard with the KPIs defined in requirements; wire up TanStack Query with 5-minute refresh interval
  - _Requirements: 4, 6_


---

## Phase 3: Attendance + Timetable + Homework + Communication

- [~] 32. Build student daily attendance marking UI (per class/section)
  - Implement `POST /attendance` to mark attendance records (PRESENT, ABSENT, LATE, EXCUSED) per student per period
  - Implement `GET /attendance` with filters for class, section, date, and period
  - Build a class roster UI with radio/toggle per student; disable submission for holiday dates (show confirmation prompt)
  - _Requirements: 7_

- [~] 33. Implement bulk attendance marking and absent notification dispatch
  - Add a "Mark All Present" bulk action on the attendance UI with per-student override capability
  - Enqueue a BullMQ `AbsentNotificationJob` whenever a student is marked absent; deliver via SMS, WhatsApp, or email per tenant settings
  - Implement retry logic: retry up to 3 times before marking notification as failed and logging
  - _Requirements: 7, 11_

- [~] 34. Implement QR code attendance
  - Generate a unique QR code per student encoding their `studentId` and `tenantId`
  - Build `POST /attendance/qr-scan` endpoint accepting the decoded QR payload and marking attendance
  - Build a scanner UI page (using camera API) accessible to teachers for in-class QR scanning
  - _Requirements: 7_

- [~] 35. Build attendance reports (monthly, per student, per class)
  - Implement report endpoints: monthly attendance per student, per class summary, subject-wise attendance
  - Calculate and return attendance percentage for any selected date range
  - Build a report UI with date range picker, class/section/student filters, and a table + bar chart view
  - _Requirements: 7_

- [~] 36. Build staff attendance check-in/check-out and leave integration
  - Implement `POST /staff-attendance/check-in` and `POST /staff-attendance/check-out` with timestamp recording
  - Implement a cron job that automatically marks staff attendance as `ON_LEAVE` when an approved leave covers that day
  - Build staff attendance admin view with daily roster and monthly summary per staff member
  - _Requirements: 7, 14_

- [~] 37. Build holiday management
  - Implement `Holiday` CRUD under `/holidays` with type (national, regional, school, religious) per academic year
  - Integrate holiday check into attendance marking to display a warning if marking on a holiday date
  - Display holidays on the school calendar view
  - _Requirements: 6, 7_

- [~] 38. Build assignment creation, submission, and evaluation workflow
  - Implement assignment CRUD for teachers under `/assignments` with file attachment support via S3 presigned URLs
  - Implement `POST /assignments/:id/submit` for students to submit text response and file attachments before due date
  - Flag late submissions automatically; implement teacher evaluation endpoint with marks and written feedback
  - _Requirements: 10_

- [~] 39. Build parent homework monitoring view and late submission notifications
  - Build parent-facing read-only assignment view showing child's assignments, submission status, and teacher feedback
  - Enqueue BullMQ notification job when a new assignment is created, notifying relevant students and parents
  - Mark non-submitted assignments as overdue via a scheduled cron job after the due date passes
  - _Requirements: 10, 11_

- [~] 40. Build internal messaging and announcements
  - Implement thread-based internal messaging between any two users within a tenant (`/messages`)
  - Implement announcement broadcast to defined recipient groups (all staff, all parents, specific class)
  - Implement circular creation with PDF attachment and distribution to recipient groups
  - _Requirements: 11_

- [~] 41. Build notification inbox and in-app bell
  - Implement `Notification` records with read/unread status per user
  - Build API endpoints: `GET /notifications` (paginated), `PATCH /notifications/:id/read`, `GET /notifications/unread-count`
  - Build in-app bell component with unread count badge, dropdown list, and mark-all-read action
  - _Requirements: 11_

- [~] 42. Build event creation and school calendar view
  - Implement event CRUD under `/events` with date, time, venue, description, audience, and RSVP tracking
  - Build a calendar UI (month/week/day views) combining events, exam schedules, and holidays
  - Implement RSVP endpoint `POST /events/:id/rsvp` and display registration count to organizers
  - _Requirements: 11_

- [~] 43. Build SMS, Email, and WhatsApp notification provider integrations
  - Implement provider adapters for email (SMTP/SendGrid), SMS (Twilio/MSG91), and WhatsApp (360dialog/Twilio)
  - Build BullMQ notification processors consuming jobs from the notifications queue with per-channel retry logic
  - Implement per-tenant notification channel preference config (`settings.notifications` JSON)
  - _Requirements: 7, 10, 11_


---

## Phase 4: Fees + Accounting + Payroll + Leave

- [~] 44. Build fee category and fee structure configuration
  - Implement `FeeCategory` CRUD and `FeeStructure` CRUD under `/fee-structures` assignable per class and session
  - Support fee types: tuition, transport, hostel, library, late, and custom with configurable frequency
  - Build UI: fee structure list, create/edit form with category line items per class and session
  - _Requirements: 8_

- [~] 45. Build fee collection form with multiple payment methods
  - Implement `POST /fee-payments` supporting Cash, UPI, bank transfer, Razorpay, and Stripe payment methods
  - Generate a GST-compliant receipt PDF on payment with unique receipt number, student details, amount, method, and date
  - Build UI: fee collection form pre-filled from student fee ledger, payment method selector, receipt download
  - _Requirements: 8_

- [~] 46. Integrate Razorpay and Stripe with webhook handling
  - Implement Razorpay order creation and `POST /webhooks/razorpay` handler verifying signature before marking fee paid
  - Implement Stripe PaymentIntent creation and `POST /webhooks/stripe` handler
  - Mark transactions as pending if webhook is not received within 30 minutes; alert the Accountant
  - _Requirements: 8_

- [~] 47. Implement late fee auto-calculation, scholarships, and discounts
  - Implement a daily cron job that calculates and applies late fee entries based on the configured late fee policy per tenant
  - Apply scholarship/discount records when generating fee dues for a student
  - Build UI: scholarship/discount application modal on the student fee page
  - _Requirements: 8_

- [~] 48. Build fee reminder scheduler and defaulters report
  - Implement a BullMQ cron job dispatching WhatsApp/SMS/email reminders to parents of students with pending dues per tenant's reminder schedule
  - Implement `GET /fees/defaulters` returning students with overdue fees, overdue amount, and days overdue
  - Build UI: defaulters report page with filters (class, section, days overdue) and export to CSV/Excel
  - _Requirements: 8_

- [~] 49. Build refund management and fee ledger
  - Implement `POST /fee-payments/:id/refund` supporting full and partial refunds with reason, recorded in the ledger
  - Implement `GET /students/:id/fee-ledger` returning all transactions (dues, payments, refunds) for a student
  - Build fee ledger UI: chronological transaction list with balance running total and export option
  - _Requirements: 8_

- [~] 50. Build financial reports with PDF, Excel, and CSV export
  - Implement daily, monthly, and category-wise fee collection report endpoints
  - Support export formats: PDF (using puppeteer or pdfmake), Excel (exceljs), and CSV
  - Build report UI: date range picker, report type selector, preview table, and export buttons
  - _Requirements: 8_

- [~] 51. Build staff salary structure and payroll generation
  - Implement `SalaryStructure` CRUD under `/payroll/salary-structures` with basic pay, allowances, and deductions per designation or individual staff
  - Implement `POST /payroll/generate` calculating net salary from attendance records, approved leaves, and salary structure for a given month
  - Support one-time bonuses and deductions added before finalisation
  - _Requirements: 13_

- [~] 52. Build payslip PDF generation and payroll finalisation
  - Implement `GET /payroll/:id/payslip` generating a formatted PDF payslip per staff member per month
  - Implement `POST /payroll/:id/finalise` locking the payroll month and recording an audit log entry; require explicit revision action for any post-finalisation changes
  - Build payroll management UI: month selector, staff list with calculated amounts, finalise button
  - _Requirements: 13_

- [~] 53. Build bank transfer export and payroll reports
  - Implement NEFT/RTGS export endpoint generating a bank-compatible file format for bulk salary transfer
  - Implement payroll summary reports: total disbursement, total deductions, and net payments per month
  - Build payroll report UI with monthly filters and export to PDF/Excel/CSV
  - _Requirements: 13_

- [~] 54. Build leave type configuration and leave application workflow
  - Implement leave type CRUD per tenant under `/leave-types` with annual balance configuration
  - Implement leave application CRUD for staff: apply, cancel, and view balance
  - Implement multi-level approval workflow (configurable approver chain); notify approver on submission and applicant on decision
  - Warn the applicant and require explicit confirmation when applying for leave exceeding the available balance (LOP)
  - _Requirements: 14_

- [~] 55. Build leave balance management and integration with attendance
  - Implement leave balance tracking: deduct approved days, restore on rejection/cancellation, handle LOP separately
  - Integrate approved leave with staff attendance: auto-mark `ON_LEAVE` for leave-covered dates via daily cron
  - Build leave report per staff member: taken, remaining, and lapsed per leave type per academic year
  - _Requirements: 14_


---

## Phase 5: Exams + Results

- [~] 56. Build exam type configuration and scheduling
  - Implement exam type CRUD under `/exam-types` (unit test, mid-term, final, custom) with max marks and passing criteria
  - Implement exam schedule CRUD under `/exams` with date, time, duration, class, section, subject, and venue
  - Build UI: exam type manager, exam schedule calendar grid, and create/edit exam form
  - _Requirements: 9_

- [~] 57. Build marks entry form and bulk marks CSV import
  - Implement `POST /exam-results` for teacher marks entry per student per subject; validate that entered marks do not exceed configured maximum
  - Implement `POST /exams/:id/results/import` accepting CSV with row-level validation and error reporting
  - Build marks entry UI: student roster with inline input per subject, save-draft and submit actions
  - _Requirements: 9_

- [~] 58. Build grade scale configuration and GPA calculation
  - Implement `GradeScale` CRUD per tenant: define grade boundaries (e.g., A+ = 90–100) and GPA points
  - Auto-calculate grade and GPA for each `ExamResult` record on marks save using the tenant's active grade scale
  - _Requirements: 9_

- [~] 59. Build report card PDF generation and co-scholastic assessment
  - Implement `GET /students/:id/report-cards/:examId` generating a printable PDF with subject-wise marks, grades, attendance percentage, and teacher remarks
  - Implement co-scholastic assessment CRUD for sports, arts, and behaviour grades stored separately
  - Include co-scholastic results in report card PDF if present
  - _Requirements: 9_

- [~] 60. Build exam performance analytics and result publication
  - Implement analytics endpoints: class-wise average, subject-wise average, top/bottom performers
  - Build charts UI using Recharts: bar chart for subject-wise averages, class rank distribution
  - Implement `POST /exams/:id/publish` to mark results as published and enqueue parent notifications via BullMQ
  - _Requirements: 9_

- [~] 61. Implement promotion logic enforcement
  - Implement promotion evaluation: check each student's exam results against configured pass criteria after final exam publication
  - Record promotion outcome (PROMOTED, RETAINED, TC) in `PromotionHistory` with source class, target class, and academic year
  - Build Principal UI: review promotion outcomes per class, override individual decisions, bulk promote/retain
  - _Requirements: 5, 9_


---

## Phase 6: Library + Transport + Hostel + Inventory

- [~] 62. Build book catalogue management and issue/return workflow
  - Implement book CRUD under `/library/books` with ISBN, title, author, publisher, category, and quantity
  - Implement `POST /library/issues` to issue a book with auto-calculated due date based on configured loan period
  - Implement `POST /library/issues/:id/return` calculating fine for overdue returns based on per-day fine rate
  - _Requirements: 15_

- [~] 63. Build QR scan for book issue/return and borrowing history
  - Generate and print a QR code per book encoding `bookId` and `tenantId`
  - Build `POST /library/issues/qr` endpoint accepting scanned QR payload to issue or return a book
  - Build borrowing history views: per student, per staff member, and per book with status and fine details
  - _Requirements: 15_

- [~] 64. Build library reports and lost book handling
  - Implement report endpoints: overdue books, fine collections, most-borrowed books
  - Implement `POST /library/issues/:id/report-lost` to record replacement charge and decrement inventory count
  - Build library reports UI with date range filters and export to CSV/PDF
  - _Requirements: 15_

- [~] 65. Build vehicle, driver, and transport route management
  - Implement vehicle CRUD under `/transport/vehicles` with registration, type, capacity, driver, and insurance details
  - Implement route and stop CRUD under `/transport/routes`; support named stops with pickup/drop times
  - Implement driver profile CRUD with licence details and contact information
  - _Requirements: 16_

- [~] 66. Build student transport assignment and fee auto-generation
  - Implement `POST /transport/assignments` assigning a student to a route/stop; validate capacity before assigning and warn if exceeded
  - Auto-generate a transport fee entry in the Fee Management module on student assignment
  - Build transport utilisation report: vehicle capacity vs. assigned students per route
  - _Requirements: 16_

- [~] 67. Build hostel building/room/bed management and student allocation
  - Implement hostel CRUD under `/hostel/buildings`, `/hostel/rooms`, and `/hostel/beds` with occupancy tracking
  - Implement student bed allocation with admission date, expected departure, and meal plan; prevent allocation if room is at capacity
  - Auto-generate a hostel fee entry in the Fee Management module on allocation
  - _Requirements: 17_

- [~] 68. Build visitor registration, mess management, and warden dashboard
  - Implement visitor registration CRUD under `/hostel/visitors` with name, purpose, entry/exit times, and student being visited
  - Implement mess records CRUD per meal type with daily meal cost tracking
  - Build warden dashboard: current occupancy, pending fee dues, recent visitor entries, and today's mess records
  - _Requirements: 17_

- [~] 69. Build asset/inventory management and purchase order workflow
  - Implement inventory item CRUD under `/inventory/assets` with category, quantity, purchase date, price, and vendor
  - Implement purchase order CRUD with status transitions: `DRAFT → ORDERED → PARTIAL → RECEIVED → CANCELLED`
  - Update asset inventory on purchase order receipt confirmation; alert designated staff when quantity falls below minimum stock level
  - _Requirements: 18_

- [~] 70. Build maintenance record scheduling and tracking
  - Implement maintenance record CRUD under `/inventory/maintenance` with asset reference, due date, assigned staff, and completion status
  - Implement a daily cron that flags overdue maintenance records and sends alerts to the responsible staff
  - Build inventory reports: asset valuation, maintenance schedule, and procurement history with export
  - _Requirements: 18_


---

## Phase 7: Reports + Analytics

- [~] 71. Build report builder UI with filter, preview, and export
  - Build a generic report builder component: select report type, configure filters, preview results in a table
  - Implement export actions: PDF (puppeteer), Excel (exceljs), and CSV for all report types
  - For large exports, enqueue an async BullMQ job and email the user a download link when ready
  - _Requirements: 5, 7, 8, 9, 13_

- [~] 72. Build attendance, fee, exam, and payroll reports
  - Implement paginated report endpoints for: monthly attendance per student, fee collection by date/category, exam performance by class/subject, payroll monthly summary
  - Apply role-based access on all report endpoints per the permission matrix
  - Build report pages with consistent filter layout, table preview, and export controls
  - _Requirements: 7, 8, 9, 13_

- [~] 73. Build library, transport, and hostel reports
  - Implement library overdue/fine/most-borrowed reports, transport utilisation reports, and hostel occupancy reports
  - Support CSV/PDF/Excel export for each report type
  - Build combined "reports hub" navigation page with report type cards
  - _Requirements: 15, 16, 17_

- [~] 74. Build custom dashboard widget builder
  - Implement widget configuration: users can select from available widget types (KPI card, chart, table) and pin up to 20 widgets to their dashboard
  - Persist widget layout and config per user in `User.settings` JSON column
  - Build drag-to-reorder widget grid using a library like `react-grid-layout`
  - _Requirements: 4_

- [~] 75. Build Super Admin cross-tenant analytics view
  - Implement Super Admin analytics endpoints: total tenants by status, total revenue, MRR, student count across tenants, subscription renewals due
  - Build Super Admin analytics dashboard with Recharts area/bar/pie charts and a tenants data table
  - _Requirements: 1, 20_

- [~] 76. Build Recharts dashboard charts and dark/light mode toggle
  - Implement reusable chart components (area, bar, pie, line) wrapping Recharts with consistent theming
  - Build dark mode / light mode toggle persisting preference in Zustand store and `localStorage`
  - Apply Tailwind `dark:` variants across all UI components for full dark mode support
  - _Requirements: 4_

- [~] 77. Implement Hindi language support (i18n) and global search
  - Set up `next-intl` with `en.json` and `hi.json` translation files covering all UI strings
  - Add a language switcher in the user settings dropdown; persist language preference per user
  - Build a global search bar querying students, staff, fees, and announcements across the tenant with debounced API calls
  - _Requirements: 4_

- [~] 78. Responsive layout testing and mobile navigation
  - Audit all pages for mobile responsiveness; fix layout issues on screens < 768px
  - Build a bottom navigation bar or hamburger drawer for mobile viewport sidebar replacement
  - Test critical flows (attendance marking, fee collection, marks entry) on mobile viewports
  - _Requirements: 4_


---

## Phase 8: Subscription + SaaS Features + Quality

- [~] 79. Build subscription plan management UI for Super Admin
  - Build Super Admin pages for subscription plan CRUD: plan list, create/edit form, activate/deactivate toggle
  - Display plan usage metrics: number of tenants on each plan, total MRR contribution
  - Implement Super Admin subscription override (`PATCH /super-admin/tenants/:id/subscription`) with audit log recording the actor and reason
  - _Requirements: 20_

- [~] 80. Implement trial period enforcement and read-only mode on expiry
  - Implement middleware checking subscription status on each API request: block write operations (HTTP 403) when status is `EXPIRED` or `CANCELLED`, allow reads
  - Display a prominent expiry banner in the frontend with days remaining and upgrade CTA when trial is within 7 days of expiry
  - Implement a daily cron job transitioning `TRIAL` subscriptions to `EXPIRED` when `trialEndsAt` passes
  - _Requirements: 20_

- [~] 81. Build billing cycle invoice generation and payment failure notifications
  - Implement invoice generation on each billing cycle renewal: create invoice record, attach PDF, send to School Owner
  - Implement payment failure notification sequence: retry notifications on day 1, day 3, and day 7 post-failure via BullMQ scheduled jobs
  - Build tenant billing history page accessible to School Owner
  - _Requirements: 20_

- [~] 82. Build self-service school onboarding flow
  - Build a public onboarding wizard: school registration form → plan selection → trial activation → provisioning trigger
  - On form submission, call `TenantProvisioningService` atomically; send welcome email with login credentials
  - Build success page with subdomain info, login link, and getting-started checklist
  - _Requirements: 1, 20_

- [~] 83. Build usage analytics per tenant
  - Implement usage tracking: student count, staff count, storage used (S3), API call count per tenant per day
  - Expose `GET /super-admin/tenants/:id/usage` for Super Admin and `GET /settings/usage` for School Owner self-service
  - Display usage vs. plan limits with progress bars in the tenant settings UI
  - _Requirements: 1, 20_

- [~] 84. Build BullMQ queue monitoring dashboard
  - Integrate BullMQ Board or a custom admin UI showing queue depths, active jobs, failed jobs, and retry counts per queue
  - Restrict queue monitoring UI to Super Admin role
  - Implement `POST /super-admin/queues/:queue/jobs/:id/retry` to manually retry a failed job
  - _Requirements: 1_

- [~] 85. AI readiness: analytics aggregation cron jobs and placeholder endpoints
  - Implement daily cron jobs aggregating key metrics into analytics summary tables (attendance rates, fee collection totals, exam averages) for fast reads
  - Implement placeholder REST endpoints `GET /analytics/predictions/enrollment` and `GET /analytics/forecasts/fee-collection` returning stub data
  - Document the expected ML model integration contract (input features, output shape) in a `ANALYTICS.md` file
  - _Requirements: 4_

- [~] 86. Production deployment guide and infrastructure hardening
  - Write `DEPLOYMENT.md` covering: SSL certificate setup, environment variable management, database backup strategy (pg_dump cron), MinIO replication, and monitoring setup (Prometheus + Grafana or equivalent)
  - Add Docker healthcheck directives to all service containers
  - Document rollback procedure and zero-downtime deployment steps using Docker Compose
  - _Requirements: 1, 2_

- [~] 87. Write unit tests for auth, RBAC, fee calculation, and payroll calculation
  - Write Jest unit tests for `AuthService`: login, refresh, lockout, 2FA, OTP expiry
  - Write unit tests for `RbacGuard`: permission match, permission mismatch, missing role
  - Write unit tests for fee late-fee calculation logic and payroll net salary calculation
  - Achieve ≥ 80% line coverage on tested modules
  - _Requirements: 2, 3, 8, 13_

- [~] 88. Write integration tests for key API flows
  - Write e2e integration tests (using Supertest + test database) for: full student admission flow, fee payment with mock webhook, and exam result publication with parent notification
  - Use a test tenant seeded in `beforeAll` and cleaned in `afterAll`
  - Run integration tests in the CI/CD pipeline as a separate job after unit tests pass
  - _Requirements: 5, 8, 9_

- [~] 89. API documentation review and Swagger finalization
  - Ensure all NestJS controllers have complete `@ApiTags`, `@ApiOperation`, `@ApiResponse`, and `@ApiBearerAuth` decorators
  - Verify Swagger UI is accessible at `/api/docs` in development and protected behind Super Admin auth in production
  - Export OpenAPI JSON spec as an artifact in the CI/CD pipeline and commit `openapi.json` to the repo
  - _Requirements: 1, 2, 3_
