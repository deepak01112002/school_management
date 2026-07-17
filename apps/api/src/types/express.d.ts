import { TenantContext } from '../common/middleware/tenant-resolver.middleware';
import { AuthUser } from '../common/decorators/current-user.decorator';

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext | null;
      user?: AuthUser;
    }
  }
}
