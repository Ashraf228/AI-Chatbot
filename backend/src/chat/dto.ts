import { IsOptional, IsString } from 'class-validator';

export class ChatMessageDto {
  @IsString() siteId!: string;
  @IsOptional() @IsString() sessionId?: string;
  @IsString() message!: string;
}