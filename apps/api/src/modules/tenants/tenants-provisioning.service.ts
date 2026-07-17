import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

const BCRYPT_ROUNDS = 10;
const TRIAL_DAYS = 30;
const TEMP_PASSWORD_LENGTH = 12;

// Matches the PERMISSIONS map in seed.ts — keep in sync
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'School Owner': [
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
  'Principal': [
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
  'Vice Principal': [
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
  'Accountant': [
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
  'Teacher': [
    'students:read',
    'academic:read',
    'timetable:manage',
    'attendance:read', 'attendance:create', 'attendance:update',
    'exams:read', 'exams:create', 'exams:update',
    'exams:results:enter',
    'homework:read', 'homework:create', 'homework:manage', 'homework:evaluate',
    'staff:read',
    'leave:read', 'leave:apply',
    'communication:read', 'communication:send',
    'reports:read',
    'events:read', 'events:register',
    'documents:read', 'documents:upload',
  ],
  'Class Teacher': [
    'students:read',
    'academic:read',
    'timetable:manage',
    'attendance:read', 'attendance:create', 'attendance:update',
    'exams:read', 'exams:create', 'exams:update',
    'exams:results:enter',
    'homework:read', 'homework:create', 'homework:manage', 'homework:evaluate', 'homework:submit',
    'staff:read',
    'leave:read', 'leave:apply',
    'communication:read', 'communication:send',
    'reports:read',
    'events:read', 'events:register',
    'documents:read', 'documents:upload',
  ],
  'Librarian': [
    'students:read',
    'library:read', 'library:manage',
    'communication:read',
    'reports:read',
    'documents:read',
  ],
  'Transport Manager': [
    'students:read',
    'transport:read', 'transport:manage',
    'staff:read',
    'communication:read',
    'reports:read',
    'documents:read',
  ],
  'Hostel Warden': [
    'students:read',
    'hostel:read', 'hostel:manage',
    'staff:read',
    'communication:read',
    'reports:read',
    'documents:read',
  ],
  'Receptionist': [
    'students:read', 'students:create', 'students:update',
    'communication:read',
    'events:read',
    'documents:read', 'documents:upload',
  ],
  'Parent': [
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
  'Student': [
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

export interface ProvisionResult {
  tenant: {
    id: string;
    subdomain: string;
    name: string;
    status: string;
  };
  schoolOwnerEmail: string;
  tempPassword: string;
}

export interface ProvisionOptions {
  triggeredBy?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerPassword?: string;
}

@Injectable()
export class TenantsProvisioningService {
  private readonly logger = new Logger(TenantsProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async provision(
    dto: CreateTenantDto,
    options: ProvisionOptions = {},
  ): Promise<ProvisionResult> {
    // ── Idempotency check (before transaction) ───────────────────────────────
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });

    if (existing) {
      throw new ConflictException(
        `Subdomain "${dto.subdomain}" is already taken`,
      );
    }

    const tempPassword = options.ownerPassword ?? this.generateTempPassword();

    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const trialEndsAt = new Date(
        now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
      );

      // ── 1. Create Tenant ────────────────────────────────────────────────────
      const tenant = await tx.tenant.create({
        data: {
          subdomain: dto.subdomain,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
          status: 'TRIAL',
          trialEndsAt,
        },
      });

      // ── 2. Find Starter plan or use provided planId ─────────────────────────
      let planId = dto.planId;

      if (!planId) {
        const starterPlan = await tx.subscriptionPlan.findFirst({
          where: { name: 'Starter', isActive: true },
          select: { id: true },
        });
        planId = starterPlan?.id;
      }

      // ── 3. Create Subscription ──────────────────────────────────────────────
      if (planId) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId,
            status: 'TRIAL',
            startDate: now,
            trialStartDate: now,
            trialEndDate: trialEndsAt,
          },
        });
      }

      // ── 4. Seed 12 system roles ─────────────────────────────────────────────
      const createdRoles: Record<string, string> = {};

      for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: roleName,
            permissions,
            isSystem: true,
          },
        });
        createdRoles[roleName] = role.id;
      }

      // ── 5. Create default AcademicYear ──────────────────────────────────────
      const currentYear = now.getFullYear();
      const academicYearName = `${currentYear}-${String(currentYear + 1).slice(2)}`;

      await tx.academicYear.create({
        data: {
          tenantId: tenant.id,
          name: academicYearName,
          startDate: new Date(`${currentYear}-04-01`),
          endDate: new Date(`${currentYear + 1}-03-31`),
          isActive: true,
        },
      });

      // ── 6. Create School Owner User ─────────────────────────────────────────
      const ownerEmail =
        dto.email ?? `owner@${dto.subdomain}.school-erp.com`;
      const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
      const schoolOwnerRoleId = createdRoles['School Owner'];

      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: ownerEmail,
          passwordHash,
          firstName: options.ownerFirstName ?? 'School',
          lastName: options.ownerLastName ?? 'Owner',
          roleId: schoolOwnerRoleId,
          isActive: true,
          emailVerifiedAt: new Date(), // auto-verified for provisioned accounts
        },
      });

      // ── 7. Write AuditLog ───────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          action: 'tenant.provision',
          tenantId: tenant.id,
          userId: options.triggeredBy,
          entity: 'Tenant',
          entityId: tenant.id,
        },
      });

      return {
        tenant: {
          id: tenant.id,
          subdomain: tenant.subdomain,
          name: tenant.name,
          status: tenant.status,
        },
        schoolOwnerEmail: ownerEmail,
      };
    });

    this.logger.log(
      `Provisioned tenant "${dto.subdomain}" (id: ${result.tenant.id})`,
    );

    return {
      ...result,
      tempPassword,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private generateTempPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(TEMP_PASSWORD_LENGTH);
    return Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join('');
  }
}
