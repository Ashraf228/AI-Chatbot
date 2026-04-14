import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CaptureLeadDto } from '../dto/capture-lead.dto';
import { WidgetLeadsService } from '../services/widget-leads.service';
import { WidgetOriginGuard } from '../guards/widget-origin.guard';
import { WidgetRateLimitGuard } from '../guards/widget-rate-limit.guard';
import { WidgetSiteGuard } from '../guards/widget-site.guard';

@Controller('widget/leads')
@UseGuards(WidgetSiteGuard, WidgetOriginGuard, WidgetRateLimitGuard)
export class WidgetLeadsController {
  constructor(private readonly widgetLeadsService: WidgetLeadsService) {}

  @Post()
  async captureLead(
    @Body() dto: CaptureLeadDto,
    @Headers('origin') origin?: string,
    @Req() req?: Request,
  ) {
    return this.widgetLeadsService.capture(dto, origin, req);
  }
}
