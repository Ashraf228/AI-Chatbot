import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';
import { SiteEntity } from '../entities/site.entity';

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
      greeting: site.welcomeMessage,
      placeholder: 'Nachricht schreiben...',
      buttonText: 'Chat',
      position: 'bottom-right',
      consentRequired: true,
      leadCaptureEnabled: true,
      widgetBundleUrl: site.widgetBundleUrl || process.env.PUBLIC_WIDGET_BUNDLE_URL || '',
      companyName: site.companyName || site.name,
      botName: site.botName,
      logoUrl: site.logoUrl,
      theme: {
        brandColor: site.brandColor,
        accentColor: site.accentColor,
      },
      suggestedQuestionsByPath:
        site.suggestedQuestionsByPath || {
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
      suggestedQuestionsByPath?: Record<string, string[]>;
    }
  > {
    const res = await this.db.query<any>(
      `SELECT id, tenant_id, name, domain, brand_color, accent_color, welcome_message,
              privacy_url, is_active, company_name, bot_name, logo_url, public_key,
              widget_bundle_url, suggested_questions_by_path
       FROM (
         SELECT
           s.id,
           s.tenant_id,
           s.name,
           COALESCE(s.config->>'domain', s.allowed_domains[1], '') AS domain,
           COALESCE(s.config->>'brandColor', '#b55400') AS brand_color,
           COALESCE(s.config->>'accentColor', '#fff0d9') AS accent_color,
           COALESCE(s.config->>'welcomeMessage', 'Hi! Wie kann ich helfen?') AS welcome_message,
           COALESCE(s.config->>'privacyUrl', '') AS privacy_url,
           COALESCE((s.config->>'isActive')::boolean, true) AS is_active,
           COALESCE(s.config->>'companyName', s.name) AS company_name,
           COALESCE(s.config->>'botName', 'Service-Assistent') AS bot_name,
           COALESCE(s.config->>'logoUrl', '') AS logo_url,
           s.public_key,
           COALESCE(s.config->>'widgetBundleUrl', '') AS widget_bundle_url,
           COALESCE(s.config->'suggestedQuestionsByPath', '{}'::jsonb) AS suggested_questions_by_path
         FROM sites s
         WHERE COALESCE(s.config->>'siteKey', s.id) = $1
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
      siteKey,
      domain: row.domain,
      companyName: row.company_name,
      botName: row.bot_name,
      logoUrl: row.logo_url,
      brandColor: row.brand_color,
      accentColor: row.accent_color,
      welcomeMessage: row.welcome_message,
      privacyUrl: row.privacy_url,
      isActive: row.is_active,
      publicKey: row.public_key,
      tenantId: row.tenant_id,
      widgetBundleUrl: row.widget_bundle_url,
      suggestedQuestionsByPath: row.suggested_questions_by_path,
    };
  }
}
