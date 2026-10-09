import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { BillingPlan, PlanCode, TenantSubscription } from './billing.types';

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: TenantSubscription['status'];
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  metadata: Record<string, unknown> | null;
};

type PlanRow = {
  id: string;
  code: PlanCode;
  name: string;
  description: string;
  monthly_price_cents: number | null;
  currency: string;
  limits: Record<string, unknown> | null;
  features: Record<string, unknown> | null;
  is_active: boolean;
};

@Injectable()
export class SubscriptionService {
  constructor(private readonly db: PrismaService) {}

  async getCurrentSubscription(tenantId: string) {
    const existing = await this.fetchSubscription(tenantId);
    if (existing) {
      return existing;
    }
    return this.ensureDefaultSubscription(tenantId);
  }

  async getCurrentPlan(tenantId: string) {
    const subscription = await this.getCurrentSubscription(tenantId);
    const plan = await this.db.query<PlanRow>(
      `SELECT id, code, name, description, monthly_price_cents, currency, limits, features, is_active
       FROM plans
       WHERE id = $1
       LIMIT 1`,
      [subscription.planId],
    );
    return plan.rows[0] ? { subscription, plan: mapPlan(plan.rows[0]) } : null;
  }

  async setPlanForTenant(tenantId: string, planCode: string) {
    const plan = await this.db.query<{ id: string }>(
      `SELECT id FROM plans WHERE code = $1 AND is_active = true LIMIT 1`,
      [planCode],
    );
    const planId = plan.rows[0]?.id;
    if (!planId) {
      throw new BadRequestException('Unknown plan');
    }

    await this.db.query(
      `UPDATE tenant_subscriptions
       SET status = 'canceled',
           updated_at = now()
       WHERE tenant_id = $1
         AND status IN ('trialing', 'active', 'past_due', 'internal')`,
      [tenantId],
    );

    const id = randomUUID();
    await this.db.query(
      `INSERT INTO tenant_subscriptions(
         id, tenant_id, plan_id, status, current_period_start, current_period_end, metadata, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', '{}'::jsonb, now(), now())`,
      [id, tenantId, planId, planCode === 'enterprise' ? 'internal' : 'active'],
    );

    return this.getCurrentPlan(tenantId);
  }

  private async fetchSubscription(tenantId: string) {
    const res = await this.db.query<SubscriptionRow>(
      `SELECT id, tenant_id, plan_id, status, current_period_start, current_period_end, trial_ends_at, metadata
       FROM tenant_subscriptions
       WHERE tenant_id = $1
         AND status IN ('trialing', 'active', 'past_due', 'internal')
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId],
    );
    return res.rows[0] ? mapSubscription(res.rows[0]) : null;
  }

  private async ensureDefaultSubscription(tenantId: string) {
    const planCode = isInternalTenant(tenantId) ? 'enterprise' : 'starter';
    const plan = await this.db.query<{ id: string }>(
      `SELECT id FROM plans WHERE code = $1 AND is_active = true LIMIT 1`,
      [planCode],
    );
    const planId = plan.rows[0]?.id;
    if (!planId) {
      throw new Error('Default plan missing');
    }

    const id = randomUUID();
    const inserted = await this.db.query<SubscriptionRow>(
      `INSERT INTO tenant_subscriptions(
         id, tenant_id, plan_id, status, current_period_start, current_period_end, metadata, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', '{"source":"auto-default"}'::jsonb, now(), now())
       RETURNING id, tenant_id, plan_id, status, current_period_start, current_period_end, trial_ends_at, metadata`,
      [id, tenantId, planId, planCode === 'enterprise' ? 'internal' : 'active'],
    );
    return mapSubscription(inserted.rows[0]);
  }
}

function isInternalTenant(tenantId: string) {
  return tenantId === 't_default' || tenantId === 't-default';
}

function mapSubscription(row: SubscriptionRow): TenantSubscription {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    status: row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialEndsAt: row.trial_ends_at,
    metadata: row.metadata || {},
  };
}

function mapPlan(row: PlanRow): BillingPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    monthlyPriceCents: row.monthly_price_cents,
    currency: row.currency,
    limits: row.limits || null,
    features: row.features || {},
    isActive: row.is_active,
  };
}
