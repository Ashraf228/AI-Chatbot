import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { UpdateIntegrationConnectionsDto } from './dto';
import { IntegrationsService } from './integrations.service';
import { RequireDashboardRoles } from '../utils/dashboard-rbac';
import { AdminScopeService } from '../utils/admin-scope.service';
import { AuditLogService } from '../audit-logs/audit-log.service';

@UseGuards(AdminKeyGuard)
@RequireDashboardRoles('admin')
@Controller('admin/integrations')
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly scope: AdminScopeService,
    private readonly auditLogs: AuditLogService,
  ) {}

  @Get(':siteId')
  async list(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin'],
    });
    return this.integrations.listForSite(siteId);
  }

  @Patch(':siteId')
  async update(
    @Param('siteId') siteId: string,
    @Body() dto: UpdateIntegrationConnectionsDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin'],
    });
    const result = await this.integrations.updateForSite(siteId, dto.connections);
    await this.auditLogs.record({
      siteId,
      actorId: auth.actorId,
      actorRole: auth.role,
      action: 'update_integration',
      resourceType: 'integration_connection',
      resourceId: siteId,
      metadata: {
        connections: dto.connections.map((connection) => ({
          providerKey: connection.providerKey,
          connectionKey: connection.connectionKey,
          status: connection.status,
          configFields: Object.keys(connection.config?.values || {}),
          secretFields: Object.keys(connection.secrets?.values || {}),
        })),
      },
    });
    return result;
  }

  @Post(':siteId/rotate-secrets')
  async rotateSecrets(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin'],
    });
    const result = await this.integrations.rotateSecretsForSite(siteId);
    await this.auditLogs.record({
      siteId,
      actorId: auth.actorId,
      actorRole: auth.role,
      action: 'rotate_integration_secrets',
      resourceType: 'integration_connection',
      resourceId: siteId,
      metadata: {
        scanned: result.scanned,
        rotated: result.rotated,
        unchanged: result.unchanged,
      },
    });
    return result;
  }
}
