import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

export const ESTIMATED_SUPPORT_MINUTES_PER_CONVERSATION = 4;

type CountRow = { count: string };
type SiteRow = {
  id: string;
  name: string;
  tenant_id: string | null;
  site_key: string;
  allowed_domains: string[] | null;
  config: Record<string, unknown> | null;
};
type RecentConversationRow = {
  id: string;
  site_id: string;
  site_name: string;
  session_id: string;
  last_active_at: string;
  message_count: string;
  last_message: string | null;
  has_lead: boolean;
  has_handoff: boolean;
  has_ticket: boolean;
};
type RecentLeadRow = {
  id: string;
  site_id: string;
  site_name: string;
  session_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
};
type QuestionRow = { question: string; count: string };
type ActivityRow = {
  id: string;
  label: string;
  status: string;
  created_at: string;
};
type TimeSeriesRow = { day: string; count: string };

type SiteMetric = {
  siteId: string;
  conversations7d: number;
  leads7d: number;
  conversionRate: number;
};

type SiteSummaryInput = {
  siteIds: string[];
  siteId?: string;
};

function toNumber(value: string | number | null | undefined) {
  return Number(value || 0);
}

function percentage(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 1000) / 10;
}

function parseConfig(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

@Injectable()
export class BusinessAnalyticsService {
  constructor(private readonly db: PrismaService) {}

  async buildDashboardSummary(siteIds: string[]) {
    if (siteIds.length === 0) {
      return this.emptySummary([]);
    }

    const [summary, sites, recentConversations, recentLeads, actions] = await Promise.all([
      this.buildSummary({ siteIds }),
      this.listSitesWithMetrics(siteIds),
      this.listRecentConversations(siteIds, 5),
      this.listRecentLeads(siteIds, 5),
      this.recommendedActions(siteIds),
    ]);

    return {
      ...summary,
      activeSites: sites.filter((site) => site.isActive).length,
      sites,
      recentConversations,
      recentLeads,
      recommendedActions: actions,
    };
  }

  async buildSiteSummary(siteId: string) {
    const [summary, sources, recentConversations, recentLeads, activity, actions, topQuestions, unansweredQuestions] =
      await Promise.all([
        this.buildSummary({ siteIds: [siteId], siteId }),
        this.knowledgeStatus(siteId),
        this.listRecentConversations([siteId], 8),
        this.listRecentLeads([siteId], 8),
        this.listRecentActivity(siteId),
        this.recommendedActions([siteId]),
        this.topQuestions([siteId], 8),
        this.unansweredQuestions([siteId], 8),
      ]);

    return {
      ...summary,
      knowledge: sources,
      recentConversations,
      recentLeads,
      recentActivity: activity,
      recommendedActions: actions,
      topQuestions,
      unansweredQuestions,
    };
  }

  private async buildSummary(input: SiteSummaryInput) {
    const siteIds = input.siteIds;
    const [
      totalConversations,
      conversationsToday,
      conversations7d,
      leadsToday,
      leads7d,
      handoffs7d,
      toolExecutions7d,
      knowledgeTools7d,
      ticketsOpen,
      contactRequestsOpen,
      avgLatency,
      topQuestions,
      unansweredQuestions,
      conversationSeries,
      leadSeries,
    ] = await Promise.all([
      this.count(`SELECT COUNT(*)::text AS count FROM conversations WHERE site_id = ANY($1::text[])`, [siteIds]),
      this.count(`SELECT COUNT(*)::text AS count FROM conversations WHERE site_id = ANY($1::text[]) AND created_at >= date_trunc('day', now())`, [siteIds]),
      this.count(`SELECT COUNT(*)::text AS count FROM conversations WHERE site_id = ANY($1::text[]) AND created_at >= now() - interval '7 days'`, [siteIds]),
      this.count(`SELECT COUNT(*)::text AS count FROM widget_leads WHERE site_id = ANY($1::text[]) AND created_at >= date_trunc('day', now())`, [siteIds]),
      this.count(`SELECT COUNT(*)::text AS count FROM widget_leads WHERE site_id = ANY($1::text[]) AND created_at >= now() - interval '7 days'`, [siteIds]),
      this.count(
        `SELECT COUNT(*)::text AS count
         FROM agent_runs
         WHERE site_id = ANY($1::text[])
           AND created_at >= now() - interval '7 days'
           AND (agent_key = 'handoff' OR metadata->>'decisionType' = 'handoff' OR metadata->>'decision_type' = 'handoff')`,
        [siteIds],
      ),
      this.count(`SELECT COUNT(*)::text AS count FROM tool_invocations WHERE site_id = ANY($1::text[]) AND created_at >= now() - interval '7 days'`, [siteIds]),
      this.count(
        `SELECT COUNT(DISTINCT agent_run_id)::text AS count
         FROM tool_invocations
         WHERE site_id = ANY($1::text[])
           AND created_at >= now() - interval '7 days'
           AND tool_key = 'query_knowledge'
           AND status IN ('success', 'completed')`,
        [siteIds],
      ),
      this.count(`SELECT COUNT(*)::text AS count FROM agent_tickets WHERE site_id = ANY($1::text[]) AND status IN ('new', 'open')`, [siteIds]),
      this.count(`SELECT COUNT(*)::text AS count FROM agent_contact_requests WHERE site_id = ANY($1::text[]) AND status IN ('new', 'open')`, [siteIds]),
      this.averageLatency(siteIds),
      this.topQuestions(siteIds, 5),
      this.unansweredQuestions(siteIds, 5),
      this.timeSeries('conversations', siteIds),
      this.timeSeries('widget_leads', siteIds),
    ]);

    return {
      totalConversations,
      conversationsToday,
      conversations7d,
      leadsToday,
      leads7d,
      conversionRate: percentage(leads7d, conversations7d),
      handoffRate: percentage(handoffs7d, conversations7d),
      toolExecutionCount: toolExecutions7d,
      knowledgeHitRate: percentage(knowledgeTools7d, conversations7d),
      averageResponseTimeMs: avgLatency,
      estimatedSupportTimeSavedMinutes: conversations7d * ESTIMATED_SUPPORT_MINUTES_PER_CONVERSATION,
      openHandoffsOrTickets: ticketsOpen + contactRequestsOpen,
      topQuestions,
      unansweredQuestions,
      conversationsOverTime: conversationSeries,
      leadsOverTime: leadSeries,
      supportTimeAssumptionMinutes: ESTIMATED_SUPPORT_MINUTES_PER_CONVERSATION,
      scope: input.siteId ? 'site' : 'dashboard',
    };
  }

  private async listSitesWithMetrics(siteIds: string[]) {
    const [sitesRes, metrics] = await Promise.all([
      this.db.query<SiteRow>(
        `SELECT id, name, tenant_id, site_key, allowed_domains, config
         FROM sites
         WHERE id = ANY($1::text[])
         ORDER BY created_at DESC`,
        [siteIds],
      ),
      this.siteMetrics(siteIds),
    ]);
    const bySite = new Map(metrics.map((metric) => [metric.siteId, metric]));

    return sitesRes.rows.map((site) => {
      const config = parseConfig(site.config);
      const metric = bySite.get(site.id);
      return {
        id: site.id,
        name: site.name,
        domain: site.allowed_domains?.[0] || '',
        isActive: config.isActive !== false,
        isLive: Boolean(config.goLiveAt),
        siteKey: site.site_key,
        conversations7d: metric?.conversations7d || 0,
        leads7d: metric?.leads7d || 0,
        conversionRate: metric?.conversionRate || 0,
      };
    });
  }

  private async siteMetrics(siteIds: string[]): Promise<SiteMetric[]> {
    const res = await this.db.query<{
      site_id: string;
      conversations_7d: string;
      leads_7d: string;
    }>(
      `SELECT
         s.id AS site_id,
         COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= now() - interval '7 days')::text AS conversations_7d,
         COUNT(DISTINCT l.id) FILTER (WHERE l.created_at >= now() - interval '7 days')::text AS leads_7d
       FROM sites s
       LEFT JOIN conversations c ON c.site_id = s.id
       LEFT JOIN widget_leads l ON l.site_id = s.id
       WHERE s.id = ANY($1::text[])
       GROUP BY s.id`,
      [siteIds],
    );

    return res.rows.map((row) => {
      const conversations7d = toNumber(row.conversations_7d);
      const leads7d = toNumber(row.leads_7d);
      return {
        siteId: row.site_id,
        conversations7d,
        leads7d,
        conversionRate: percentage(leads7d, conversations7d),
      };
    });
  }

  private async listRecentConversations(siteIds: string[], limit: number) {
    const res = await this.db.query<RecentConversationRow>(
      `SELECT
         c.id,
         c.site_id,
         s.name AS site_name,
         c.session_id,
         c.last_active_at,
         COUNT(m.id)::text AS message_count,
         (
           SELECT m2.content
           FROM messages m2
           WHERE m2.conversation_id = c.id
           ORDER BY m2.created_at DESC
           LIMIT 1
         ) AS last_message,
         EXISTS (SELECT 1 FROM widget_leads wl WHERE wl.site_id = c.site_id AND wl.session_id = c.session_id) AS has_lead,
         EXISTS (
           SELECT 1 FROM agent_runs ar
           WHERE ar.metadata->>'conversationId' = c.id
             AND (ar.agent_key = 'handoff' OR ar.metadata->>'decisionType' = 'handoff')
         ) AS has_handoff,
         EXISTS (
           SELECT 1 FROM agent_tickets at
           JOIN agent_runs ar ON ar.id = at.agent_run_id
           WHERE at.site_id = c.site_id
             AND ar.metadata->>'conversationId' = c.id
         ) AS has_ticket
       FROM conversations c
       JOIN sites s ON s.id = c.site_id
       LEFT JOIN messages m ON m.conversation_id = c.id
       WHERE c.site_id = ANY($1::text[])
       GROUP BY c.id, s.name
       ORDER BY c.last_active_at DESC
       LIMIT $2`,
      [siteIds, limit],
    );

    return res.rows.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      siteName: row.site_name,
      sessionId: row.session_id,
      lastActiveAt: row.last_active_at,
      messageCount: toNumber(row.message_count),
      lastMessage: row.last_message || '',
      hasLead: row.has_lead,
      hasHandoff: row.has_handoff,
      hasTicket: row.has_ticket,
    }));
  }

  private async listRecentLeads(siteIds: string[], limit: number) {
    const res = await this.db.query<RecentLeadRow>(
      `SELECT wl.id, wl.site_id, s.name AS site_name, wl.session_id, wl.name, wl.email, wl.phone, wl.message, wl.status, wl.created_at
       FROM widget_leads wl
       JOIN sites s ON s.id = wl.site_id
       WHERE wl.site_id = ANY($1::text[])
       ORDER BY wl.created_at DESC
       LIMIT $2`,
      [siteIds, limit],
    );

    return res.rows.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      siteName: row.site_name,
      sessionId: row.session_id,
      name: row.name,
      email: row.email,
      phone: row.phone || '',
      message: row.message || '',
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  private async listRecentActivity(siteId: string) {
    const res = await this.db.query<ActivityRow>(
      `SELECT id, tool_key AS label, status, created_at
       FROM tool_invocations
       WHERE site_id = $1
       UNION ALL
       SELECT id, agent_key AS label, status, created_at
       FROM agent_runs
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [siteId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      label: row.label,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  private async knowledgeStatus(siteId: string) {
    const res = await this.db.query<{
      total: string;
      ready: string;
      processing: string;
      failed: string;
      active_ready: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE runtime_readiness = 'ready')::text AS ready,
         COUNT(*) FILTER (WHERE runtime_readiness <> 'ready' AND ingest_status IN ('created', 'processing', 'extracted'))::text AS processing,
         COUNT(*) FILTER (WHERE runtime_readiness = 'failed' OR ingest_status = 'failed')::text AS failed,
         COUNT(*) FILTER (WHERE runtime_readiness = 'ready' AND COALESCE(is_active, true) = true)::text AS active_ready
       FROM knowledge_sources
       WHERE site_id = $1`,
      [siteId],
    );
    const row = res.rows[0];
    return {
      total: toNumber(row?.total),
      ready: toNumber(row?.ready),
      processing: toNumber(row?.processing),
      failed: toNumber(row?.failed),
      activeReady: toNumber(row?.active_ready),
    };
  }

  private async recommendedActions(siteIds: string[]) {
    const res = await this.db.query<SiteRow>(
      `SELECT id, name, tenant_id, site_key, allowed_domains, config
       FROM sites
       WHERE id = ANY($1::text[])
       ORDER BY created_at DESC
       LIMIT 20`,
      [siteIds],
    );
    const knowledge = await this.db.query<{ site_id: string; active_ready: string }>(
      `SELECT site_id, COUNT(*) FILTER (WHERE runtime_readiness = 'ready' AND COALESCE(is_active, true) = true)::text AS active_ready
       FROM knowledge_sources
       WHERE site_id = ANY($1::text[])
       GROUP BY site_id`,
      [siteIds],
    );
    const knowledgeMap = new Map(knowledge.rows.map((row) => [row.site_id, toNumber(row.active_ready)]));

    const actions: Array<{ siteId: string; siteName: string; label: string; href: string; priority: 'high' | 'medium' | 'low' }> = [];
    for (const site of res.rows) {
      const config = parseConfig(site.config);
      if (!site.allowed_domains?.length) {
        actions.push({ siteId: site.id, siteName: site.name, label: 'Setze deine Domain frei', href: `/sites/${site.id}/setup`, priority: 'high' });
      }
      if ((knowledgeMap.get(site.id) || 0) === 0) {
        actions.push({ siteId: site.id, siteName: site.name, label: 'Füge mindestens eine Wissensquelle hinzu', href: `/sites/${site.id}/setup`, priority: 'high' });
      }
      if (!config.goLiveAt && site.site_key && site.allowed_domains?.length) {
        actions.push({ siteId: site.id, siteName: site.name, label: 'Prüfe, ob die KI bereit für Go-Live ist', href: `/sites/${site.id}/setup`, priority: 'medium' });
      }
      if (config.isActive === false) {
        actions.push({ siteId: site.id, siteName: site.name, label: 'Aktiviere dein Widget', href: `/sites/${site.id}/setup`, priority: 'medium' });
      }
    }
    return actions.slice(0, 8);
  }

  private async topQuestions(siteIds: string[], limit: number) {
    const res = await this.db.query<QuestionRow>(
      `SELECT m.content AS question, COUNT(*)::text AS count
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       WHERE c.site_id = ANY($1::text[])
         AND m.role = 'user'
       GROUP BY m.content
       ORDER BY COUNT(*) DESC
       LIMIT $2`,
      [siteIds, limit],
    );
    return res.rows.map((row) => ({ question: row.question, count: toNumber(row.count) }));
  }

  private async unansweredQuestions(siteIds: string[], limit: number) {
    const res = await this.db.query<QuestionRow>(
      `SELECT m.content AS question, COUNT(*)::text AS count
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       WHERE c.site_id = ANY($1::text[])
         AND m.role = 'user'
         AND NOT EXISTS (
           SELECT 1 FROM messages m2
           WHERE m2.conversation_id = c.id
             AND m2.role = 'assistant'
             AND m2.created_at > m.created_at
         )
       GROUP BY m.content
       ORDER BY COUNT(*) DESC
       LIMIT $2`,
      [siteIds, limit],
    );
    return res.rows.map((row) => ({ question: row.question, count: toNumber(row.count) }));
  }

  private async timeSeries(table: 'conversations' | 'widget_leads', siteIds: string[]) {
    const res = await this.db.query<TimeSeriesRow>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, COALESCE(counted.count, 0)::text AS count
       FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') AS day
       LEFT JOIN (
         SELECT date_trunc('day', created_at) AS bucket, COUNT(*) AS count
         FROM ${table}
         WHERE site_id = ANY($1::text[])
           AND created_at >= current_date - interval '6 days'
         GROUP BY bucket
       ) counted ON counted.bucket = day
       ORDER BY day ASC`,
      [siteIds],
    );
    return res.rows.map((row) => ({ date: row.day, count: toNumber(row.count) }));
  }

  private async averageLatency(siteIds: string[]) {
    const res = await this.db.query<{ latency: string }>(
      `SELECT COALESCE(AVG(latency_ms), 0)::text AS latency
       FROM usage_events
       WHERE site_id = ANY($1::text[])
         AND created_at >= now() - interval '7 days'`,
      [siteIds],
    );
    return Math.round(Number(res.rows[0]?.latency || 0));
  }

  private async count(query: string, params: unknown[]) {
    const res = await this.db.query<CountRow>(query, params);
    return toNumber(res.rows[0]?.count);
  }

  private emptySummary(siteIds: string[]) {
    return {
      totalConversations: 0,
      conversationsToday: 0,
      conversations7d: 0,
      leadsToday: 0,
      leads7d: 0,
      conversionRate: 0,
      handoffRate: 0,
      toolExecutionCount: 0,
      knowledgeHitRate: 0,
      averageResponseTimeMs: 0,
      estimatedSupportTimeSavedMinutes: 0,
      openHandoffsOrTickets: 0,
      topQuestions: [],
      unansweredQuestions: [],
      conversationsOverTime: [],
      leadsOverTime: [],
      supportTimeAssumptionMinutes: ESTIMATED_SUPPORT_MINUTES_PER_CONVERSATION,
      activeSites: 0,
      sites: siteIds,
      recentConversations: [],
      recentLeads: [],
      recommendedActions: [],
    };
  }
}
