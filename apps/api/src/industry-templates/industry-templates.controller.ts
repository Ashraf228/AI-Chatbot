import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { IndustryTemplatesService } from './industry-templates.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/industry-templates')
export class IndustryTemplatesController {
  constructor(private readonly templates: IndustryTemplatesService) {}

  @Get()
  list() {
    return this.templates.listTemplates();
  }

  @Post(':siteId/apply')
  apply(
    @Param('siteId') siteId: string,
    @Body() body: { templateKey?: string; mode?: 'fill_missing_only' | 'overwrite'; appliedBy?: string },
  ) {
    return this.templates.applyTemplate(siteId, {
      templateKey: String(body.templateKey || ''),
      mode: body.mode,
      appliedBy: body.appliedBy,
    });
  }
}
