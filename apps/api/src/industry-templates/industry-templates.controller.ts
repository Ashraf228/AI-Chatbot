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
    @Body() body: { templateKey?: string },
  ) {
    return this.templates.applyTemplate(siteId, String(body.templateKey || ''));
  }
}
