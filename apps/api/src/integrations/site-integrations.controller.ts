import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AdminScopeService } from '../utils/admin-scope.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { RateLimitService } from '../utils/rate-limit.service';
import { CreateIntegrationDto, PatchIntegrationDto } from './dto';
import { IntegrationsService } from './integrations.service';
import { UsageLimitService } from '../billing/usage-limit.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites/:siteId/integrations')
export class SiteIntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly scope: AdminScopeService,
    private readonly auditLogs: AuditLogService,
    private readonly rateLimit: RateLimitService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  @Get()
  async list(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.integrations.listForSite(siteId);
  }

  @Post()
  async create(
    @Param('siteId') siteId: string,
    @Body() dto: CreateIntegrationDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    const site = await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    await this.usageLimits.assertWithinLimit(site.tenant_id, 'maxIntegrations');
    const result = await this.integrations.createForSite(siteId, dto);
    await this.auditLogs.record({
      siteId,
      tenantId: site.tenant_id,
      actorId: auth.actorId,
      actorRole: auth.role,
      action: 'integration.created',
      resourceType: 'integration_connection',
      resourceId: result?.id || `${dto.providerKey}:${dto.connectionKey || 'primary'}`,
      metadata: {
        providerKey: dto.providerKey,
        connectionKey: dto.connectionKey || 'primary',
        enabled: dto.enabled !== false,
        configFields: Object.keys(dto.config || {}),
        secretFields: Object.keys(dto.secrets || {}),
      },
    });
    return result;
  }

  @Patch(':integrationId')
  async update(
    @Param('siteId') siteId: string,
    @Param('integrationId') integrationId: string,
    @Body() dto: PatchIntegrationDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    const site = await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    const result = await this.integrations.patchForSite(siteId, integrationId, dto);
    await this.auditLogs.record({
      siteId,
      tenantId: site.tenant_id,
      actorId: auth.actorId,
      actorRole: auth.role,
      action: 'integration.updated',
      resourceType: 'integration_connection',
      resourceId: integrationId,
      metadata: {
        enabled: dto.enabled,
        configFields: Object.keys(dto.config || {}),
        secretFields: Object.keys(dto.secrets || {}),
      },
    });
    return result;
  }

  @Delete(':integrationId')
  async remove(
    @Param('siteId') siteId: string,
    @Param('integrationId') integrationId: string,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    const site = await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    const result = await this.integrations.deleteForSite(siteId, integrationId);
    await this.auditLogs.record({
      siteId,
      tenantId: site.tenant_id,
      actorId: auth.actorId,
      actorRole: auth.role,
      action: 'integration.deleted',
      resourceType: 'integration_connection',
      resourceId: integrationId,
      metadata: {
        providerKey: result.providerKey,
        connectionKey: result.connectionKey,
      },
    });
    return result;
  }

  @Post(':integrationId/test')
  async test(
    @Param('siteId') siteId: string,
    @Param('integrationId') integrationId: string,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    const site = await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    await this.enforceAdminRateLimit(`integration-test:${siteId}:${auth.actorId || 'dashboard'}`, 10, 60_000);
    const result = await this.integrations.testForSite(siteId, integrationId);
    await this.auditLogs.record({
      siteId,
      tenantId: site.tenant_id,
      actorId: auth.actorId,
      actorRole: auth.role,
      action: result.status === 'success' ? 'integration.tested' : 'integration.test_failed',
      resourceType: 'integration_connection',
      resourceId: integrationId,
      metadata: {
        status: result.status,
        message: result.message,
      },
    });
    return result;
  }

  private async enforceAdminRateLimit(key: string, limit: number, windowMs: number) {
    const result = await this.rateLimit.allow(`admin:${key}`, limit, windowMs);
    if (!result.allowed) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
