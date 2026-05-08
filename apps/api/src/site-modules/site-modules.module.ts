import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SitesModule } from '../sites/sites.module';
import { SiteModulesController } from './site-modules.controller';
import { SiteModulesService } from './site-modules.service';

@Module({
  imports: [SitesModule, AuditLogsModule],
  controllers: [SiteModulesController],
  providers: [SiteModulesService, PrismaService],
  exports: [SiteModulesService],
})
export class SiteModulesModule {}
