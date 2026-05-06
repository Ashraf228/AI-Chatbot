import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { IndustryTemplatesService } from './industry-templates.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites')
export class IndustryTemplateSitesController {
  constructor(private readonly templates: IndustryTemplatesService) {}

  @Post(':siteId/apply-template')
  applyTemplate(
    @Param('siteId') siteId: string,
    @Body()
    body: {
      templateId?: string;
      templateKey?: string;
      mode?: 'fill_missing_only' | 'overwrite';
      appliedBy?: string;
      actorRole?: string;
    },
  ) {
    return this.templates.applyTemplate(siteId, {
      templateKey: String(body.templateId || body.templateKey || ''),
      mode: body.mode,
      appliedBy: body.appliedBy,
      actorRole: body.actorRole,
    });
  }
}
