import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './dto';
import { AdminKeyGuard } from '../utils/admin.guard';
import { SiteStatusService } from './site-status.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites')
export class SitesController {
  constructor(
    private sites: SitesService,
    private statuses: SiteStatusService,
  ) {}

  @Post()
  async create(@Body() dto: CreateSiteDto) {
    if (!dto.tenantId?.trim()) {
      throw new BadRequestException('tenantId required');
    }

    return this.sites.createSite(
      {
        id: dto.id,
        siteKey: dto.siteKey,
        tenantId: dto.tenantId,
        name: dto.name,
        allowedDomains: dto.allowedDomains,
        config: dto.config ?? {},
      },
    );
  }

  @Get()
  async list() {
    const sites = await this.sites.listSites();
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
            nextAction: { label: 'Setup prüfen', href: `/sites/${site.id}/setup` },
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
  async status(@Param('siteId') siteId: string) {
    return this.statuses.resolveStatus(siteId);
  }

  @Post(':siteId/go-live')
  async goLive(
    @Param('siteId') siteId: string,
    @Body() body: { actorId?: string; actorRole?: string },
  ) {
    const status = await this.statuses.resolveStatus(siteId);
    if (!status.isLiveReady) {
      throw new BadRequestException({
        message: 'Kunde ist noch nicht bereit für Live.',
        status,
      });
    }

    const site = await this.sites.markLive(siteId, {
      actorId: typeof body.actorId === 'string' ? body.actorId : undefined,
      actorRole: typeof body.actorRole === 'string' ? body.actorRole : undefined,
    });

    return {
      site,
      status: await this.statuses.resolveStatus(siteId),
    };
  }

  @Patch(':siteId')
  async update(@Param('siteId') siteId: string, @Body() dto: UpdateSiteDto) {
    return this.sites.updateSite(siteId, dto);
  }
}
