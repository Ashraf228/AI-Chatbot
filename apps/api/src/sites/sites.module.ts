import { Module } from '@nestjs/common';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { SiteStatusService } from './site-status.service';
import { PrismaService } from '../db/prisma.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [SitesController],
  providers: [SitesService, SiteStatusService, PrismaService],
  exports: [SitesService, SiteStatusService],
})
export class SitesModule {}
