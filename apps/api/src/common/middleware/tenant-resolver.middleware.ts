import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface TenantContext {
  tenantId: string;
  subdomain: string;
  status: string;
}

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const subdomain = this.resolveSubdomain(req);

    if (!subdomain) {
      req['tenantContext'] = null;
      return next();
    }

    const superAdminSubdomain = this.configService.get<string>(
      'SUPER_ADMIN_SUBDOMAIN',
      'admin',
    );
    if (subdomain === superAdminSubdomain) {
      req['tenantContext'] = null;
      return next();
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        subdomain,
        deletedAt: null,
      },
      select: {
        id: true,
        subdomain: true,
        status: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found for subdomain: ${subdomain}`);
    }

    if (tenant.status === 'SUSPENDED') {
      throw new ForbiddenException('Tenant account is suspended');
    }

    req['tenantContext'] = {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      status: tenant.status,
    } satisfies TenantContext;

    next();
  }

  private resolveSubdomain(req: Request): string | null {
    const forwardedSubdomain = req.header('x-tenant-subdomain')?.trim();
    if (forwardedSubdomain) {
      return forwardedSubdomain.toLowerCase();
    }

    const hostname = req.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return null;
    }

    const rootDomain = this.configService.get<string>(
      'ROOT_DOMAIN',
      'school-erp.com',
    );

    if (hostname === rootDomain) {
      return null;
    }

    if (hostname.endsWith(`.${rootDomain}`)) {
      return hostname.slice(0, -1 * (`.${rootDomain}`).length);
    }

    if (hostname.endsWith('.localhost')) {
      return hostname.slice(0, -1 * '.localhost'.length);
    }

    return null;
  }
}
