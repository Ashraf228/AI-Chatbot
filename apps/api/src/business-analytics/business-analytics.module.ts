import { Module } from '@nestjs/common';
import { BusinessAnalyticsController } from './business-analytics.controller';
import { BusinessAnalyticsService } from './business-analytics.service';
import { PrismaService } from '../db/prisma.service';
import { SitesModule } from '../sites/sites.module';
import { AdminScopeModule } from '../utils/admin-scope.module';

@Module({
  imports: [SitesModule, AdminScopeModule],
  controllers: [BusinessAnalyticsController],
  providers: [BusinessAnalyticsService, PrismaService],
  exports: [BusinessAnalyticsService],
})
export class BusinessAnalyticsModule {}
