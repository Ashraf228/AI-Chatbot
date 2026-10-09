import { IsOptional, IsString } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  siteId!: string;

  @IsString()
  publicKey!: string;

  @IsOptional()
  @IsString()
  sessionId?: string; // ✅ neu

  @IsString()
  message!: string;
}