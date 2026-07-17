# Requirements Document

## Introduction

A production-ready, multi-tenant School Management ERP platform (SaaS) sold to multiple schools, providing complete source code and infrastructure ownership. The platform enables schools to manage all administrative and academic operations — from student admissions and attendance to fees, examinations, payroll, and communication — through a unified, role-based web application. Each school operates in an isolated tenant environment accessible via a unique subdomain, with custom branding and independent configuration.

The system is built on NestJS (backend), Next.js App Router (frontend), PostgreSQL with Prisma ORM, JWT-based RBAC authentication, BullMQ/Redis queues, AWS S3-compatible file storage, and is deployable via Docker Compose with CI/CD readiness.

---

## Glossary

- **Platform**: The entire SaaS School Management ERP system.
- **Tenant**: A single school instance operating in isolation within the Platform.
- **Super Admin**: Platform-level administrator managing all tenants, subscriptions, and platform health.
- **School Owner**: Tenant-level owner with full administrative access to their school's data.
- **Principal**: Senior academic administrator within a Tenant.
- **Vice Principal**: Deputy academic administrator within a Tenant.
- **Accountant**: Financial staff responsible for fees and payroll within a Tenant.
- **Teacher**: Academic staff member assigned to classes and subjects within a Tenant.
- **Class Teacher**: A Teacher additionally responsible for a specific class/section.
- **Librarian**: Staff managing the library within a Tenant.
- **Transport Manager**: Staff managing vehicles and routes within a Tenant.
- **Hostel Warden**: Staff managing hostel rooms and students within a Tenant.
- **Receptionist**: Front-desk staff managing enquiries and visitors within a Tenant.
- **Parent**: Guardian of one or more Students within a Tenant.
- **Student**: Enrolled learner within a Tenant.
- **RBAC**: Role-Based Access Control — the permission system governing all actions.
- **Academic Year**: A defined annual period (e.g., 2024–25) for academic activities.
- **Session**: An Academic Year instance within a Tenant.
- **Subdomain**: A unique DNS prefix (e.g., `school1.app.com`) assigned to each Tenant.
- **Tenant_ID**: A unique identifier attached to every database record to enforce data isolation.
- **JWT**: JSON Web Token used for stateless authentication.
- **Refresh Token**: A long-lived token used to renew expired JWTs.
- **OTP**: One-Time Password used for identity verification.
- **2FA**: Two-Factor Authentication providing an additional security layer.
- **BullMQ**: A Redis-backed job queue used for asynchronous processing.
- **S3_Storage**: AWS S3-compatible object storage for documents and files.
- **Audit_Log**: An immutable record of user actions for compliance and security.
- **Soft_Delete**: Marking a record as deleted without physical removal from the database.
- **Fee_Structure**: A configured set of fee categories and amounts applicable to a class/session.
- **Payslip**: A generated document summarising an employee's monthly salary and deductions.
- **Report_Card**: A generated document summarising a Student's examination performance.
- **Timetable**: A structured schedule assigning Teachers and subjects to periods per class/section.
- **API_Gateway**: The NestJS application serving versioned REST APIs with Swagger documentation.
- **Queue_Worker**: A BullMQ worker process handling asynchronous jobs (notifications, exports, etc.).
- **Subscription_Plan**: A SaaS pricing tier defining feature access, student limits, and billing cycle.
- **Trial_Period**: A free evaluation window granted to a new Tenant before billing begins.

---

## Requirements

### Requirement 1: Multi-Tenant Architecture & Data Isolation

**User Story:** As a Super Admin, I want each school to operate in a completely isolated environment with its own subdomain and branding, so that tenant data never leaks across schools and each school has a personalised experience.

#### Acceptance Criteria

1. THE Platform SHALL assign a unique Subdomain to each Tenant upon onboarding.
2. WHEN a request arrives, THE API_Gateway SHALL resolve the Tenant_ID from the Subdomain before processing any business logic.
3. THE Platform SHALL enforce Tenant_ID on every database query so that no query returns records belonging to a different Tenant.
4. WHEN a Tenant is created, THE Platform SHALL provision default roles, permissions, and a default School Owner account for that Tenant.
5. IF a request is made without a resolvable Tenant_ID, THEN THE API_Gateway SHALL return an HTTP 404 response.
6. THE Platform SHALL store per-Tenant branding configuration including logo URL, primary colour, secondary colour, and school name.
7. WHEN a user accesses a Subdomain, THE Frontend SHALL render the Tenant's branding including logo and theme colours.
8. THE Platform SHALL support soft deletion of Tenants without removing historical data.
9. FOR ALL database tables containing tenant-specific data, THE Platform SHALL include a non-nullable tenant_id column indexed for query performance.
10. THE Platform SHALL ensure that a Super Admin can access any Tenant's data through an explicit impersonation mechanism with a recorded Audit_Log entry.

---

### Requirement 2: Authentication & Security

**User Story:** As a user of any role, I want to securely log in and manage my session, so that my account and school data are protected from unauthorised access.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE Authentication_Service SHALL return a signed JWT and a Refresh Token.
2. WHEN a JWT expires, THE Authentication_Service SHALL issue a new JWT upon receiving a valid Refresh Token.
3. WHEN a user logs out, THE Authentication_Service SHALL invalidate the associated Refresh Token.
4. WHEN a user requests a password reset, THE Authentication_Service SHALL send a time-limited OTP to the registered email address within 60 seconds.
5. IF an OTP is submitted after its expiry window of 10 minutes, THEN THE Authentication_Service SHALL reject it and return an appropriate error message.
6. WHERE 2FA is enabled for an account, THE Authentication_Service SHALL require a valid TOTP code after password verification before issuing a JWT.
7. THE Authentication_Service SHALL record every login attempt, logout, and token refresh as an Audit_Log entry including IP address, user agent, and timestamp.
8. WHEN a user exceeds 5 consecutive failed login attempts within 15 minutes, THE Authentication_Service SHALL lock the account and send an unlock email.
9. THE Platform SHALL enforce password policies: minimum 8 characters, at least one uppercase letter, one digit, and one special character.
10. WHERE IP restriction is configured for a Tenant, THE API_Gateway SHALL reject requests from IP addresses outside the allowed list with an HTTP 403 response.
11. THE Authentication_Service SHALL support device management, allowing users to view and revoke active sessions per device.
12. WHEN a new device logs in, THE Authentication_Service SHALL send an email notification to the account owner.
13. THE Platform SHALL support OTP-based login as an alternative to password-based login.
14. THE Platform SHALL support email verification for newly created accounts before first login is permitted.

---

### Requirement 3: Role-Based Access Control (RBAC)

**User Story:** As a School Owner, I want to assign granular permissions to roles and individual users, so that each staff member can only access the features relevant to their responsibilities.

#### Acceptance Criteria

1. THE Platform SHALL define the following built-in roles: Super Admin, School Owner, Principal, Vice Principal, Accountant, Teacher, Class Teacher, Librarian, Transport Manager, Hostel Warden, Receptionist, Parent, Student.
2. THE Platform SHALL allow School Owners to create custom roles with any combination of permissions within their Tenant.
3. WHEN a user attempts an action, THE API_Gateway SHALL verify the user's role permissions before executing the action.
4. IF a user lacks the required permission, THEN THE API_Gateway SHALL return an HTTP 403 response.
5. THE Platform SHALL render navigation menus based on the authenticated user's resolved permission set.
6. THE Platform SHALL support permission inheritance where a higher role automatically includes all permissions of lower roles in a defined hierarchy.
7. WHEN permissions are updated for a role, THE Platform SHALL apply the changes to all users assigned that role without requiring re-login.
8. THE Platform SHALL provide an audit trail of all permission changes including the actor, target role, permission changed, and timestamp.

---

### Requirement 4: Role-Specific Dashboards

**User Story:** As a logged-in user, I want to see a dashboard tailored to my role with the most relevant KPIs and quick actions, so that I can efficiently manage my daily responsibilities.

#### Acceptance Criteria

1. WHEN a Super Admin logs in, THE Dashboard SHALL display total active Tenants, total revenue, subscription renewals due, system health status, and recent Audit_Log entries.
2. WHEN a Principal logs in, THE Dashboard SHALL display today's attendance percentage, pending approvals, upcoming exams, fee collection summary, and recent announcements.
3. WHEN a Teacher logs in, THE Dashboard SHALL display assigned classes for the day, pending homework evaluations, attendance marked status, and recent messages.
4. WHEN an Accountant logs in, THE Dashboard SHALL display today's fee collections, pending dues, overdue fee alerts, and payroll processing status.
5. WHEN a Parent logs in, THE Dashboard SHALL display their child's attendance, recent exam results, pending fees, and school announcements.
6. WHEN a Student logs in, THE Dashboard SHALL display today's timetable, pending assignments, attendance summary, and recent results.
7. THE Dashboard SHALL refresh data without a full page reload at intervals configurable per Tenant (default: 5 minutes).
8. THE Dashboard SHALL support dark mode and light mode, persisting the user's preference in local storage.


---

### Requirement 5: Student Management

**User Story:** As a Receptionist or Principal, I want to manage the complete lifecycle of a student from enquiry to alumni, so that all student information is centralised and accessible.

#### Acceptance Criteria

1. THE Student_Management_Module SHALL support a multi-step admission workflow: Enquiry → Registration → Document Verification → Admission Confirmation.
2. WHEN a student is admitted, THE Student_Management_Module SHALL auto-generate a unique roll number following the Tenant-configured format.
3. THE Student_Management_Module SHALL store student profiles including personal details, photograph, medical information, and parent/guardian information.
4. THE Student_Management_Module SHALL support bulk import of student records via CSV with field mapping and validation error reporting.
5. WHEN a bulk import is triggered, THE Queue_Worker SHALL process the import asynchronously and notify the initiating user upon completion.
6. THE Student_Management_Module SHALL generate printable ID cards with the student's photograph, name, class, roll number, and QR code.
7. THE Student_Management_Module SHALL support issuance of Transfer Certificates with a unique certificate number and issue date.
8. WHEN a student is promoted at the end of an Academic Year, THE Student_Management_Module SHALL record the promotion history with source class, target class, and Academic Year.
9. THE Student_Management_Module SHALL support scholarship and discount records linked to individual students.
10. THE Student_Management_Module SHALL support alumni records for students who have left the school, retaining their historical data.
11. THE Student_Management_Module SHALL support bulk export of student records as CSV or Excel files.
12. THE Student_Management_Module SHALL support document uploads (birth certificate, previous marksheet, etc.) stored in S3_Storage with access control.
13. IF a required document is missing during admission, THEN THE Student_Management_Module SHALL flag the admission as incomplete and prevent confirmation.

---

### Requirement 6: Class & Academic Management

**User Story:** As a Principal, I want to configure academic years, classes, sections, subjects, and timetables, so that the school's academic structure is accurately represented in the system.

#### Acceptance Criteria

1. THE Academic_Management_Module SHALL support creation and management of Academic Years with start date, end date, and active/inactive status.
2. THE Academic_Management_Module SHALL support creation of Classes (e.g., Grade 1) and Sections (e.g., A, B) within an Academic Year.
3. THE Academic_Management_Module SHALL support subject creation with subject code, type (core/elective), and assignment to classes.
4. THE Academic_Management_Module SHALL generate a Timetable for each class/section assigning Teachers, subjects, and periods to time slots across weekdays.
5. WHEN a Timetable is generated, THE Academic_Management_Module SHALL detect and prevent scheduling conflicts (same Teacher in two classes at the same time).
6. THE Academic_Management_Module SHALL define an academic calendar including working days, holidays, and events.
7. THE Academic_Management_Module SHALL support elective subject groups where Students choose one subject from a defined set.
8. WHEN an Academic Year is closed, THE Academic_Management_Module SHALL archive all associated Timetables, attendance records, and exam results while retaining read access.
9. THE Academic_Management_Module SHALL support configuring the number of periods per day and period duration per Tenant.

---

### Requirement 7: Attendance Management

**User Story:** As a Teacher or Class Teacher, I want to record and review student and staff attendance quickly, so that attendance data is always up to date and parents are notified promptly.

#### Acceptance Criteria

1. THE Attendance_Module SHALL support daily attendance marking for Students per class/section/period.
2. THE Attendance_Module SHALL support bulk attendance marking for an entire class in a single action.
3. WHEN attendance is marked as absent for a Student, THE Queue_Worker SHALL dispatch a notification to the Student's Parent via SMS, WhatsApp, or email based on Tenant notification settings.
4. THE Attendance_Module SHALL support QR code-based attendance where a Student's QR scan marks attendance.
5. THE Attendance_Module SHALL generate monthly attendance reports per Student, per class, and per subject.
6. THE Attendance_Module SHALL track Teacher attendance with check-in and check-out timestamps.
7. WHILE a Teacher's leave request is approved, THE Attendance_Module SHALL mark the Teacher's attendance as "On Leave" for the leave duration automatically.
8. THE Attendance_Module SHALL be architecturally prepared for RFID and biometric device integration via a pluggable interface.
9. IF attendance is attempted for a date that is a configured holiday, THEN THE Attendance_Module SHALL warn the user and require explicit confirmation to proceed.
10. THE Attendance_Module SHALL calculate and display attendance percentage per Student for any selected date range.

---

### Requirement 8: Fees Management

**User Story:** As an Accountant, I want to configure fee structures, collect payments, issue receipts, and track defaulters, so that the school's finances are managed accurately and transparently.

#### Acceptance Criteria

1. THE Fee_Management_Module SHALL support creation of Fee_Structures with categories including tuition, transport, hostel, library, and late fees, assignable per class and Session.
2. THE Fee_Management_Module SHALL support scholarships and discounts as percentage or fixed-amount reductions applied to individual students or entire classes.
3. THE Fee_Management_Module SHALL support fee collection via Razorpay, Stripe, Cash, UPI, and bank transfer payment methods.
4. WHEN a fee payment is recorded, THE Fee_Management_Module SHALL generate a GST-compliant receipt with a unique receipt number, student details, amount, payment method, and date.
5. THE Fee_Management_Module SHALL calculate and apply late fees automatically for overdue payments based on the configured late fee policy.
6. THE Fee_Management_Module SHALL send automated fee reminders via WhatsApp, SMS, and email to Parents of Students with pending dues based on a configurable reminder schedule.
7. THE Fee_Management_Module SHALL support full and partial refunds with a refund reason, recorded in the ledger.
8. THE Fee_Management_Module SHALL generate a defaulters report listing Students with overdue fees, overdue amount, and days overdue.
9. THE Fee_Management_Module SHALL maintain a ledger with all financial transactions for audit purposes.
10. WHEN a payment gateway transaction is initiated, THE Fee_Management_Module SHALL record the transaction reference and verify the webhook confirmation before marking the fee as paid.
11. IF a payment gateway webhook is not received within 30 minutes of initiation, THEN THE Fee_Management_Module SHALL mark the transaction as pending and alert the Accountant.
12. THE Fee_Management_Module SHALL export financial reports as PDF, Excel, and CSV.


---

### Requirement 9: Examination Management

**User Story:** As a Principal or Teacher, I want to schedule exams, record marks, generate grade reports, and publish results, so that academic performance is tracked and communicated accurately.

#### Acceptance Criteria

1. THE Exam_Module SHALL support creation of exam types: unit test, mid-term, final, and custom exams, each with configurable maximum marks and passing criteria.
2. THE Exam_Module SHALL support exam scheduling with date, time, duration, class, section, and subject.
3. WHEN marks are entered by a Teacher, THE Exam_Module SHALL calculate the grade and GPA based on the Tenant-configured grading scale.
4. THE Exam_Module SHALL generate printable Report Cards per Student per exam, including subject-wise marks, grades, attendance percentage, and teacher remarks.
5. THE Exam_Module SHALL perform subject-wise and class-wise performance analysis displayed as charts.
6. WHEN results are published by a Principal, THE Queue_Worker SHALL notify all Parents of their child's result summary via SMS, WhatsApp, or email.
7. THE Exam_Module SHALL enforce a promotion logic rule: Students meeting the configured pass criteria advance to the next class; those who do not are retained, with the outcome recorded in promotion history.
8. IF marks entered exceed the configured maximum marks for a subject, THEN THE Exam_Module SHALL reject the entry and display a validation error.
9. THE Exam_Module SHALL support co-scholastic assessments (sports, arts, behaviour) separately from academic marks.
10. THE Exam_Module SHALL allow marks entry in bulk via CSV upload with validation and error reporting.

---

### Requirement 10: Homework & Assignments

**User Story:** As a Teacher, I want to create and evaluate homework assignments, so that students complete work on time and parents can monitor their child's progress.

#### Acceptance Criteria

1. THE Homework_Module SHALL allow Teachers to create assignments with title, description, due date, class, section, subject, and optional file attachments stored in S3_Storage.
2. THE Homework_Module SHALL allow Students to submit assignments with text responses and file attachments before the due date.
3. WHEN a new assignment is created, THE Queue_Worker SHALL notify the relevant Students and their Parents.
4. THE Homework_Module SHALL allow Teachers to evaluate submissions with marks and written feedback.
5. WHEN an assignment due date passes, THE Homework_Module SHALL mark non-submitted assignments as overdue.
6. THE Homework_Module SHALL provide Parents with a read-only view of their child's assignments, submission status, and teacher feedback.
7. IF a Student submits after the due date, THEN THE Homework_Module SHALL flag the submission as late.

---

### Requirement 11: Communication Module

**User Story:** As a Principal or Teacher, I want to send targeted announcements, messages, and notifications to staff, students, and parents, so that everyone is informed in a timely and organised manner.

#### Acceptance Criteria

1. THE Communication_Module SHALL support internal messaging between any two users within a Tenant.
2. THE Communication_Module SHALL support announcements broadcast to defined recipient groups (all staff, all parents, specific class).
3. THE Communication_Module SHALL support creation and distribution of circulars and notices with attached PDF documents.
4. WHEN a message or announcement is sent, THE Queue_Worker SHALL deliver it via SMS, WhatsApp, and email based on the recipient's notification preferences and Tenant settings.
5. THE Communication_Module SHALL maintain a notification inbox for each user displaying read and unread notifications.
6. THE Communication_Module SHALL support event creation with date, time, venue, description, and RSVP tracking.
7. THE Communication_Module SHALL integrate with a calendar view showing all school events, exam schedules, and holidays.
8. THE Communication_Module SHALL provide a parent-teacher communication channel where Parents can initiate messages to their child's Teachers and receive replies.
9. IF a notification delivery fails via one channel, THEN THE Queue_Worker SHALL retry delivery up to 3 times before marking it as failed and logging the failure.

---

### Requirement 12: Staff Management

**User Story:** As a Principal, I want to manage teacher and non-teaching staff profiles, attendance, leaves, and performance, so that HR operations are handled within the platform.

#### Acceptance Criteria

1. THE Staff_Management_Module SHALL store staff profiles including personal details, designation, department, qualification, joining date, and employment documents.
2. THE Staff_Management_Module SHALL support departments and designations configurable per Tenant.
3. THE Staff_Management_Module SHALL track staff attendance with daily check-in and check-out, integrated with the leave module.
4. THE Staff_Management_Module SHALL support performance evaluation records per staff member per Academic Year.
5. THE Staff_Management_Module SHALL support document uploads for staff (certificates, contracts, ID proof) stored in S3_Storage.
6. THE Staff_Management_Module SHALL support bulk import of staff records via CSV.
7. WHEN a staff member is deactivated, THE Staff_Management_Module SHALL preserve all historical records and revoke system access.

---

### Requirement 13: Payroll Management

**User Story:** As an Accountant, I want to generate monthly payslips with accurate calculations for salary, deductions, and bonuses, so that staff are paid correctly and compliance records are maintained.

#### Acceptance Criteria

1. THE Payroll_Module SHALL support salary structure configuration with basic pay, allowances (HRA, TA, DA), and deductions (PF, ESI, TDS, other) per designation or individual staff.
2. WHEN payroll is generated for a month, THE Payroll_Module SHALL calculate net salary based on attendance, approved leaves, and salary structure.
3. THE Payroll_Module SHALL generate printable Payslips per staff member per month in PDF format.
4. THE Payroll_Module SHALL support one-time bonuses and deductions added to a specific month's payroll.
5. THE Payroll_Module SHALL generate payroll reports summarising total salary disbursement, deductions, and net payments per month.
6. THE Payroll_Module SHALL support bank transfer export in a format compatible with major Indian banks (NEFT/RTGS file format).
7. IF payroll has already been finalised for a month, THEN THE Payroll_Module SHALL require an explicit revision action before any changes are permitted, recording the revision in the Audit_Log.


---

### Requirement 14: Leave Management

**User Story:** As a staff member, I want to apply for leave and track my leave balance, and as a manager, I want to approve or reject leave requests with a formal workflow, so that leave is managed fairly and consistently.

#### Acceptance Criteria

1. THE Leave_Module SHALL define leave types per Tenant (casual, sick, earned, maternity, etc.) with configurable annual balances.
2. THE Leave_Module SHALL allow staff to apply for leave specifying type, start date, end date, reason, and supporting documents.
3. WHEN a leave application is submitted, THE Queue_Worker SHALL notify the designated approver.
4. THE Leave_Module SHALL support a multi-level approval workflow configurable per Tenant (e.g., Class Teacher → Principal).
5. WHEN a leave request is approved or rejected, THE Queue_Worker SHALL notify the applicant.
6. THE Leave_Module SHALL deduct approved leave days from the applicant's leave balance.
7. THE Leave_Module SHALL generate leave reports per staff member showing taken, remaining, and lapsed leave per type per Academic Year.
8. IF a staff member applies for leave exceeding their available balance, THEN THE Leave_Module SHALL warn the applicant and require explicit confirmation to proceed with a leave-without-pay application.

---

### Requirement 15: Library Management

**User Story:** As a Librarian, I want to manage the book inventory, issue and return books, track fines, and provide borrowing history, so that the library runs efficiently.

#### Acceptance Criteria

1. THE Library_Module SHALL support book catalogue management with ISBN, title, author, publisher, category, and quantity.
2. THE Library_Module SHALL issue books to Students or Staff with a due date calculated from the configured loan period.
3. WHEN a book is returned, THE Library_Module SHALL calculate fine amounts for overdue returns based on the Tenant-configured fine rate per day.
4. THE Library_Module SHALL support QR code scanning for book issue and return operations.
5. THE Library_Module SHALL display borrowing history per Student, per Staff, and per book.
6. THE Library_Module SHALL generate reports on overdue books, fine collections, and most-borrowed books.
7. THE Library_Module SHALL be architecturally prepared for digital library (e-book) integration via a pluggable interface.
8. IF a book is reported lost, THEN THE Library_Module SHALL record a replacement charge and update the inventory count.

---

### Requirement 16: Transport Management

**User Story:** As a Transport Manager, I want to manage buses, routes, pickup points, and student assignments, so that student transport is organised and fees are accurately billed.

#### Acceptance Criteria

1. THE Transport_Module SHALL support vehicle records including registration number, type, capacity, driver, and insurance details.
2. THE Transport_Module SHALL support route definitions with named stops and assigned pickup/drop times.
3. THE Transport_Module SHALL assign Students to specific routes and stops, generating transport fee entries in the Fee_Management_Module.
4. THE Transport_Module SHALL support driver profiles with licence details and contact information.
5. THE Transport_Module SHALL be architecturally prepared for GPS tracking integration via a pluggable interface.
6. THE Transport_Module SHALL generate reports on vehicle utilisation and student transport assignments.
7. WHEN a Student is assigned to a route, THE Transport_Module SHALL validate that the vehicle capacity is not exceeded and warn the Transport Manager if assignment would exceed capacity.

---

### Requirement 17: Hostel Management

**User Story:** As a Hostel Warden, I want to manage rooms, bed allocations, hostel fees, and visitor records, so that hostel operations are tracked and safe.

#### Acceptance Criteria

1. THE Hostel_Module SHALL support hostel building, room, and bed records with capacity and occupancy tracking.
2. THE Hostel_Module SHALL allocate Students to specific beds with admission date, expected departure date, and meal plan.
3. THE Hostel_Module SHALL generate hostel fee entries in the Fee_Management_Module based on the configured hostel fee structure.
4. THE Hostel_Module SHALL support visitor registration with visitor name, purpose, entry time, exit time, and the Student being visited.
5. THE Hostel_Module SHALL provide a Warden dashboard showing current occupancy, pending fee dues, and recent visitor entries.
6. THE Hostel_Module SHALL support mess management with daily meal records and meal cost tracking.
7. IF a room's allocated beds reach capacity, THEN THE Hostel_Module SHALL prevent further allocation and display an error message.

---

### Requirement 18: Inventory Management

**User Story:** As a Principal or Accountant, I want to track school assets, purchase orders, and maintenance schedules, so that asset utilisation and procurement are managed efficiently.

#### Acceptance Criteria

1. THE Inventory_Module SHALL support asset records with name, category (computers, furniture, lab equipment, stationery), quantity, purchase date, purchase price, and vendor.
2. THE Inventory_Module SHALL support purchase order creation with vendor details, items, quantities, and expected delivery date.
3. THE Inventory_Module SHALL update asset inventory upon purchase order receipt confirmation.
4. THE Inventory_Module SHALL schedule and track maintenance records for assets with due dates and completion status.
5. THE Inventory_Module SHALL generate reports on asset valuation, maintenance schedules, and procurement history.
6. IF an asset quantity falls below the configured minimum stock level, THEN THE Inventory_Module SHALL alert the designated staff member.


---

### Requirement 19: Event Management

**User Story:** As a Principal or Teacher, I want to create and manage school events, register participants, and display them on the school calendar, so that all stakeholders are informed and events run smoothly.

#### Acceptance Criteria

1. THE Event_Module SHALL support event creation with title, description, date, time, venue, event type (academic, sports, cultural, holiday), and organiser.
2. THE Event_Module SHALL display all events on a shared school calendar visible to all users within the Tenant.
3. THE Event_Module SHALL support event registration where Students or Staff can sign up for participation in optional events.
4. WHEN an event is created or updated, THE Queue_Worker SHALL send a notification to all relevant users based on the target audience configuration.
5. THE Event_Module SHALL sync event dates with the academic calendar managed in the Academic_Management_Module.
6. THE Event_Module SHALL support marking of public holidays which are reflected in the Timetable and Attendance_Module.

---

### Requirement 20: Document Management

**User Story:** As an Administrator, I want to upload, organise, version, and securely share student and staff documents, so that all important records are accessible and protected.

#### Acceptance Criteria

1. THE Document_Module SHALL support document uploads for Students and Staff stored in S3_Storage with Tenant-scoped access control.
2. THE Document_Module SHALL support document categories including ID proof, certificates, marksheets, transfer certificates, and fee receipts.
3. THE Document_Module SHALL maintain version history for documents, storing each uploaded version with upload date and uploader identity.
4. WHEN a document is requested for download, THE Document_Module SHALL generate a time-limited pre-signed URL from S3_Storage valid for 15 minutes.
5. THE Document_Module SHALL enforce role-based access so that Parents can only download their child's documents.
6. THE Document_Module SHALL support generation of system-produced documents (ID cards, Report Cards, Payslips, fee receipts) as downloadable PDFs.

---

### Requirement 21: Reports & Analytics

**User Story:** As a Principal, Accountant, or Super Admin, I want to generate comprehensive reports across all modules and export them in multiple formats, so that data-driven decisions can be made.

#### Acceptance Criteria

1. THE Reports_Module SHALL generate attendance reports by Student, class, date range, and subject with percentage calculations.
2. THE Reports_Module SHALL generate fee reports including daily collections, outstanding dues, defaulters, and category-wise breakdowns.
3. THE Reports_Module SHALL generate examination performance reports by class, subject, and individual Student across multiple exam types.
4. THE Reports_Module SHALL generate payroll reports by month, department, and individual staff member.
5. THE Reports_Module SHALL generate library reports on issue/return activity, fines, and overdue books.
6. THE Reports_Module SHALL generate transport and hostel utilisation reports.
7. THE Reports_Module SHALL export all reports as PDF, Excel, and CSV formats.
8. WHEN a large report export is requested (over 1,000 records), THE Queue_Worker SHALL generate the file asynchronously and notify the user with a download link upon completion.
9. THE Reports_Module SHALL provide a custom dashboard builder where authorised users can pin report widgets to their dashboard.
10. THE Reports_Module SHALL provide a Super Admin analytics view with cross-tenant aggregated metrics including total revenue, active tenants, and subscription statuses.

---

### Requirement 22: Settings Module

**User Story:** As a School Owner or Principal, I want to configure school-specific settings including branding, academic configuration, notification preferences, and payment gateways, so that the platform reflects our school's identity and operational requirements.

#### Acceptance Criteria

1. THE Settings_Module SHALL allow configuration of school name, logo, address, contact details, and social media links per Tenant.
2. THE Settings_Module SHALL allow configuration of the current Academic Year and Session per Tenant.
3. THE Settings_Module SHALL allow configuration of SMS, WhatsApp, and email gateway credentials per Tenant.
4. THE Settings_Module SHALL allow configuration of payment gateway (Razorpay, Stripe) credentials per Tenant.
5. THE Settings_Module SHALL allow configuration of the school's primary and secondary theme colours per Tenant.
6. THE Settings_Module SHALL allow management of custom roles and permissions per Tenant.
7. THE Settings_Module SHALL allow configuration of the password policy parameters per Tenant within platform-enforced minimum standards.
8. THE Settings_Module SHALL allow configuration of fee categories, late fee policies, and grading scales per Tenant.
9. WHEN any setting is changed, THE Settings_Module SHALL record the change in the Audit_Log with the actor's identity and the previous value.

---

### Requirement 23: Subscription & Billing (SaaS)

**User Story:** As a Super Admin, I want to manage school subscriptions, billing cycles, trial periods, and invoices, so that the SaaS platform generates revenue and schools are billed accurately.

#### Acceptance Criteria

1. THE Subscription_Module SHALL support Subscription_Plan definitions with name, price, billing cycle (monthly/annual), student limit, and feature access flags.
2. WHEN a new school is onboarded, THE Subscription_Module SHALL assign a Trial_Period of configurable duration (default: 30 days) before requiring an active subscription.
3. WHEN a Trial_Period expires without an active subscription, THE Subscription_Module SHALL restrict Tenant access to read-only mode and notify the School Owner.
4. THE Subscription_Module SHALL generate invoices automatically at each billing cycle renewal.
5. WHEN a subscription payment is received, THE Subscription_Module SHALL extend the subscription period and update the Tenant status to active.
6. IF a subscription payment fails, THEN THE Subscription_Module SHALL send payment failure notifications to the School Owner on day 1, day 3, and day 7 before suspending access.
7. THE Subscription_Module SHALL track usage analytics per Tenant including active student count, storage used, and API call volume.
8. THE Super Admin SHALL be able to manually override a Tenant's subscription status and expiry date with an Audit_Log entry.
9. THE Subscription_Module SHALL provide a school self-service onboarding flow where a School Owner can register their school, choose a plan, and begin the Trial_Period without Super Admin intervention.


---

### Requirement 24: API Design & Documentation

**User Story:** As a developer or integrating third party, I want well-documented, versioned APIs with consistent error handling, so that integrations are reliable and maintainable.

#### Acceptance Criteria

1. THE API_Gateway SHALL prefix all routes with a version identifier (e.g., `/api/v1/`).
2. THE API_Gateway SHALL serve a Swagger UI documentation page listing all endpoints, request/response schemas, and authentication requirements.
3. THE API_Gateway SHALL return consistent error response objects with a status code, error code, and human-readable message in English and Hindi.
4. THE API_Gateway SHALL enforce request rate limiting at 1,000 requests per minute per authenticated user and 100 requests per minute per unauthenticated IP.
5. THE API_Gateway SHALL validate all incoming request payloads using DTO schemas and return HTTP 400 with field-level validation errors for invalid inputs.
6. THE API_Gateway SHALL include CORS configuration restricting origins to Tenant Subdomains and the Super Admin domain.

---

### Requirement 25: Queue & Asynchronous Processing

**User Story:** As a system operator, I want all long-running operations such as notifications, report generation, and bulk imports to be processed asynchronously, so that API response times remain fast and the system is resilient to spikes.

#### Acceptance Criteria

1. THE Queue_Worker SHALL process all outbound notification jobs (SMS, WhatsApp, email) asynchronously via BullMQ queues backed by Redis.
2. THE Queue_Worker SHALL process all bulk import and export jobs asynchronously with progress tracking accessible via the UI.
3. THE Queue_Worker SHALL implement retry logic with exponential backoff for failed jobs, with a maximum of 3 retry attempts.
4. WHEN all retry attempts are exhausted for a job, THE Queue_Worker SHALL move the job to a dead-letter queue and create an alert visible to the Super Admin.
5. THE Queue_Worker SHALL provide a job monitoring dashboard accessible to Super Admin showing queue depths, processing rates, and failed job counts.

---

### Requirement 26: File Storage

**User Story:** As any user uploading a file, I want files to be stored securely and served reliably, so that documents, photographs, and exports are always accessible and protected.

#### Acceptance Criteria

1. THE Platform SHALL store all uploaded files in S3_Storage using Tenant-scoped path prefixes to enforce data isolation.
2. THE Platform SHALL validate file types and sizes before upload, rejecting files exceeding 20 MB or of disallowed MIME types.
3. WHEN a file download is requested, THE Platform SHALL generate a pre-signed URL valid for 15 minutes rather than serving the file directly.
4. THE Platform SHALL support both AWS S3 and MinIO-compatible storage endpoints, configurable via environment variables.
5. THE Platform SHALL scan uploaded files for malicious content using an integrated antivirus check before storing them.

---

### Requirement 27: Multi-Language Support

**User Story:** As a non-English-speaking user, I want to use the platform in Hindi, so that the system is accessible to staff and parents who are more comfortable in Hindi.

#### Acceptance Criteria

1. THE Frontend SHALL support English and Hindi as selectable interface languages, with the selection persisted per user account.
2. THE Frontend SHALL load language strings from localisation resource files without hard-coding UI text.
3. WHEN a user changes the interface language, THE Frontend SHALL apply the new language immediately without requiring a page reload.
4. THE API_Gateway SHALL return validation error messages in the user's configured language where translations are available, defaulting to English.

---

### Requirement 28: Responsive Design & Accessibility

**User Story:** As a user on any device, I want the platform to be fully usable on desktop, tablet, and mobile screens, so that I can manage school operations from any device.

#### Acceptance Criteria

1. THE Frontend SHALL render correctly and be fully functional on screen widths of 320px (mobile), 768px (tablet), and 1280px (desktop) and above.
2. THE Frontend SHALL use large interactive elements (minimum 44×44px touch targets) to support touch-based navigation on tablets and mobile devices.
3. THE Frontend SHALL implement keyboard shortcuts for common actions (e.g., global search, navigation) documented in an in-app help panel.
4. THE Frontend SHALL provide a global search bar accessible from all screens, searching across students, staff, fees, and announcements within the authenticated Tenant.
5. THE Frontend SHALL include a notification centre icon in the navigation bar displaying unread notification count and a dropdown list of recent notifications.
6. THE Frontend SHALL comply with WCAG 2.1 AA contrast and labelling requirements for all interactive elements.

---

### Requirement 29: DevOps & Deployment

**User Story:** As a system operator or developer, I want a fully containerised, CI/CD-ready deployment setup, so that the platform can be deployed, scaled, and maintained reliably in production.

#### Acceptance Criteria

1. THE Platform SHALL provide Docker images for the API_Gateway, Frontend, Queue_Worker, and database migration services.
2. THE Platform SHALL provide a Docker Compose configuration for local development and single-server production deployment including all dependencies (PostgreSQL, Redis, MinIO).
3. THE Platform SHALL provide environment variable templates (`.env.example`) for all configurable values.
4. THE Platform SHALL provide a CI/CD pipeline configuration (GitHub Actions) that runs linting, unit tests, and integration tests on every pull request.
5. THE Platform SHALL provide database migration scripts managed by Prisma Migrate, executable as part of the deployment process.
6. THE Platform SHALL provide health check endpoints at `/health` returning service status, database connectivity, and queue connectivity.
7. THE Platform SHALL emit structured JSON logs via Winston/Pino with log levels configurable via environment variables.
8. THE Platform SHALL provide a production deployment guide documenting environment setup, SSL configuration, and backup procedures.

---

### Requirement 30: AI-Ready Architecture

**User Story:** As a Super Admin or school administrator, I want the platform to be designed with AI feature integration in mind, so that intelligent features such as performance predictions and smart notifications can be added in a future phase without architectural rework.

#### Acceptance Criteria

1. THE Platform SHALL expose internal data events via a structured event bus (NestJS EventEmitter or BullMQ events) that an AI service can subscribe to without modifying existing modules.
2. THE Platform SHALL store aggregated statistics for attendance, fee collection, and exam performance in a separate analytics schema designed for time-series queries.
3. THE Platform SHALL provide placeholder API endpoints for AI features (performance prediction, fee forecast, smart notifications) returning a "coming soon" response in Phase 1 through Phase 7.
4. THE Platform SHALL be architecturally documented with an AI integration guide describing the event schema, data access patterns, and recommended model interfaces.

