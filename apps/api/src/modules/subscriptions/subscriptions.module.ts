import { Module } from '@nestjs/common';
import {
  SubscriptionPlansController,
  SubscriptionsTenantController,
} from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [SubscriptionPlansController, SubscriptionsTenantController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
