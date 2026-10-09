import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import type { Queryable } from '../db/database.service';
import { logEvent } from '../utils/logger';
import { LimitCheck, PlanFeatures, PlanLimits } from './billing.types';
import { SubscriptionService } from './subscription.service';

export type UsageSummary = {
  periodStart: string;
  periodEnd: string;
  messages: number;
  conversations: number;
  leads: number;
  toolExecutions: number;
  knowledgeSources: number;
  integrations: number;
  sites: number;
};

type LimitKey = keyof NonNullable<PlanLimits>;
type UsageKey = Exclude<keyof UsageSummary, 'periodStart' | 'periodEnd'>;

const LIMIT_USAGE_MAP: Record<LimitKey, UsageKey> = {
  maxSites: 'sites',
  monthlyMessages: 'messages',
  monthlyLeads: 'leads',
  maxKnowledgeSources: 'knowledgeSources',
  maxIntegrations: 'integrations',
};

const LIMIT_LABELS: Record<LimitKey, string> = {
  maxSites: 'maximale Kundenanzahl',
  monthlyMessages: 'monatliche Nachrichten',
  monthlyLeads: 'monatliche Anfragen',
  maxKnowledgeSources: 'Wissensquellen',
  maxIntegrations: 'Verbindungen',
};

const LIMIT_UPGRADE_MESSAGES: Record<LimitKey, (limit: number) => string> = {
  maxSites: (limit) => `Dein aktueller Plan erlaubt maximal ${limit} Kunden. Upgrade erforderlich.`,
  monthlyMessages: (limit) => `Dein aktueller Plan erlaubt maximal ${limit} Nachrichten pro Monat. Upgrade erforderlich.`,
  monthlyLeads: (limit) => `Dein aktueller Plan erlaubt maximal ${limit} Anfragen pro Monat. Upgrade erforderlich.`,
  maxKnowledgeSources: (limit) => `Dein aktueller Plan erlaubt maximal ${limit} Wissensquellen. Upgrade erforderlich.`,
  maxIntegrations: (limit) => `Dein aktueller Plan erlaubt maximal ${limit} Verbindungen. Upgrade erforderlich.`,
};

@Injectable()
export class UsageLimitService {
  constructor(
    private readonly db: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async getPlanLimits(tenantId: string): Promise<PlanLimits> {
    const context = await this.subscriptions.getCurrentPlan(tenantId);
    return context?.plan.limits || null;
  }

  async hasFeature(tenantId: string, featureKey: keyof PlanFeatures | string) {
    const context = await this.subscriptions.getCurrentPlan(tenantId);
    if (!context) {
      return false;
    }
    return context.plan.features?.[featureKey as keyof PlanFeatures] === true;
  }

  async getUsageSummary(tenantId: string, db: Queryable = this.db): Promise<UsageSummary> {
    const period = await this.currentPeriod();
    const [
      messages,
      conversations,
      leads,
      toolExecutions,
      knowledgeSources,
      integrations,
      sites,
    ] = await Promise.all([
      this.scalar(
        `SELECT COALESCE(SUM(user_message_count), 0)::bigint AS count
         FROM usage_daily
         WHERE tenant_id = $1 AND day >= date_trunc('month', CURRENT_DATE)::date`,
        [tenantId],
        db,
      ),
      this.scalar(
        `SELECT COUNT(*)::bigint AS count
         FROM conversations
         WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())`,
        [tenantId],
        db,
      ),
      this.scalar(
        `SELECT COUNT(*)::bigint AS count
         FROM widget_leads wl
         JOIN sites s ON s.id = wl.site_id
         WHERE s.tenant_id = $1 AND wl.created_at >= date_trunc('month', now())`,
        [tenantId],
        db,
      ),
      this.scalar(
        `SELECT COUNT(*)::bigint AS count
         FROM tool_invocations
         WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())`,
        [tenantId],
        db,
      ),
      this.scalar(
        `SELECT COUNT(*)::bigint AS count
         FROM knowledge_sources
         WHERE tenant_id = $1`,
        [tenantId],
        db,
      ),
      this.scalar(
        `SELECT COUNT(*)::bigint AS count
         FROM integration_connections
         WHERE tenant_id = $1`,
        [tenantId],
        db,
      ),
      this.scalar(`SELECT COUNT(*)::bigint AS count FROM sites WHERE tenant_id = $1`, [tenantId], db),
    ]);

    return {
      periodStart: period.period_start,
      periodEnd: period.period_end,
      messages,
      conversations,
      leads,
      toolExecutions,
      knowledgeSources,
      integrations,
      sites,
    };
  }

  async getSiteUsage(siteId: string): Promise<UsageSummary & { siteId: string; tenantId: string | null }> {
    const site = await this.db.query<{ tenant_id: string | null }>(
      `SELECT tenant_id FROM sites WHERE id = $1 LIMIT 1`,
      [siteId],
    );
    const tenantId = site.rows[0]?.tenant_id || null;
    const period = await this.currentPeriod();
    const [
      messages,
      conversations,
      leads,
      toolExecutions,
      knowledgeSources,
      integrations,
    ] = await Promise.all([
      this.scalar(
        `SELECT COALESCE(SUM(user_message_count), 0)::bigint AS count
         FROM usage_daily
         WHERE site_id = $1 AND day >= date_trunc('month', CURRENT_DATE)::date`,
        [siteId],
      ),
      this.scalar(
        `SELECT COUNT(*)::bigint AS count
         FROM conversations
         WHERE site_id = $1 AND created_at >= date_trunc('month', now())`,
        [siteId],
      ),
      this.scalar(
        `SELECT COUNT(*)::bigint AS count
         FROM widget_leads
         WHERE site_id = $1 AND created_at >= date_trunc('month', now())`,
        [siteId],
      ),
      this.scalar(
        `SELECT COUNT(*)::bigint AS count
         FROM tool_invocations
         WHERE site_id = $1 AND created_at >= date_trunc('month', now())`,
        [siteId],
      ),
      this.scalar(`SELECT COUNT(*)::bigint AS count FROM knowledge_sources WHERE site_id = $1`, [siteId]),
      this.scalar(`SELECT COUNT(*)::bigint AS count FROM integration_connections WHERE site_id = $1`, [siteId]),
    ]);

    return {
      siteId,
      tenantId,
      periodStart: period.period_start,
      periodEnd: period.period_end,
      messages,
      conversations,
      leads,
      toolExecutions,
      knowledgeSources,
      integrations,
      sites: 1,
    };
  }

  async checkLimit(tenantId: string, limitKey: LimitKey, increment = 1, db: Queryable = this.db): Promise<LimitCheck> {
    const limits = await this.getPlanLimits(tenantId);
    const limit = normalizeLimit(limits?.[limitKey]);
    const usage = await this.getUsageSummary(tenantId, db);
    const used = Number(usage[LIMIT_USAGE_MAP[limitKey]] || 0);
    const remaining = limit === null ? null : Math.max(0, limit - used);

    return {
      key: limitKey,
      limit,
      used,
      remaining,
      allowed: limit === null || used + increment <= limit,
    };
  }

  async assertWithinLimit(
    tenantId: string | null | undefined,
    limitKey: LimitKey,
    increment = 1,
    db: Queryable = this.db,
  ) {
    if (!tenantId) {
      return;
    }

    const check = await this.checkLimit(tenantId, limitKey, increment, db);
    if (check.allowed) {
      return;
    }

    const message = check.limit === null
      ? `Plan-Limit erreicht: ${LIMIT_LABELS[limitKey]}.`
      : LIMIT_UPGRADE_MESSAGES[limitKey](check.limit);

    logEvent('usage_limit_exceeded', {
      tenantId,
      limitKey,
      limit: check.limit,
      used: check.used,
      remaining: check.remaining,
    });

    throw new HttpException(
      {
        message,
        code: 'limit_exceeded',
        limit: check,
      },
      HttpStatus.FORBIDDEN,
    );
  }

  async getLimitOverview(tenantId: string) {
    const keys = Object.keys(LIMIT_USAGE_MAP) as LimitKey[];
    const checks = await Promise.all(keys.map((key) => this.checkLimit(tenantId, key, 0)));
    const context = await this.subscriptions.getCurrentPlan(tenantId);
    return {
      plan: context?.plan || null,
      subscription: context?.subscription || null,
      checks,
      features: context?.plan.features || {},
    };
  }

  async withMonthlyLeadLimit<T>(
    tenantId: string | null | undefined,
    callback: (db: Queryable, assertLimit: () => Promise<void>) => Promise<T>,
  ): Promise<T> {
    if (!tenantId) {
      return callback(this.db, async () => undefined);
    }

    return this.db.transaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`usage:monthlyLeads:${tenantId}`]);
      return callback(tx, () => this.assertWithinLimit(tenantId, 'monthlyLeads', 1, tx));
    });
  }

  private async currentPeriod() {
    const res = await this.db.query<{ period_start: string; period_end: string }>(
      `SELECT date_trunc('month', now())::date::text AS period_start,
              (date_trunc('month', now()) + interval '1 month')::date::text AS period_end`,
    );
    return res.rows[0] || { period_start: '', period_end: '' };
  }

  private async scalar(sql: string, params: unknown[] = [], db: Queryable = this.db) {
    const res = await db.query<{ count: string | number }>(sql, params);
    return Number(res.rows[0]?.count || 0);
  }
}

function normalizeLimit(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
