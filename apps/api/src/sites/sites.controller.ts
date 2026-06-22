import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './dto';
import { AdminKeyGuard } from '../utils/admin.guard';
import { SiteStatusService } from './site-status.service';
import { AdminScopeService } from '../utils/admin-scope.service';
import { SiteAgentActivityService } from './site-agent-activity.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites')
export class SitesController {
  constructor(
    private sites: SitesService,
    private statuses: SiteStatusService,
    private scope: AdminScopeService,
    private agentActivity: SiteAgentActivityService,
  ) {}

  @Post()
  async create(@Body() dto: CreateSiteDto, @Req() req: { dashboardAuth?: unknown }) {
    if (!dto.tenantId?.trim()) {
      throw new BadRequestException('tenantId required');
    }
    const auth = this.scope.getAuth(req);
    this.scope.assertRole(auth, ['admin', 'operator']);
    await this.scope.assertTenantAccess(auth, dto.tenantId);

    return this.sites.createSite(
      {
        id: dto.id,
        siteKey: dto.siteKey,
        tenantId: dto.tenantId,
        name: dto.name,
        allowedDomains: dto.allowedDomains,
        config: dto.config ?? {},
        isEvaluationDemo: dto.isEvaluationDemo,
      },
    );
  }

  @Get()
  async list(@Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    const sites = this.scope.filterSitesForAuth(auth, await this.sites.listSites());
    const statuses = await Promise.all(
      sites.map(async (site) => {
        try {
          return await this.statuses.resolveStatus(site.id);
        } catch {
          return {
            siteId: site.id,
            code: 'error',
            label: 'Fehler',
            status: 'Fehler',
            severity: 'error',
            progress: 0,
            lifecycleStatus: 'error',
            isLiveReady: false,
            missingSteps: [],
            steps: [],
            nextAction: { key: 'basics', label: 'Setup prüfen', href: `/sites/${site.id}/setup` },
            knowledgeCount: 0,
            industry: '',
            setupGoal: '',
            lastTestedAt: '',
            goLiveAt: '',
          };
        }
      }),
    );
    const statusBySiteId = new Map(statuses.map((status) => [status.siteId, status]));

    return sites.map((site) => ({
      ...site,
      setupStatus: statusBySiteId.get(site.id),
    }));
  }

  @Get(':siteId/status')
  async status(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer'],
    });
    return this.statuses.resolveStatus(siteId);
  }

  @Get(':siteId/agent-activity')
  async agentActivityLog(
    @Param('siteId') siteId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.agentActivity.listForSite(siteId, Number(limit) || 50);
  }

  @Post(':siteId/go-live')
  async goLive(
    @Param('siteId') siteId: string,
    @Body() body: { actorId?: string; actorRole?: string },
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    const status = await this.statuses.resolveStatus(siteId);
    if (!status.isLiveReady) {
      throw new BadRequestException({
        message: 'Kunde ist noch nicht bereit für Live.',
        status,
      });
    }

    const site = await this.sites.markLive(siteId, {
      actorId: auth.actorId || (typeof body.actorId === 'string' ? body.actorId : undefined),
      actorRole: auth.role || (typeof body.actorRole === 'string' ? body.actorRole : undefined),
    });

    return {
      site,
      status: await this.statuses.resolveStatus(siteId),
    };
  }

  @Patch(':siteId')
  async update(
    @Param('siteId') siteId: string,
    @Body() dto: UpdateSiteDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.sites.updateSite(siteId, dto);
  }
}
