import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { TenantsService } from './tenants.service';
import { TenantsProvisioningService } from './tenants-provisioning.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { QueryTenantsDto } from './dto/query-tenants.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('super-admin')
@ApiBearerAuth('JWT')
@Controller('super-admin/tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly provisioningService: TenantsProvisioningService,
  ) {}

  @Get()
  @RequirePermissions('tenants:read')
  @ApiOperation({ summary: 'List all tenants (paginated, filterable)' })
  findAll(@Query() query: QueryTenantsDto) {
    return this.tenantsService.findAll(query);
  }

  @Post()
  @RequirePermissions('tenants:create')
  @ApiOperation({ summary: 'Provision a new tenant (creates school + roles + owner account)' })
  provision(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthUser) {
    return this.provisioningService.provision(dto, { triggeredBy: user.id });
  }

  @Get(':id')
  @RequirePermissions('tenants:read')
  @ApiOperation({ summary: 'Get a single tenant by ID' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id/suspend')
  @RequirePermissions('tenants:delete')
  @ApiOperation({ summary: 'Suspend a tenant (blocks all logins)' })
  suspend(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.suspend(id, user.id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('tenants:update')
  @ApiOperation({ summary: 'Reactivate a suspended tenant' })
  reactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.reactivate(id, user.id);
  }

  @Delete(':id')
  @RequirePermissions('tenants:delete')
  @ApiOperation({ summary: 'Soft-delete a tenant (preserves all historical data)' })
  softDelete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.softDelete(id, user.id);
  }

  @Post(':id/impersonate')
  @RequirePermissions('tenants:read')
  @ApiOperation({ summary: 'Impersonate a tenant as Super Admin (1-hour scoped token)' })
  impersonate(@Param('id') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.impersonate(tenantId, user.id);
  }
}
