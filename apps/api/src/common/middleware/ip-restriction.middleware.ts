import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IpRestrictionMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const tenantContext = req['tenantContext'] as
      | { tenantId: string }
      | null
      | undefined;

    if (!tenantContext?.tenantId) {
      return next();
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantContext.tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      return next();
    }

    const settings = tenant.settings as Record<string, unknown> | null;
    const allowedIps = settings?.allowedIps;

    if (!Array.isArray(allowedIps) || allowedIps.length === 0) {
      return next();
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const requestIp =
      req.ip ??
      (typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim()
        : Array.isArray(forwardedFor)
          ? forwardedFor[0]
          : undefined);

    if (!requestIp || !(allowedIps as string[]).includes(requestIp)) {
      throw new ForbiddenException('IP not allowed');
    }

    next();
  }
}
