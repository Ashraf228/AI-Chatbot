import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../db/prisma.service';

type SiteConfig = {
  siteKey?: string;
  domain?: string;
  brandColor?: string;
  accentColor?: string;
  welcomeMessage?: string;
  privacyUrl?: string;
  isActive?: boolean;
  companyName?: string;
  botName?: string;
  logoUrl?: string;
  widgetBundleUrl?: string;
  consentRequired?: boolean;
  leadCaptureEnabled?: boolean;
  suggestedQuestionsByPath?: Record<string, string[]>;
  systemPrompt?: string;
};

type SiteRow = {
  id: string;
  tenant_id: string;
  name: string;
  public_key: string;
  allowed_domains: string[] | null;
  config: unknown;
  created_at: string;
};

type LeadRow = {
  id: string;
  site_id: string;
  session_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
  site_name?: string;
};

type TotalSessionsRow = { total_sessions: number };
type EventsSummaryRow = {
  widget_impressions: number;
  widget_openings: number;
  started_chats: number;
  fallback_answers: number;
};
type LeadsCountRow = { leads: number };
type AverageDurationRow = { average_duration: number };
type CountedContentRow = { content: string; total: number };
type CountedPageRow = { page_url: string; total: number };
type MessageCountsRow = { user_messages: number; assistant_messages: number };
type DropOffSessionsRow = { drop_off_sessions: number };
type ReportSubscriptionRow = {
  id: string;
  site_id: string;
  recipient_email: string;
  frequency: string;
  is_enabled: boolean;
};
type ReportRunRow = {
  id: string;
  site_id: string | null;
  frequency: string;
  trigger_source: string;
  status: string;
  recipient_email: string | null;
  report_subject: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  site_name: string | null;
};
type RecipientRow = { recipient_email: string };

function parseSiteConfig(value: unknown): SiteConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as SiteConfig;
}

@Injectable()
export class WidgetAdminService {
  constructor(private readonly db: PrismaService) {}

  async getSite(siteId: string) {
    const res = await this.db.query<SiteRow>(
      `SELECT
         s.id,
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
      siteKey: config.siteKey || row.id,
      publicKey: row.public_key,
      allowedDomains: row.allowed_domains || [],
      domain: config.domain || row.allowed_domains?.[0] || '',
      brandColor: config.brandColor || '#b55400',
      accentColor: config.accentColor || '#fff0d9',
      welcomeMessage: config.welcomeMessage || 'Hi! Wie kann ich helfen?',
      privacyUrl: config.privacyUrl || '',
      isActive: config.isActive ?? true,
      companyName: config.companyName || row.name,
      botName: config.botName || 'Service-Assistent',
      logoUrl: config.logoUrl || '',
      widgetBundleUrl: config.widgetBundleUrl || process.env.PUBLIC_WIDGET_BUNDLE_URL || '',
      consentRequired: config.consentRequired ?? true,
      leadCaptureEnabled: config.leadCaptureEnabled ?? true,
      suggestedQuestionsByPath: config.suggestedQuestionsByPath || {},
      systemPrompt: config.systemPrompt || '',
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
      welcomeMessage: payload.welcomeMessage ?? site.welcomeMessage,
      privacyUrl: payload.privacyUrl ?? site.privacyUrl,
    };

    await this.db.query(
      `UPDATE sites
       SET config = config || $2::jsonb
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
      suggestedQuestionsByPath?: Record<string, string[]>;
      systemPrompt?: string;
      allowedDomains?: string[];
    },
  ) {
    const site = await this.getSite(siteId);
    const allowedDomains =
      payload.allowedDomains && payload.allowedDomains.length > 0
        ? payload.allowedDomains
        : payload.domain
          ? [payload.domain]
          : site.allowedDomains;

    const nextConfig = {
      siteKey: payload.siteKey ?? site.siteKey,
      domain: payload.domain ?? site.domain,
      isActive: payload.isActive ?? site.isActive,
      widgetBundleUrl: payload.widgetBundleUrl ?? site.widgetBundleUrl,
      consentRequired: payload.consentRequired ?? site.consentRequired,
      leadCaptureEnabled: payload.leadCaptureEnabled ?? site.leadCaptureEnabled,
      suggestedQuestionsByPath:
        payload.suggestedQuestionsByPath ?? site.suggestedQuestionsByPath,
      systemPrompt: payload.systemPrompt ?? site.systemPrompt,
    };

    await this.db.query(
      `UPDATE sites
       SET allowed_domains = $2,
           config = config || $3::jsonb
       WHERE id = $1`,
      [siteId, allowedDomains, JSON.stringify(nextConfig)],
    );

    return this.getSite(siteId);
  }

  async listLeads(params: { siteId?: string; status?: string }) {
    const values: string[] = [];
    const where: string[] = [];

    if (params.siteId) {
      values.push(params.siteId);
      where.push(`l.site_id = $${values.length}`);
    }

    if (params.status) {
      values.push(params.status);
      where.push(`l.status = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const res = await this.db.query<LeadRow>(
      `SELECT
         l.id,
         l.site_id,
         l.session_id,
         l.name,
         l.email,
         l.phone,
         l.message,
         l.status,
         l.created_at,
         s.name AS site_name
       FROM widget_leads l
       JOIN sites s ON s.id = l.site_id
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT 200`,
      values,
    );

    return res.rows.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      siteName: row.site_name,
      sessionId: row.session_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  async updateLead(id: string, payload: { status: string }) {
    const res = await this.db.query<LeadRow>(
      `UPDATE widget_leads
       SET status = $2
       WHERE id = $1
       RETURNING id, site_id, session_id, name, email, phone, message, status, created_at`,
      [id, payload.status],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Lead not found');
    }

    return {
      id: row.id,
      siteId: row.site_id,
      sessionId: row.session_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  async getSummary(siteId?: string) {
    const siteFilter = siteId ? `WHERE ws.site_id = $1` : '';
    const params = siteId ? [siteId] : [];

    const [sessionsRes, eventsRes, leadsRes, avgDurationRes, topQuestionsRes, activePagesRes, messagesRes] =
      await Promise.all([
        this.db.query<TotalSessionsRow>(
          `SELECT COUNT(*)::int AS total_sessions
           FROM widget_sessions ws
           ${siteFilter}`,
          params,
        ),
        this.db.query<EventsSummaryRow>(
          `SELECT
             COUNT(*) FILTER (WHERE event_type = 'impression')::int AS widget_impressions,
             COUNT(*) FILTER (WHERE event_type = 'open')::int AS widget_openings,
             COUNT(*) FILTER (WHERE event_type = 'chat_started')::int AS started_chats,
             COUNT(*) FILTER (
               WHERE event_type = 'fallback'
                 OR COALESCE((metadata->>'fallback')::boolean, false) = true
             )::int AS fallback_answers
           FROM widget_events
          ${siteId ? 'WHERE site_id = $1' : ''}`,
          params,
        ),
        this.db.query<LeadsCountRow>(
          `SELECT COUNT(*)::int AS leads
           FROM widget_leads
           ${siteId ? 'WHERE site_id = $1' : ''}`,
          params,
        ),
        this.db.query<AverageDurationRow>(
          `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (last_seen_at - started_at))), 0)::float AS average_duration
           FROM widget_sessions ws
           ${siteFilter}`,
          params,
        ),
        this.db.query<CountedContentRow>(
          `SELECT m.content, COUNT(*)::int AS total
           FROM conversations c
           JOIN messages m ON m.conversation_id = c.id
           ${siteId ? 'WHERE c.site_id = $1 AND m.role = \'user\'' : 'WHERE m.role = \'user\''}
           GROUP BY m.content
           ORDER BY total DESC
           LIMIT 5`,
          params,
        ),
        this.db.query<CountedPageRow>(
          `SELECT page_url, COUNT(*)::int AS total
           FROM widget_events
           ${siteId ? 'WHERE site_id = $1' : ''}
           GROUP BY page_url
           ORDER BY total DESC
           LIMIT 5`,
          params,
        ),
        this.db.query<MessageCountsRow>(
          `SELECT
             COUNT(*) FILTER (WHERE m.role = 'user')::int AS user_messages,
             COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS assistant_messages
           FROM conversations c
           JOIN messages m ON m.conversation_id = c.id
           ${siteId ? 'WHERE c.site_id = $1' : ''}`,
          params,
        ),
      ]);

    const totalSessions = sessionsRes.rows[0]?.total_sessions || 0;
    const leads = leadsRes.rows[0]?.leads || 0;
    const userMessages = messagesRes.rows[0]?.user_messages || 0;
    const assistantMessages = messagesRes.rows[0]?.assistant_messages || 0;
    const fallbackAnswers = eventsRes.rows[0]?.fallback_answers || 0;
    const startedChats = eventsRes.rows[0]?.started_chats || totalSessions;
    const aiAnswerRate = userMessages > 0 ? assistantMessages / userMessages : 0;
    const estimatedSupportRelief = Math.round(assistantMessages * 0.65);

    return {
      widgetImpressions: eventsRes.rows[0]?.widget_impressions || 0,
      widgetOpenings: eventsRes.rows[0]?.widget_openings || 0,
      startedChats,
      sentMessages: userMessages,
      aiAnswerRate,
      fallbackAnswers,
      leads,
      leadRate: startedChats > 0 ? leads / startedChats : 0,
      averageConversationDurationSeconds:
        Number(avgDurationRes.rows[0]?.average_duration || 0),
      estimatedSupportRelief,
      topQuestions: topQuestionsRes.rows.map((row) => ({
        question: row.content,
        count: row.total,
      })),
      mostActivePages: activePagesRes.rows.map((row) => ({
        pageUrl: row.page_url,
        count: row.total,
      })),
    };
  }

  async getOptimization(siteId?: string) {
    const summary = await this.getSummary(siteId);
    const params = siteId ? [siteId] : [];
    const dropOffWhere = siteId ? `WHERE ws.site_id = $1` : 'WHERE 1=1';

    const [unansweredRes, dropOffRes] = await Promise.all([
      this.db.query<CountedContentRow>(
        `SELECT m.content, COUNT(*)::int AS total
         FROM conversations c
         JOIN messages m ON m.conversation_id = c.id
         ${siteId ? 'WHERE c.site_id = $1 AND m.role = \'user\'' : 'WHERE m.role = \'user\''}
         GROUP BY c.id, m.id, m.content
         HAVING NOT EXISTS (
           SELECT 1
           FROM messages m2
           WHERE m2.conversation_id = c.id
             AND m2.role = 'assistant'
             AND m2.created_at > m.created_at
         )
         ORDER BY total DESC
         LIMIT 10`,
        params,
      ),
      this.db.query<DropOffSessionsRow>(
        `SELECT COUNT(*)::int AS drop_off_sessions
         FROM widget_sessions ws
         ${dropOffWhere}
         AND NOT EXISTS (
           SELECT 1 FROM widget_leads wl WHERE wl.session_id = ws.id
         )
         AND EXTRACT(EPOCH FROM (ws.last_seen_at - ws.started_at)) < 60`,
        params,
      ),
    ]);

    const recommendations: string[] = [];
    if (summary.fallbackAnswers > 3) {
      recommendations.push('Fallback-Antworten sind hoch. Trainingsdaten und Regeln fuer diese Fragen nachziehen.');
    }
    if (summary.leadRate < 0.08) {
      recommendations.push('Lead-Rate ist niedrig. CTA und Lead-Capture-Zeitpunkt im Widget schärfen.');
    }
    if (summary.aiAnswerRate < 0.9) {
      recommendations.push('Antwortquote pruefen. Streaming, Timeout-Handling und Wissensbasis kontrollieren.');
    }

    return {
      ...summary,
      unansweredQuestions: unansweredRes.rows.map((row) => ({
        question: row.content,
        count: row.total,
      })),
      dropOffSessions: dropOffRes.rows[0]?.drop_off_sessions || 0,
      recommendations,
    };
  }

  async listReportSubscriptions(siteId?: string) {
    const res = await this.db.query<ReportSubscriptionRow>(
      `SELECT id, site_id, recipient_email, frequency, is_enabled
       FROM report_subscriptions
       ${siteId ? 'WHERE site_id = $1' : ''}
       ORDER BY site_id ASC, recipient_email ASC`,
      siteId ? [siteId] : [],
    );

    return res.rows.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      recipientEmail: row.recipient_email,
      frequency: row.frequency,
      isEnabled: row.is_enabled,
    }));
  }

  async listReportRuns(siteId?: string) {
    const res = await this.db.query<ReportRunRow>(
      `SELECT
         rr.id,
         rr.site_id,
         rr.frequency,
         rr.trigger_source,
         rr.status,
         rr.recipient_email,
         rr.report_subject,
         rr.error_message,
         rr.created_at,
         rr.completed_at,
         s.name AS site_name
       FROM report_runs rr
       LEFT JOIN sites s ON s.id = rr.site_id
       ${siteId ? 'WHERE rr.site_id = $1' : ''}
       ORDER BY rr.created_at DESC
       LIMIT 100`,
      siteId ? [siteId] : [],
    );

    return res.rows.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      siteName: row.site_name,
      frequency: row.frequency,
      triggerSource: row.trigger_source,
      status: row.status,
      recipientEmail: row.recipient_email,
      reportSubject: row.report_subject,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
  }

  async createReportSubscription(payload: {
    siteId: string;
    recipientEmail: string;
    frequency: string;
    isEnabled?: boolean;
  }) {
    await this.getSite(payload.siteId);
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO report_subscriptions(id, site_id, recipient_email, frequency, is_enabled)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, payload.siteId, payload.recipientEmail, payload.frequency, payload.isEnabled ?? true],
    );

    return {
      id,
      siteId: payload.siteId,
      recipientEmail: payload.recipientEmail,
      frequency: payload.frequency,
      isEnabled: payload.isEnabled ?? true,
    };
  }

  async updateReportSubscription(
    id: string,
    payload: { recipientEmail?: string; frequency?: string; isEnabled?: boolean },
  ) {
    const current = await this.db.query<ReportSubscriptionRow>(
      `SELECT id, site_id, recipient_email, frequency, is_enabled
       FROM report_subscriptions
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const row = current.rows[0];
    if (!row) {
      throw new NotFoundException('Report subscription not found');
    }

    const next = {
      recipientEmail: payload.recipientEmail ?? row.recipient_email,
      frequency: payload.frequency ?? row.frequency,
      isEnabled: payload.isEnabled ?? row.is_enabled,
    };

    await this.db.query(
      `UPDATE report_subscriptions
       SET recipient_email = $2,
           frequency = $3,
           is_enabled = $4
       WHERE id = $1`,
      [id, next.recipientEmail, next.frequency, next.isEnabled],
    );

    return {
      id: row.id,
      siteId: row.site_id,
      recipientEmail: next.recipientEmail,
      frequency: next.frequency,
      isEnabled: next.isEnabled,
    };
  }

  async deleteReportSubscription(id: string) {
    await this.db.query(`DELETE FROM report_subscriptions WHERE id = $1`, [id]);
    return { ok: true, deletedId: id };
  }

  async runReport(payload: { siteId?: string; frequency?: string }) {
    let recipientEmail: string | null = null;
    let siteName: string | null = null;
    if (payload.siteId) {
      const site = await this.getSite(payload.siteId);
      siteName = site.name;
      const sub = await this.db.query<RecipientRow>(
        `SELECT recipient_email
         FROM report_subscriptions
         WHERE site_id = $1 AND is_enabled = true
         ORDER BY recipient_email ASC
         LIMIT 1`,
        [payload.siteId],
      );
      recipientEmail = sub.rows[0]?.recipient_email || null;
    }

    const frequency = payload.frequency || 'weekly';
    const runId = randomUUID();
    const subject = siteName ? `${frequency} report for ${siteName}` : `${frequency} report`;

    await this.db.query(
      `INSERT INTO report_runs(
         id, site_id, frequency, trigger_source, status, recipient_email, report_subject, created_at, completed_at
       )
       VALUES ($1, $2, $3, 'manual', 'queued', $4, $5, now(), now())`,
      [runId, payload.siteId || null, frequency, recipientEmail, subject],
    );

    return {
      ok: true,
      triggered: true,
      runId,
      siteId: payload.siteId || null,
      frequency,
      message: 'Report job accepted for processing.',
    };
  }
}
