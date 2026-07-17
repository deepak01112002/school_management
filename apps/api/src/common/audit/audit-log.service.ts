import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogParams {
  tenantId?: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  oldValues?: object;
  newValues?: object;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId ?? null,
          userId: params.userId ?? null,
          action: params.action,
          entity: params.entity ?? null,
          entityId: params.entityId ?? null,
          oldValues: params.oldValues ?? undefined,
          newValues: params.newValues ?? undefined,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for action "${params.action}": ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
