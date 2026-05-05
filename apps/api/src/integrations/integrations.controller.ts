import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { UpdateIntegrationConnectionsDto } from './dto';
import { IntegrationsService } from './integrations.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get(':siteId')
  async list(@Param('siteId') siteId: string) {
    return this.integrations.listForSite(siteId);
  }

  @Patch(':siteId')
  async update(
    @Param('siteId') siteId: string,
    @Body() dto: UpdateIntegrationConnectionsDto,
  ) {
    return this.integrations.updateForSite(siteId, dto.connections);
  }

  @Post(':siteId/rotate-secrets')
  async rotateSecrets(@Param('siteId') siteId: string) {
    return this.integrations.rotateSecretsForSite(siteId);
  }
}
