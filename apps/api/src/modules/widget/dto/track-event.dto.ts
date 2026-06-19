import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { WIDGET_ANALYTICS_ACCEPTED_EVENT_TYPES } from '../analytics-events';

export class TrackEventDto {
  @IsString()
  @MaxLength(120)
  siteKey!: string;

  @IsString()
  @MaxLength(120)
  sessionId!: string;

  @IsString()
  @IsIn(WIDGET_ANALYTICS_ACCEPTED_EVENT_TYPES)
  eventType!: string;

  @IsString()
  @MaxLength(2000)
  pageUrl!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
