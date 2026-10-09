import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AdminScopeModule } from '../utils/admin-scope.module';
import { BillingController, SiteUsageController } from './billing.controller';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { UsageLimitService } from './usage-limit.service';

@Module({
  imports: [AdminScopeModule],
  controllers: [BillingController, SiteUsageController],
  providers: [PlanService, SubscriptionService, UsageLimitService, PrismaService],
  exports: [PlanService, SubscriptionService, UsageLimitService],
})
export class BillingModule {}
