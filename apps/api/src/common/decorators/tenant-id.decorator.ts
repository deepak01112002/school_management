import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const tenantContext = request['tenantContext'] as
      | { tenantId: string; subdomain: string; status: string }
      | null
      | undefined;
    const user = request['user'] as { tenantId?: string | null } | undefined;

    return tenantContext?.tenantId ?? user?.tenantId ?? undefined;
  },
);
