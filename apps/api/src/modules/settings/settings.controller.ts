import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SettingsService } from './settings.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('settings')
@ApiBearerAuth('JWT')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ─── Branding ────────────────────────────────────────────────────────────────

  @Get('branding')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Get tenant branding' })
  getBranding(@TenantId() tenantId: string) {
    return this.settingsService.getBranding(tenantId);
  }

  @Patch('branding')
  @RequirePermissions('settings:update')
  @ApiOperation({ summary: 'Update tenant branding' })
  updateBranding(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.settingsService.updateBranding(tenantId, dto, user.id);
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Get tenant settings (notifications, payments, security)' })
  getSettings(@TenantId() tenantId: string) {
    return this.settingsService.getSettings(tenantId);
  }

  @Patch()
  @RequirePermissions('settings:update')
  @ApiOperation({ summary: 'Update tenant settings (deep merge)' })
  updateSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(tenantId, dto, user.id);
  }
}
