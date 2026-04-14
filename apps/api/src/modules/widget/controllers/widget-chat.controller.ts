import { Body, Controller, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';

import { SendMessageDto } from '../dto/send-message.dto';
import { WidgetChatService } from '../services/widget-chat.service';
import { WidgetOriginGuard } from '../guards/widget-origin.guard';
import { WidgetRateLimitGuard } from '../guards/widget-rate-limit.guard';
import { WidgetSiteGuard } from '../guards/widget-site.guard';

@Controller('widget/chat')
@UseGuards(WidgetSiteGuard, WidgetOriginGuard, WidgetRateLimitGuard)
export class WidgetChatController {
  constructor(private readonly widgetChatService: WidgetChatService) {}

  @Post('message')
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Headers('origin') origin?: string,
    @Req() req?: Request,
  ) {
    return this.widgetChatService.sendMessage(dto, origin, req);
  }

  @Post('stream')
  async streamMessage(
    @Body() dto: SendMessageDto,
    @Headers('origin') origin: string | undefined,
    @Req() req: Request | undefined,
    @Res() res: Response,
  ) {
    return this.widgetChatService.streamMessage(dto, origin, req, res);
  }
}
