import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditLogModule } from './common/audit/audit-log.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { IpRestrictionMiddleware } from './common/middleware/ip-restriction.middleware';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { AcademicModule } from './modules/academic/academic.module';
import { StaffModule } from './modules/staff/staff.module';
import { StudentsModule } from './modules/students/students.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { StudentLeavesModule } from './modules/student-leaves/student-leaves.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // Configuration — loads .env and validates env vars
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),

    // Prisma (global)
    PrismaModule,

    // Audit logging (global)
    AuditLogModule,

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60000),
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // Feature modules
    HealthModule,
    AuthModule,
    TenantsModule,
    SettingsModule,
    SubscriptionsModule,
    AcademicModule,
    StaffModule,
    StudentsModule,
    AttendanceModule,
    StudentLeavesModule,
    DashboardModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Tenant resolver on all routes except health
    consumer
      .apply(TenantResolverMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'api/v1/health', method: RequestMethod.GET },
      )
      .forRoutes('*');

    // IP restriction on all routes
    consumer.apply(IpRestrictionMiddleware).forRoutes('*');
  }
}
