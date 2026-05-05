import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { UpdateSiteModulesDto } from './dto';
import { SiteModulesService } from './site-modules.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/site-modules')
export class SiteModulesController {
  constructor(private readonly siteModules: SiteModulesService) {}

  @Get(':siteId')
  async list(@Param('siteId') siteId: string) {
    return this.siteModules.listForSite(siteId);
  }

  @Patch(':siteId')
  async update(@Param('siteId') siteId: string, @Body() dto: UpdateSiteModulesDto) {
    return this.siteModules.updateForSite(siteId, dto.modules);
  }
}
