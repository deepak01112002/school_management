import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth('JWT')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get role-specific dashboard KPIs' })
  getStats(@TenantId() tenantId: string, @CurrentUser() user: AuthUser) {
    const role = user.role.name.toLowerCase();
    const permissions: string[] = Array.isArray(user.role.permissions)
      ? (user.role.permissions as string[])
      : [];

    if (permissions.includes('*') || role.includes('owner') || role.includes('principal') || role.includes('admin')) {
      return this.dashboardService.getAdminStats(tenantId);
    }

    if (role.includes('accountant')) {
      return this.dashboardService.getAccountantStats(tenantId);
    }

    if (role.includes('student')) {
      return this.dashboardService.getStudentStats(tenantId, user.id);
    }

    // teacher / class teacher / vice principal / any staff
    return this.dashboardService.getTeacherStats(tenantId, user.id);
  }
}
