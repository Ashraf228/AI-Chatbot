import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { resolveSiteKey } from '../../../sites/site-key';
import { PrismaService } from '../../../db/prisma.service';

type SiteConfig = {
  domain?: string;
  brandColor?: string;
  accentColor?: string;
  fontFamily?: string;
  welcomeMessage?: string;
  privacyUrl?: string;
  isActive?: boolean;
  companyName?: string;
  botName?: string;
  logoUrl?: string;
  widgetBundleUrl?: string;
  consentRequired?: boolean;
  leadCaptureEnabled?: boolean;
  leadNotificationEmail?: string;
  suggestedQuestionsByPath?: Record<string, string[]>;
  conversationFlow?: Record<string, unknown>;
  systemPrompt?: string;
  industry?: string;
  setupGoal?: 'lead_capture' | 'support' | 'product_advice' | 'appointments';
  tone?: string;
  ctaText?: string;
  templateId?: string;
  templateVersion?: number;
  templateAppliedAt?: string;
  templateAppliedBy?: string;
  templateApplyMode?: string;
  reportKpis?: string[];
  topTestQuestions?: string[];
  lastTestedAt?: string;
  goLiveAt?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  tenant_id: string;
  name: string;
  public_key: string;
  allowed_domains: string[] | null;
  config: unknown;
  created_at: string;
};

function parseSiteConfig(value: unknown): SiteConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as SiteConfig;
}

@Injectable()
export class WidgetAdminSiteService {
  constructor(private readonly db: PrismaService) {}

  private async assertUniqueSiteKey(siteKey: string, excludeId?: string) {
    const values = [siteKey];
    let query = `
      SELECT id
      FROM sites
      WHERE site_key = $1
    `;

    if (excludeId) {
      values.push(excludeId);
      query += ` AND id <> $2`;
    }

    query += ` LIMIT 1`;

    const existing = await this.db.query<{ id: string }>(query, values);
    if (existing.rows[0]) {
      throw new BadRequestException('siteKey already exists');
    }
  }

  async getSite(siteId: string) {
    const res = await this.db.query<SiteRow>(
      `SELECT
         s.id,
         s.site_key,
         s.tenant_id,
         s.name,
         s.public_key,
         s.allowed_domains,
         s.config,
         s.created_at
       FROM sites s
       WHERE s.id = $1
       LIMIT 1`,
      [siteId],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Site not found');
    }

    const config = parseSiteConfig(row.config);
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      siteKey: row.site_key,
      publicKey: row.public_key,
      allowedDomains: row.allowed_domains || [],
      domain: config.domain || row.allowed_domains?.[0] || '',
      brandColor: config.brandColor || '#b55400',
      accentColor: config.accentColor || '#fff0d9',
      fontFamily: config.fontFamily || 'system',
      welcomeMessage: config.welcomeMessage || 'Hi! Wie kann ich helfen?',
      privacyUrl: config.privacyUrl || '',
      isActive: config.isActive ?? true,
      companyName: config.companyName || row.name,
      botName: config.botName || 'Service-Assistent',
      logoUrl: config.logoUrl || '',
      widgetBundleUrl: config.widgetBundleUrl || process.env.PUBLIC_WIDGET_BUNDLE_URL || '',
      consentRequired: config.consentRequired ?? true,
      leadCaptureEnabled: config.leadCaptureEnabled ?? true,
      leadNotificationEmail: config.leadNotificationEmail || '',
      suggestedQuestionsByPath: config.suggestedQuestionsByPath || {},
      conversationFlow: config.conversationFlow || {},
      systemPrompt: config.systemPrompt || '',
      industry: config.industry || '',
      setupGoal: config.setupGoal || '',
      tone: config.tone || '',
      ctaText: config.ctaText || '',
      templateId: config.templateId || '',
      templateVersion: config.templateVersion || null,
      templateAppliedAt: config.templateAppliedAt || '',
      templateAppliedBy: config.templateAppliedBy || '',
      templateApplyMode: config.templateApplyMode || '',
      reportKpis: Array.isArray(config.reportKpis) ? config.reportKpis : [],
      topTestQuestions: Array.isArray(config.topTestQuestions) ? config.topTestQuestions : [],
      lastTestedAt: config.lastTestedAt || '',
      goLiveAt: config.goLiveAt || '',
      createdAt: row.created_at,
    };
  }

  async updateBranding(
    siteId: string,
    payload: {
      companyName?: string;
      botName?: string;
      logoUrl?: string;
      brandColor?: string;
      accentColor?: string;
      fontFamily?: string;
      welcomeMessage?: string;
      privacyUrl?: string;
    },
  ) {
    const site = await this.getSite(siteId);
    const nextConfig = {
      companyName: payload.companyName ?? site.companyName,
      botName: payload.botName ?? site.botName,
      logoUrl: payload.logoUrl ?? site.logoUrl,
      brandColor: payload.brandColor ?? site.brandColor,
      accentColor: payload.accentColor ?? site.accentColor,
      fontFamily: payload.fontFamily ?? site.fontFamily,
      welcomeMessage: payload.welcomeMessage ?? site.welcomeMessage,
      privacyUrl: payload.privacyUrl ?? site.privacyUrl,
    };

    await this.db.query(
      `UPDATE sites
       SET config = (config - 'siteKey') || $2::jsonb
       WHERE id = $1`,
      [siteId, JSON.stringify(nextConfig)],
    );

    return this.getSite(siteId);
  }

  async updateWidgetConfig(
    siteId: string,
    payload: {
      siteKey?: string;
      domain?: string;
      isActive?: boolean;
      widgetBundleUrl?: string;
      consentRequired?: boolean;
      leadCaptureEnabled?: boolean;
      leadNotificationEmail?: string;
      suggestedQuestionsByPath?: Record<string, string[]>;
      conversationFlow?: Record<string, unknown>;
      systemPrompt?: string;
      industry?: string;
      setupGoal?: 'lead_capture' | 'support' | 'product_advice' | 'appointments';
      tone?: string;
      ctaText?: string;
      templateId?: string;
      templateVersion?: number;
      templateAppliedAt?: string;
      templateAppliedBy?: string;
      templateApplyMode?: string;
      reportKpis?: string[];
      topTestQuestions?: string[];
      lastTestedAt?: string;
      goLiveAt?: string;
      allowedDomains?: string[];
    },
  ) {
    const site = await this.getSite(siteId);
    const nextSiteKey = resolveSiteKey(payload.siteKey, site.siteKey) || site.siteKey;
    await this.assertUniqueSiteKey(nextSiteKey, siteId);
    const allowedDomains =
      payload.allowedDomains && payload.allowedDomains.length > 0
        ? payload.allowedDomains
        : payload.domain
          ? [payload.domain]
          : site.allowedDomains;

    const nextConfig = {
      domain: payload.domain ?? site.domain,
      isActive: payload.isActive ?? site.isActive,
      widgetBundleUrl: payload.widgetBundleUrl ?? site.widgetBundleUrl,
      consentRequired: payload.consentRequired ?? site.consentRequired,
      leadCaptureEnabled: payload.leadCaptureEnabled ?? site.leadCaptureEnabled,
      leadNotificationEmail: payload.leadNotificationEmail ?? site.leadNotificationEmail,
      suggestedQuestionsByPath:
        payload.suggestedQuestionsByPath ?? site.suggestedQuestionsByPath,
      conversationFlow: payload.conversationFlow ?? site.conversationFlow,
      systemPrompt: payload.systemPrompt ?? site.systemPrompt,
      industry: payload.industry ?? site.industry,
      setupGoal: payload.setupGoal ?? site.setupGoal,
      tone: payload.tone ?? site.tone,
      ctaText: payload.ctaText ?? site.ctaText,
      templateId: payload.templateId ?? site.templateId,
      templateVersion: payload.templateVersion ?? site.templateVersion,
      templateAppliedAt: payload.templateAppliedAt ?? site.templateAppliedAt,
      templateAppliedBy: payload.templateAppliedBy ?? site.templateAppliedBy,
      templateApplyMode: payload.templateApplyMode ?? site.templateApplyMode,
      reportKpis: payload.reportKpis ?? site.reportKpis,
      topTestQuestions: payload.topTestQuestions ?? site.topTestQuestions,
      lastTestedAt: payload.lastTestedAt ?? site.lastTestedAt,
      goLiveAt: payload.goLiveAt ?? site.goLiveAt,
    };

    await this.db.query(
      `UPDATE sites
       SET site_key = $2,
           allowed_domains = $3,
           config = (config - 'siteKey') || $4::jsonb
       WHERE id = $1`,
      [siteId, nextSiteKey, allowedDomains, JSON.stringify(nextConfig)],
    );

    return this.getSite(siteId);
  }
}
