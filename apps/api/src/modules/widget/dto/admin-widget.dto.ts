import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const BRANDING_FONT_OPTIONS = [
  'system',
  'inter',
  'avenir',
  'georgia',
  'times',
  'trebuchet',
  'verdana',
  'monospace',
] as const;

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
    .filter((entry) => typeof entry === 'string' && entry.length > 0);
}

function normalizeSuggestedQuestions(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, questions]) => [key, normalizeStringArray(questions)]),
  );
}

export class UpdateBrandingDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(120)
  botName?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsUrl({ require_tld: false }, { message: 'logoUrl must be a valid URL' })
  @MaxLength(1000)
  logoUrl?: string;

  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: 'brandColor must be a valid hex color' })
  brandColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: 'accentColor must be a valid hex color' })
  accentColor?: string;

  @IsOptional()
  @IsIn(BRANDING_FONT_OPTIONS)
  fontFamily?: (typeof BRANDING_FONT_OPTIONS)[number];

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(1000)
  welcomeMessage?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsUrl({ require_tld: false }, { message: 'privacyUrl must be a valid URL' })
  @MaxLength(1000)
  privacyUrl?: string;
}

export class UpdateWidgetConfigDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(120)
  siteKey?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsUrl({ require_tld: false }, { message: 'widgetBundleUrl must be a valid URL' })
  @MaxLength(1000)
  widgetBundleUrl?: string;

  @IsOptional()
  @IsBoolean()
  consentRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  leadCaptureEnabled?: boolean;

  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  allowedDomains?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeSuggestedQuestions(value))
  @IsObject()
  suggestedQuestionsByPath?: Record<string, string[]>;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(12000)
  systemPrompt?: string;
}

export class ListLeadsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  siteId?: string;

  @IsOptional()
  @IsIn(['new', 'contacted', 'qualified', 'closed'])
  status?: 'new' | 'contacted' | 'qualified' | 'closed';
}

export class UpdateLeadDto {
  @IsIn(['new', 'contacted', 'qualified', 'closed'])
  status!: 'new' | 'contacted' | 'qualified' | 'closed';
}

export class ListSiteScopedQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  siteId?: string;
}

export class CreateReportSubscriptionDto {
  @IsString()
  @MaxLength(120)
  siteId!: string;

  @IsEmail()
  @MaxLength(200)
  recipientEmail!: string;

  @IsIn(['weekly', 'monthly'])
  frequency!: 'weekly' | 'monthly';

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateReportSubscriptionDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  recipientEmail?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  frequency?: 'weekly' | 'monthly';

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class RunReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  siteId?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  frequency?: 'weekly' | 'monthly';
}
