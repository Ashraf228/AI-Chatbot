const test = require('node:test');
const assert = require('node:assert/strict');
const { PlanService } = require('../dist/billing/plan.service.js');
const { SubscriptionService } = require('../dist/billing/subscription.service.js');
const { UsageLimitService } = require('../dist/billing/usage-limit.service.js');

function createService({ messages = 10, leads = 2, sites = 1, planLimits = {} } = {}) {
  const subscriptions = {
    async getCurrentPlan() {
      return {
        subscription: {
          id: 'sub-1',
          tenantId: 'tenant-1',
          planId: 'plan-starter',
          status: 'active',
          currentPeriodStart: '2026-05-01',
          currentPeriodEnd: '2026-06-01',
          trialEndsAt: null,
          metadata: {},
        },
        plan: {
          id: 'plan-starter',
          code: 'starter',
          name: 'Starter',
          description: 'Starter',
          monthlyPriceCents: 0,
          currency: 'EUR',
          limits: {
            maxSites: 1,
            monthlyMessages: 1000,
            monthlyLeads: 100,
            maxKnowledgeSources: 10,
            maxIntegrations: 1,
            ...planLimits,
          },
          features: {
            customBranding: false,
            privacyExport: true,
          },
          isActive: true,
        },
      };
    },
  };
  const db = {
    async query(sql) {
      if (/period_start/i.test(sql)) {
        return { rows: [{ period_start: '2026-05-01', period_end: '2026-06-01' }] };
      }
      if (/FROM usage_daily/i.test(sql)) return { rows: [{ count: String(messages) }] };
      if (/FROM conversations/i.test(sql)) return { rows: [{ count: '3' }] };
      if (/FROM widget_leads/i.test(sql)) return { rows: [{ count: String(leads) }] };
      if (/FROM tool_invocations/i.test(sql)) return { rows: [{ count: '4' }] };
      if (/FROM knowledge_sources/i.test(sql)) return { rows: [{ count: '5' }] };
      if (/FROM integration_connections/i.test(sql)) return { rows: [{ count: '1' }] };
      if (/FROM sites/i.test(sql)) return { rows: [{ count: String(sites), tenant_id: 'tenant-1' }] };
      return { rows: [] };
    },
  };
  return new UsageLimitService(db, subscriptions);
}

test('UsageLimitService returns usage summary and allows usage under limit', async () => {
  const service = createService({ messages: 10 });
  const summary = await service.getUsageSummary('tenant-1');
  assert.equal(summary.messages, 10);
  assert.equal(summary.conversations, 3);

  const check = await service.checkLimit('tenant-1', 'monthlyMessages');
  assert.equal(check.allowed, true);
  assert.equal(check.remaining, 990);
});

test('UsageLimitService blocks usage over limit', async () => {
  const service = createService({ messages: 1000 });
  const check = await service.checkLimit('tenant-1', 'monthlyMessages', 1);
  assert.equal(check.allowed, false);

  await assert.rejects(
    () => service.assertWithinLimit('tenant-1', 'monthlyMessages', 1),
    (error) => error.status === 402,
  );
});

test('UsageLimitService supports enterprise-style unlimited limits and feature flags', async () => {
  const service = createService({ messages: 999999, planLimits: { monthlyMessages: null } });
  const check = await service.checkLimit('tenant-1', 'monthlyMessages', 1);
  assert.equal(check.allowed, true);
  assert.equal(check.limit, null);
  assert.equal(await service.hasFeature('tenant-1', 'privacyExport'), true);
  assert.equal(await service.hasFeature('tenant-1', 'whiteLabel'), false);
});

test('PlanService maps default plan rows without leaking raw database names', async () => {
  const service = new PlanService({
    async query() {
      return {
        rows: [
          {
            id: 'plan-starter',
            code: 'starter',
            name: 'Starter',
            description: 'Start plan',
            monthly_price_cents: 4900,
            currency: 'EUR',
            limits: { monthlyMessages: 1000 },
            features: { privacyExport: true },
            is_active: true,
          },
        ],
      };
    },
  });

  const plans = await service.listPlans();
  assert.equal(plans[0].monthlyPriceCents, 4900);
  assert.equal(plans[0].limits.monthlyMessages, 1000);
  assert.equal(plans[0].features.privacyExport, true);
});

test('SubscriptionService creates a default starter subscription for tenants without a plan', async () => {
  const queries = [];
  const service = new SubscriptionService({
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/FROM tenant_subscriptions/i.test(sql)) {
        return { rows: [] };
      }
      if (/SELECT id FROM plans/i.test(sql)) {
        return { rows: [{ id: 'plan-starter' }] };
      }
      if (/INSERT INTO tenant_subscriptions/i.test(sql)) {
        return {
          rows: [
            {
              id: params[0],
              tenant_id: params[1],
              plan_id: params[2],
              status: params[3],
              current_period_start: '2026-05-01',
              current_period_end: '2026-06-01',
              trial_ends_at: null,
              metadata: { source: 'auto-default' },
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const subscription = await service.getCurrentSubscription('tenant-new');
  assert.equal(subscription.tenantId, 'tenant-new');
  assert.equal(subscription.planId, 'plan-starter');
  assert.equal(subscription.status, 'active');
  assert.equal(queries.some((entry) => /INSERT INTO tenant_subscriptions/i.test(entry.sql)), true);
});
