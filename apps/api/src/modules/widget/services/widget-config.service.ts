import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';
import { SiteEntity } from '../entities/site.entity';

type WidgetConfigRow = {
  id: string;
  site_key: string;
  tenant_id: string | null;
  name: string;
  domain: string;
  brand_color: string;
  accent_color: string;
  font_family: string;
  welcome_message: string;
  privacy_url: string;
  is_active: boolean;
  company_name: string;
  bot_name: string;
  logo_url: string;
  public_key: string | null;
  widget_bundle_url: string;
  consent_required: boolean;
  lead_capture_enabled: boolean;
  lead_notification_email: string;
  suggested_questions_by_path: Record<string, string[]>;
  conversation_flow: Record<string, unknown>;
  system_prompt: string;
  industry: string;
};

const LOCAL_SERVICE_SUGGESTED_QUESTIONS = {
  '/': [
    'Was ist gerade betroffen?',
    'Was kostet der Einsatz?',
    'Ich brauche einen Rückruf',
  ],
};

@Injectable()
export class WidgetConfigService {
  constructor(private readonly db: PrismaService) {}

  async getPublicConfig(siteKey: string) {
    const site = await this.getSiteByKey(siteKey);
    if (!site.isActive) {
      throw new ForbiddenException('Site inactive');
    }

    return {
      siteId: site.id,
      siteKey: site.siteKey,
      publicKey: site.publicKey || '',
      apiBase: process.env.PUBLIC_API_BASE_URL || '',
      title: site.name || 'Support',
      greeting: normalizeWelcomeMessage(site.industry, site.welcomeMessage),
      placeholder: 'Nachricht schreiben...',
      buttonText: 'Chat',
      position: 'bottom-right',
      consentRequired: site.consentRequired,
      leadCaptureEnabled: site.leadCaptureEnabled,
      widgetBundleUrl: site.widgetBundleUrl || process.env.PUBLIC_WIDGET_BUNDLE_URL || '',
      companyName: site.companyName || site.name,
      botName: site.botName,
      logoUrl: site.logoUrl,
      theme: {
        brandColor: site.brandColor,
        accentColor: site.accentColor,
        fontFamily: site.fontFamily,
      },
      suggestedQuestionsByPath:
        normalizeSuggestedQuestions(site.industry, site.suggestedQuestionsByPath) || {
          '/': ['Was kostet der Service?', 'Wie schnell koennt ihr helfen?'],
        },
      privacyUrl: site.privacyUrl,
      domain: site.domain,
      isActive: site.isActive,
    };
  }

  async getSiteByKey(siteKey: string): Promise<
    SiteEntity & {
      publicKey?: string;
      tenantId?: string;
      widgetBundleUrl?: string;
      consentRequired: boolean;
      leadCaptureEnabled: boolean;
      leadNotificationEmail?: string;
      suggestedQuestionsByPath?: Record<string, string[]>;
      conversationFlow?: unknown;
      systemPrompt?: string;
      industry?: string;
    }
  > {
    const res = await this.db.query<WidgetConfigRow>(
      `SELECT id, tenant_id, name, domain, brand_color, accent_color, font_family, welcome_message,
              site_key,
              privacy_url, is_active, company_name, bot_name, logo_url, public_key,
              widget_bundle_url, consent_required, lead_capture_enabled, suggested_questions_by_path,
              lead_notification_email, conversation_flow, system_prompt, industry
       FROM (
         SELECT
           s.id,
           s.site_key,
           s.tenant_id,
           s.name,
           COALESCE(s.config->>'domain', s.allowed_domains[1], '') AS domain,
           COALESCE(s.config->>'brandColor', '#b55400') AS brand_color,
      COALESCE(s.config->>'accentColor', '#fff0d9') AS accent_color,
      COALESCE(s.config->>'fontFamily', 'system') AS font_family,
      COALESCE(s.config->>'welcomeMessage', 'Hi! Wie kann ich helfen?') AS welcome_message,
           COALESCE(s.config->>'privacyUrl', '') AS privacy_url,
           COALESCE((s.config->>'isActive')::boolean, true) AS is_active,
           COALESCE(s.config->>'companyName', s.name) AS company_name,
           COALESCE(s.config->>'botName', 'Service-Assistent') AS bot_name,
           COALESCE(s.config->>'logoUrl', '') AS logo_url,
           s.public_key,
           COALESCE(s.config->>'widgetBundleUrl', '') AS widget_bundle_url,
           COALESCE((s.config->>'consentRequired')::boolean, true) AS consent_required,
           COALESCE((s.config->>'leadCaptureEnabled')::boolean, true) AS lead_capture_enabled,
           COALESCE(s.config->'suggestedQuestionsByPath', '{}'::jsonb) AS suggested_questions_by_path,
           COALESCE(s.config->>'leadNotificationEmail', '') AS lead_notification_email,
           COALESCE(s.config->'conversationFlow', '{}'::jsonb) AS conversation_flow,
           COALESCE(s.config->>'systemPrompt', '') AS system_prompt,
           COALESCE(s.config->>'industry', s.config->>'industryTemplate', '') AS industry
         FROM sites s
         WHERE s.site_key = $1
         LIMIT 1
       ) site`,
      [siteKey],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Unknown siteKey');
    }

    if (!row.is_active) {
      throw new ForbiddenException('Site inactive');
    }

    return {
      id: row.id,
      name: row.name,
      siteKey: row.site_key,
      domain: row.domain,
      companyName: row.company_name,
      botName: row.bot_name,
      logoUrl: row.logo_url,
      brandColor: row.brand_color,
      accentColor: row.accent_color,
      fontFamily: row.font_family,
      welcomeMessage: row.welcome_message,
      privacyUrl: row.privacy_url,
      isActive: row.is_active,
      publicKey: row.public_key ?? undefined,
      tenantId: row.tenant_id ?? undefined,
      widgetBundleUrl: row.widget_bundle_url,
      consentRequired: row.consent_required,
      leadCaptureEnabled: row.lead_capture_enabled,
      leadNotificationEmail: row.lead_notification_email || undefined,
      suggestedQuestionsByPath: row.suggested_questions_by_path,
      conversationFlow: row.conversation_flow,
      systemPrompt: row.system_prompt || undefined,
      industry: row.industry || undefined,
    };
  }
}

function normalizeSuggestedQuestions(
  industry: string | undefined,
  questions: Record<string, string[]> | undefined,
) {
  if (!isLocalServiceIndustry(industry || '')) {
    return questions;
  }

  if (!questions || Object.keys(questions).length === 0 || hasGenericBusinessQuestions(questions)) {
    return LOCAL_SERVICE_SUGGESTED_QUESTIONS;
  }

  return questions;
}

function normalizeWelcomeMessage(industry: string | undefined, message: string) {
  if (!isLocalServiceIndustry(industry || '')) {
    return message;
  }

  return message
    .replace(/^\s*hey!?/i, 'Guten Tag')
    .replace(/\bbei dir\b/gi, 'bei Ihnen')
    .replace(/\bfür dich\b/gi, 'für Sie')
    .replace(/\bmit dir\b/gi, 'mit Ihnen')
    .replace(/\bdeine\b/gi, 'Ihre')
    .replace(/\bdeinen\b/gi, 'Ihren')
    .replace(/\bdeinem\b/gi, 'Ihrem')
    .replace(/\bdeiner\b/gi, 'Ihrer')
    .replace(/\bdein\b/gi, 'Ihr')
    .replace(/\bdir\b/gi, 'Ihnen')
    .replace(/\bdich\b/gi, 'Sie')
    .replace(/\bdu\b/gi, 'Sie');
}

function hasGenericBusinessQuestions(questions: Record<string, string[]>) {
  return Object.values(questions)
    .flat()
    .some((question) => /projekt|support|business|automatisierung|beratungsgespräch/i.test(question));
}

function isLocalServiceIndustry(value: string) {
  return ['local-services', 'local_service', 'local-service', 'local_services'].includes(value);
}
