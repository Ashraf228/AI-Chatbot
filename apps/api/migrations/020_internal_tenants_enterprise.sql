-- Keep internal/default tenants out of Starter maxSites limits.
-- This is intentionally idempotent because older deployments may already have
-- created t-default with an automatic starter subscription.

INSERT INTO plans (id, code, name, description, monthly_price_cents, currency, limits, features, is_active, created_at, updated_at)
VALUES (
  'plan_enterprise',
  'enterprise',
  'Enterprise',
  'Custom internal or enterprise plan',
  NULL,
  'EUR',
  '{"maxSites": 100000, "monthlyMessages": 10000000, "monthlyLeads": 1000000, "maxKnowledgeSources": 100000, "maxIntegrations": 100000}'::jsonb,
  '{"customBranding": true, "whiteLabel": true, "prioritySupport": true, "customLimits": true, "strictKnowledgeMode": true, "privacyExport": true}'::jsonb,
  true,
  now(),
  now()
)
ON CONFLICT (code) DO UPDATE
SET limits = EXCLUDED.limits,
    features = EXCLUDED.features,
    is_active = true,
    updated_at = now();

UPDATE tenant_subscriptions
SET status = 'canceled',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"replacedBy":"enterprise_internal","source":"020_internal_tenants_enterprise"}'::jsonb,
    updated_at = now()
WHERE tenant_id IN ('t_default', 't-default')
  AND status IN ('trialing', 'active', 'past_due', 'internal')
  AND plan_id <> (SELECT id FROM plans WHERE code = 'enterprise' LIMIT 1);

UPDATE tenant_subscriptions
SET status = 'internal',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"source":"020_internal_tenants_enterprise"}'::jsonb,
    updated_at = now()
WHERE tenant_id IN ('t_default', 't-default')
  AND status IN ('trialing', 'active', 'past_due', 'internal')
  AND plan_id = (SELECT id FROM plans WHERE code = 'enterprise' LIMIT 1);

INSERT INTO tenant_subscriptions (
  id,
  tenant_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  metadata,
  created_at,
  updated_at
)
SELECT
  CASE
    WHEN t.id = 't-default' THEN 'sub_t_default_slug_enterprise_020'
    ELSE 'sub_t_default_enterprise_020'
  END,
  t.id,
  p.id,
  'internal',
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month',
  '{"source":"020_internal_tenants_enterprise"}'::jsonb,
  now(),
  now()
FROM tenants t
CROSS JOIN plans p
WHERE t.id IN ('t_default', 't-default')
  AND p.code = 'enterprise'
  AND NOT EXISTS (
    SELECT 1
    FROM tenant_subscriptions ts
    WHERE ts.tenant_id = t.id
      AND ts.status IN ('trialing', 'active', 'past_due', 'internal')
  );
