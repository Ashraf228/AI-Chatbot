import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../db/prisma.service';
import { EmailJobsService } from './email-jobs.service';
import { ReportMailerService } from './report-mailer.service';
import { ReportPayload, ReportRendererService } from './report-renderer.service';
import { WidgetAdminSiteService } from './widget-admin-site.service';

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

@Injectable()
export class WidgetAdminReportsService {
  constructor(
    private readonly db: PrismaService,
    private readonly reportMailer: ReportMailerService,
    private readonly emailJobs: EmailJobsService,
    private readonly siteAdmin: WidgetAdminSiteService,
  ) {}

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
             COUNT(*) FILTER (WHERE event_type IN ('impression', 'widget_loaded', 'widget_impression'))::int AS widget_impressions,
             COUNT(*) FILTER (WHERE event_type IN ('open', 'widget_opened'))::int AS widget_openings,
             COUNT(*) FILTER (WHERE event_type = 'chat_started')::int AS started_chats,
             COUNT(*) FILTER (
               WHERE event_type IN ('fallback', 'fallback_answer')
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
    await this.siteAdmin.getSite(payload.siteId);
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

  async deleteReportRun(id: string, actor: { actorId?: string; actorRole?: string } = {}) {
    const deleted = await this.db.query<{ id: string; site_id: string | null }>(
      `DELETE FROM report_runs WHERE id = $1 RETURNING id, site_id`,
      [id],
    );
    const row = deleted.rows[0];
    if (!row) {
      throw new NotFoundException('Report run not found');
    }

    if (row.site_id) {
      const site = await this.db.query<{ tenant_id: string | null }>(
        `SELECT tenant_id FROM sites WHERE id = $1 LIMIT 1`,
        [row.site_id],
      );
      await this.db.query(
        `INSERT INTO audit_logs(
           id, site_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, metadata, created_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
        [
          randomUUID(),
          row.site_id,
          site.rows[0]?.tenant_id || null,
          actor.actorId || 'dashboard',
          actor.actorRole || 'admin',
          'report.deleted',
          'report',
          id,
          JSON.stringify({}),
        ],
      );
    }

    return { ok: true, deletedReportRunId: id };
  }

  async runReport(payload: { siteId?: string; frequency?: string }) {
    if (!payload.siteId) {
      throw new BadRequestException('siteId is required to run a report manually.');
    }

    const site = await this.siteAdmin.getSite(payload.siteId);
    const sub = await this.db.query<RecipientRow>(
      `SELECT recipient_email
       FROM report_subscriptions
       WHERE site_id = $1 AND is_enabled = true
       ORDER BY recipient_email ASC
       LIMIT 1`,
      [payload.siteId],
    );
    const recipientEmail = sub.rows[0]?.recipient_email || null;
    if (!recipientEmail) {
      throw new BadRequestException('No active report recipient configured for this site.');
    }

    this.reportMailer.assertConfigured();
    const frequency = payload.frequency || 'weekly';
    const runId = randomUUID();
    const subject = site.name ? `${frequency} report for ${site.name}` : `${frequency} report`;

    await this.db.query(
      `INSERT INTO report_runs(
         id, site_id, frequency, trigger_source, status, recipient_email, report_subject, created_at, completed_at
       )
       VALUES ($1, $2, $3, 'manual', 'queued', $4, $5, now(), null)`,
      [runId, payload.siteId, frequency, recipientEmail, subject],
    );

    try {
      const report = await this.buildReportPayload(payload.siteId, recipientEmail, frequency);
      const renderer = new ReportRendererService();

      await this.emailJobs.enqueue({
        kind: 'report',
        to: recipientEmail,
        subject,
        html: renderer.renderHtml(report),
        text: renderer.renderText(report),
        metadata: {
          reportRunId: runId,
          siteId: payload.siteId,
          frequency,
        },
      });

      return {
        ok: true,
        triggered: true,
        runId,
        siteId: payload.siteId,
        frequency,
        recipientEmail,
        message: 'Report queued successfully.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown report error';
      await this.db.query(
        `UPDATE report_runs
         SET status = 'failed',
             completed_at = now(),
             error_message = $2
         WHERE id = $1`,
        [runId, message],
      );
      throw error;
    }
  }

  private async buildReportPayload(
    siteId: string,
    recipientEmail: string,
    frequency: string,
  ): Promise<ReportPayload> {
    const [site, summary, optimization] = await Promise.all([
      this.siteAdmin.getSite(siteId),
      this.getSummary(siteId),
      this.getOptimization(siteId),
    ]);

    const reportFrequency = frequency === 'monthly' ? 'monthly' : 'weekly';

    return {
      frequency: reportFrequency,
      siteId,
      siteName: site.companyName || site.name || siteId,
      periodLabel: reportFrequency === 'weekly' ? 'Woche' : 'Monat',
      recipientEmail,
      metrics: {
        widgetImpressions: Number(summary.widgetImpressions || 0),
        widgetOpenings: Number(summary.widgetOpenings || 0),
        startedChats: Number(summary.startedChats || 0),
        sentMessages: Number(summary.sentMessages || 0),
        aiAnswerRate: Number(summary.aiAnswerRate || 0),
        fallbackAnswers: Number(summary.fallbackAnswers || 0),
        leads: Number(summary.leads || 0),
        leadRate: Number(summary.leadRate || 0),
        averageConversationDurationSeconds: Number(summary.averageConversationDurationSeconds || 0),
        estimatedSupportRelief: Number(summary.estimatedSupportRelief || 0),
        topQuestions: Array.isArray(summary.topQuestions) ? summary.topQuestions : [],
        mostActivePages: Array.isArray(summary.mostActivePages)
          ? summary.mostActivePages.map((item) => ({
              pageUrl: item.pageUrl,
              impressions: Number(item.count || 0),
              openings: Number(item.count || 0),
            }))
          : [],
        unansweredQuestions: Array.isArray(optimization.unansweredQuestions)
          ? optimization.unansweredQuestions.length
          : 0,
        dropOffRate:
          Number(summary.startedChats || 0) > 0
            ? Number(optimization.dropOffSessions || 0) / Number(summary.startedChats || 1)
            : 0,
      },
      recommendations:
        Array.isArray(optimization.recommendations) && optimization.recommendations.length > 0
          ? optimization.recommendations.map((detail) => ({
              title: 'Empfehlung',
              detail,
            }))
          : [
              {
                title: 'Stabile Entwicklung',
                detail: 'Aktuell sind keine kritischen Optimierungsauffaelligkeiten im Report vorhanden.',
              },
            ],
    };
  }
}
