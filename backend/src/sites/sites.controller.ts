import { Body, Controller, Get, Post } from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto';

@Controller('admin/sites')
export class SitesController {
  constructor(private sites: SitesService) {}

  @Post()
  async create(@Body() dto: CreateSiteDto) {
    return this.sites.createSite(dto.id, dto.name, dto.allowedDomains, dto.config ?? {});
  }

  @Get()
  async list() {
    return this.sites.listSites();
  }
}