import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CreateSessionDto } from '../dto/create-session.dto';
import { WidgetSessionService } from '../services/widget-session.service';
import { WidgetOriginGuard } from '../guards/widget-origin.guard';
import { WidgetRateLimitGuard } from '../guards/widget-rate-limit.guard';
import { WidgetSiteGuard } from '../guards/widget-site.guard';

@Controller('widget/session')
@UseGuards(WidgetSiteGuard, WidgetOriginGuard, WidgetRateLimitGuard)
export class WidgetSessionController {
  constructor(private readonly widgetSessionService: WidgetSessionService) {}

  @Post()
  async createSession(
    @Body() dto: CreateSessionDto,
    @Headers('origin') origin?: string,
    @Req() req?: Request,
  ) {
    return this.widgetSessionService.createOrResume(dto, origin, req);
  }
}
