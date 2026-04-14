import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackEventDto {
  @IsString()
  @MaxLength(120)
  siteKey!: string;

  @IsString()
  @MaxLength(120)
  sessionId!: string;

  @IsString()
  @IsIn([
    'widget_impression',
    'widget_opened',
    'chat_started',
    'message_sent',
    'message_received',
    'fallback_answer',
    'lead_submitted',
  ])
  eventType!: string;

  @IsString()
  @MaxLength(2000)
  pageUrl!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
