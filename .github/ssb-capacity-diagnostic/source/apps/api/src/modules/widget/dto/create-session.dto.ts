import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MaxLength(120)
  siteKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  visitorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  userAgent?: string;
}
