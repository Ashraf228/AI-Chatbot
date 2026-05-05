import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './dto';
import { AdminKeyGuard } from '../utils/admin.guard';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites')
export class SitesController {
  constructor(private sites: SitesService) {}

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
    return this.sites.listSites();
  }

  @Patch(':siteId')
  async update(@Param('siteId') siteId: string, @Body() dto: UpdateSiteDto) {
    return this.sites.updateSite(siteId, dto);
  }
}
