import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminScopeService } from '../utils/admin-scope.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AssistantProfileDiagnosticsService } from './assistant-profile-diagnostics.service';
import { AssistantProfileMigrationService } from './assistant-profile-migration.service';
import { AssistantProfileMigrationPreviewService } from './assistant-profile-migration-preview.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites/:siteId/assistant-profile')
export class AssistantProfileDiagnosticsController {
  constructor(
    private readonly diagnostics: AssistantProfileDiagnosticsService,
    private readonly migrationPreview: AssistantProfileMigrationPreviewService,
    private readonly migration: AssistantProfileMigrationService,
    private readonly scope: AdminScopeService,
  ) {}

  @Get('diagnostics')
  async getDiagnostics(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.diagnostics.getDiagnostics(siteId);
  }

  @Get('migration-preview')
  async getMigrationPreview(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.migrationPreview.getMigrationPreview(siteId);
  }

  @Post('migrate')
  async saveAssistantProfile(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    const site = await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.migration.savePreviewAsAssistantProfile(siteId, site.tenant_id, auth.actorId);
  }
}
