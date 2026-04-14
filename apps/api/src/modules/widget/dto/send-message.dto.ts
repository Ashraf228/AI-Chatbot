import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MaxLength(120)
  siteKey!: string;

  @IsString()
  @MaxLength(120)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  visitorId?: string;

  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  locale?: string;
}
