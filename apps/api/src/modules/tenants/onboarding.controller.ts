import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { TenantsProvisioningService } from './tenants-provisioning.service';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly provisioningService: TenantsProvisioningService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a school and start a trial subscription' })
  @ApiResponse({ status: 201, description: 'School trial created' })
  async register(@Body() dto: RegisterSchoolDto) {
    const result = await this.provisioningService.provision(
      {
        subdomain: dto.subdomain,
        name: dto.schoolName,
        email: dto.ownerEmail,
        phone: dto.phone,
        address: dto.address,
        planId: dto.planId,
      },
      {
        ownerFirstName: dto.ownerFirstName,
        ownerLastName: dto.ownerLastName,
        ownerPassword: dto.password,
      },
    );

    return {
      tenant: result.tenant,
      schoolOwnerEmail: result.schoolOwnerEmail,
      loginSubdomain: result.tenant.subdomain,
    };
  }
}
