import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantsProvisioningService } from './tenants-provisioning.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        privateKey: config.get<string>('JWT_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        publicKey: config.get<string>('JWT_PUBLIC_KEY')?.replace(/\\n/g, '\n'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  controllers: [TenantsController, OnboardingController],
  providers: [TenantsService, TenantsProvisioningService],
  exports: [TenantsService, TenantsProvisioningService],
})
export class TenantsModule {}
