import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Max,
  Min,
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
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsUrl({ require_tld: false }, { message: 'websiteUrl must be a valid URL' })
  @MaxLength(1000)
  websiteUrl?: string;

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
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsEmail({}, { message: 'leadNotificationEmail must be a valid email address' })
  @MaxLength(200)
  leadNotificationEmail?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  allowedDomains?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  topTestQuestions?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeSuggestedQuestions(value))
  @IsObject()
  suggestedQuestionsByPath?: Record<string, string[]>;

  @IsOptional()
  @IsObject()
  conversationFlow?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(12000)
  systemPrompt?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(120)
  industry?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsIn([
    'lead_capture',
    'support',
    'product_advice',
    'appointments',
    'support_automation',
    'lead_generation',
    'customer_advice',
    'product_questions',
    'appointment_requests',
    'internal_knowledge',
  ])
  setupGoal?:
    | 'lead_capture'
    | 'support'
    | 'product_advice'
    | 'appointments'
    | 'support_automation'
    | 'lead_generation'
    | 'customer_advice'
    | 'product_questions'
    | 'appointment_requests'
    | 'internal_knowledge';

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsIn([
    'support_automation',
    'lead_generation',
    'customer_advice',
    'product_questions',
    'appointment_requests',
    'internal_knowledge',
  ])
  primaryGoal?:
    | 'support_automation'
    | 'lead_generation'
    | 'customer_advice'
    | 'product_questions'
    | 'appointment_requests'
    | 'internal_knowledge';

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsIn(['handwerker-first-contact'])
  botType?: 'handwerker-first-contact';

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsIn(['professional', 'friendly', 'consultative', 'premium', 'direct'])
  tone?: 'professional' | 'friendly' | 'consultative' | 'premium' | 'direct';

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsIn(['flexible', 'grounded', 'strict'])
  knowledgeMode?: 'flexible' | 'grounded' | 'strict';

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsIn(['ask_followup', 'collect_contact', 'handoff'])
  fallbackBehavior?: 'ask_followup' | 'collect_contact' | 'handoff';

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsEmail({}, { message: 'supportEmail must be a valid email address' })
  @MaxLength(200)
  supportEmail?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(80)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsIn(['de', 'en'])
  language?: 'de' | 'en';

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(255)
  placeholderText?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsIn(['bottom_right', 'bottom_left'])
  widgetPosition?: 'bottom_right' | 'bottom_left';

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(80)
  launcherLabel?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(1000)
  privacyNoticeText?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(255)
  ctaText?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(120)
  templateId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  templateVersion?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(100)
  templateAppliedAt?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(120)
  templateAppliedBy?: string;

  @IsOptional()
  @IsIn(['fill_missing_only', 'overwrite'])
  templateApplyMode?: 'fill_missing_only' | 'overwrite';

  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  reportKpis?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(100)
  lastTestedAt?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(1000)
  lastTestQuestion?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(12000)
  lastTestAnswer?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsIn(['helpful', 'wrong'])
  lastTestFeedback?: 'helpful' | 'wrong';

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(100)
  goLiveAt?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(3650)
  chatRetentionDays?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(3650)
  leadRetentionDays?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(3650)
  reportRetentionDays?: number;
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
