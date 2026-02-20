import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto';

@Controller('chat')
export class ChatController {
  constructor(private chat: ChatService) {}

  @Post('message')
  async message(@Body() dto: ChatMessageDto, @Headers('origin') origin?: string) {
    return this.chat.reply(dto, origin);
  }
}