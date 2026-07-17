import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionPlanDto } from './dto/create-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-plan.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('subscriptions')
@ApiBearerAuth('JWT')
@Controller('super-admin/subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  @RequirePermissions('subscriptions:read')
  @ApiOperation({ summary: 'List all subscription plans' })
  findAll() {
    return this.service.findAllPlans();
  }

  @Post()
  @RequirePermissions('subscriptions:manage')
  @ApiOperation({ summary: 'Create a new subscription plan' })
  create(@Body() dto: CreateSubscriptionPlanDto) {
    return this.service.createPlan(dto);
  }

  @Get(':id')
  @RequirePermissions('subscriptions:read')
  @ApiOperation({ summary: 'Get a subscription plan by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOnePlan(id);
  }

  @Patch(':id')
  @RequirePermissions('subscriptions:manage')
  @ApiOperation({ summary: 'Update a subscription plan' })
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    return this.service.updatePlan(id, dto);
  }

  @Patch(':id/activate')
  @RequirePermissions('subscriptions:manage')
  @ApiOperation({ summary: 'Activate a plan' })
  activate(@Param('id') id: string) {
    return this.service.togglePlan(id, true);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('subscriptions:manage')
  @ApiOperation({ summary: 'Deactivate a plan' })
  deactivate(@Param('id') id: string) {
    return this.service.togglePlan(id, false);
  }
}

@ApiTags('subscriptions')
@ApiBearerAuth('JWT')
@Controller('subscriptions')
export class SubscriptionsTenantController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get('current')
  @RequirePermissions('subscriptions:read')
  @ApiOperation({ summary: 'Get current tenant subscription and plan details' })
  getCurrent(@TenantId() tenantId: string) {
    return this.service.getTenantSubscription(tenantId);
  }
}
