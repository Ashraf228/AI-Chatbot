import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { WidgetConfigService } from '../services/widget-config.service';
import { WidgetSiteGuard } from '../guards/widget-site.guard';

@Controller('widget/config')
@UseGuards(WidgetSiteGuard)
export class WidgetConfigController {
  constructor(private readonly widgetConfigService: WidgetConfigService) {}

  @Get()
  async getConfig(@Query('siteKey') siteKey: string) {
    return this.widgetConfigService.getPublicConfig(siteKey);
  }
}
