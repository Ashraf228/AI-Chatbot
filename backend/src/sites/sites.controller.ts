import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto';
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
      dto.id,
      dto.tenantId,
      dto.name,
      dto.allowedDomains,
      dto.config ?? {},
    );
  }

  @Get()
  async list() {
    return this.sites.listSites();
  }
}