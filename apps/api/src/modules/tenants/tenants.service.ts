import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { QueryTenantsDto } from './dto/query-tenants.dto';

const IMPERSONATION_EXPIRES_IN = 3600; // 1 hour in seconds

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── Find All ─────────────────────────────────────────────────────────────────

  async findAll(query: QueryTenantsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null };

    if (query.search) {
      where['OR'] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { subdomain: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where['status'] = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        include: {
          subscription: {
            include: { plan: { select: { id: true, name: true, price: true, billingCycle: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Find One ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }

    return tenant;
  }

  // ─── Suspend ──────────────────────────────────────────────────────────────────

  async suspend(id: string, userId: string) {
    const tenant = await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    await this.auditLog.log({
      tenantId: id,
      userId,
      action: 'tenant.suspend',
      entity: 'Tenant',
      entityId: id,
      oldValues: { status: tenant.status },
      newValues: { status: 'SUSPENDED' },
    });

    return updated;
  }

  // ─── Reactivate ───────────────────────────────────────────────────────────────

  async reactivate(id: string, userId: string) {
    const tenant = await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.auditLog.log({
      tenantId: id,
      userId,
      action: 'tenant.reactivate',
      entity: 'Tenant',
      entityId: id,
      oldValues: { status: tenant.status },
      newValues: { status: 'ACTIVE' },
    });

    return updated;
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────────────

  async softDelete(id: string, userId: string) {
    await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLog.log({
      tenantId: id,
      userId,
      action: 'tenant.delete',
      entity: 'Tenant',
      entityId: id,
    });

    return updated;
  }

  // ─── Impersonate ──────────────────────────────────────────────────────────────

  async impersonate(
    tenantId: string,
    superAdminId: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // Ensure tenant exists and is not deleted
    await this.findOne(tenantId);

    const payload = {
      sub: superAdminId,
      tenantId,
      impersonating: true,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: IMPERSONATION_EXPIRES_IN,
    });

    await this.auditLog.log({
      tenantId,
      userId: superAdminId,
      action: 'admin.impersonate',
      entity: 'Tenant',
      entityId: tenantId,
    });

    this.logger.log(
      `Super admin ${superAdminId} impersonating tenant ${tenantId}`,
    );

    return { accessToken, expiresIn: IMPERSONATION_EXPIRES_IN };
  }
}
