import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SiteModulesModule } from '../site-modules/site-modules.module';
import { SitesModule } from '../sites/sites.module';
import { PrismaService } from '../db/prisma.service';
import { AssistantProfileDiagnosticsController } from './assistant-profile-diagnostics.controller';
import { AssistantProfileDiagnosticsService } from './assistant-profile-diagnostics.service';
import { AssistantProfileMigrationService } from './assistant-profile-migration.service';
import { AssistantProfileMigrationPreviewService } from './assistant-profile-migration-preview.service';
import { AssistantProfileResolverService } from './assistant-profile-resolver.service';
import { AssistantProfileSaveService } from './assistant-profile-save.service';

@Module({
  imports: [SitesModule, SiteModulesModule, AuditLogsModule],
  controllers: [AssistantProfileDiagnosticsController],
  providers: [
    AssistantProfileResolverService,
    AssistantProfileDiagnosticsService,
    AssistantProfileMigrationPreviewService,
    AssistantProfileMigrationService,
    AssistantProfileSaveService,
    PrismaService,
  ],
  exports: [AssistantProfileResolverService, AssistantProfileDiagnosticsService],
})
export class AssistantProfilesModule {}
