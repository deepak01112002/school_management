import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ─── Branding ────────────────────────────────────────────────────────────────

  async getBranding(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        address: true,
        phone: true,
        email: true,
        website: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async updateBranding(
    tenantId: string,
    dto: UpdateBrandingDto,
    userId: string,
  ) {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        address: true,
        phone: true,
        email: true,
        website: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.website !== undefined && { website: dto.website }),
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        address: true,
        phone: true,
        email: true,
        website: true,
      },
    });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'settings.branding.update',
      entity: 'Tenant',
      entityId: tenantId,
      oldValues: existing,
      newValues: updated,
    });

    return updated;
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant.settings;
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateSettingsDto,
    userId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const oldSettings = tenant.settings as Record<string, unknown>;

    // Deep merge: top-level keys from dto are merged into existing settings
    const mergedSettings: Record<string, unknown> = { ...oldSettings };

    if (dto.notifications !== undefined) {
      mergedSettings['notifications'] = {
        ...((oldSettings['notifications'] as Record<string, unknown>) ?? {}),
        ...dto.notifications,
      };
    }

    if (dto.payments !== undefined) {
      mergedSettings['payments'] = {
        ...((oldSettings['payments'] as Record<string, unknown>) ?? {}),
        ...dto.payments,
      };
    }

    if (dto.security !== undefined) {
      mergedSettings['security'] = {
        ...((oldSettings['security'] as Record<string, unknown>) ?? {}),
        ...dto.security,
      };
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: mergedSettings as Parameters<typeof this.prisma.tenant.update>[0]['data']['settings'] },
      select: { id: true, settings: true },
    });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'settings.update',
      entity: 'Tenant',
      entityId: tenantId,
      oldValues: { settings: oldSettings },
      newValues: { settings: mergedSettings },
    });

    return updated.settings;
  }
}
