import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { TrackEventDto } from '../dto/track-event.dto';
import { WidgetAnalyticsService } from '../services/widget-analytics.service';
import { WidgetOriginGuard } from '../guards/widget-origin.guard';
import { WidgetRateLimitGuard } from '../guards/widget-rate-limit.guard';
import { WidgetSiteGuard } from '../guards/widget-site.guard';

@Controller('widget/events')
@UseGuards(WidgetSiteGuard, WidgetOriginGuard, WidgetRateLimitGuard)
export class WidgetEventsController {
  constructor(private readonly widgetAnalyticsService: WidgetAnalyticsService) {}

  @Post()
  async trackEvent(
    @Body() dto: TrackEventDto,
    @Headers('origin') origin?: string,
    @Req() req?: Request,
  ) {
    return this.widgetAnalyticsService.track(dto, origin, req);
  }
}
