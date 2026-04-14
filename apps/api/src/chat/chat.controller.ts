import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto';

@Controller('chat')
export class ChatController {
  constructor(private chat: ChatService) {}

  @Post('message')
  async message(
    @Body() dto: ChatMessageDto,
    @Headers('origin') origin?: string,
    @Req() req?: Request,
  ) {
    return this.chat.reply(dto, origin, req);
  }
}
