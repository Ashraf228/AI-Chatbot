-- Keep the normalized internal tenant out of Starter limits.
-- Tenant creation normalizes "t_default" to "t-default"; older seeds upgraded
-- only the underscored id, leaving the real admin tenant on Starter.

INSERT INTO plans (id, code, name, description, monthly_price_cents, currency, limits, features, is_active, created_at, updated_at)
VALUES (
  'plan_enterprise',
  'enterprise',
  'Enterprise',
  'Individuelle Limits fuer interne und Enterprise-Kunden.',
  NULL,
  'EUR',
  '{"maxSites": 100000, "monthlyMessages": 10000000, "monthlyLeads": 1000000, "maxKnowledgeSources": 100000, "maxIntegrations": 100000}',
  '{"customBranding": true, "whiteLabel": true, "strictKnowledgeMode": true, "privacyExport": true, "prioritySupport": true, "customLimits": true}',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (code) DO UPDATE
SET
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = NOW();

INSERT INTO tenants (id, name, created_at, updated_at)
VALUES ('t-default', 'Interner Mandant', NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET
  name = COALESCE(NULLIF(tenants.name, ''), EXCLUDED.name),
  updated_at = NOW();

UPDATE tenant_subscriptions
SET
  status = 'canceled',
  metadata = COALESCE(metadata, '{}'::jsonb) || '{"replacedBy": "enterprise_internal", "reason": "default_tenant_slug_fix"}'::jsonb,
  updated_at = NOW()
WHERE tenant_id IN ('t-default', 't_default')
  AND status IN ('trialing', 'active', 'past_due', 'internal')
  AND plan_id <> (SELECT id FROM plans WHERE code = 'enterprise' LIMIT 1);

UPDATE tenant_subscriptions
SET
  status = 'internal',
  metadata = COALESCE(metadata, '{}'::jsonb) || '{"reason": "default_tenant_slug_fix"}'::jsonb,
  updated_at = NOW()
WHERE tenant_id IN ('t-default', 't_default')
  AND status IN ('trialing', 'active', 'past_due')
  AND plan_id = (SELECT id FROM plans WHERE code = 'enterprise' LIMIT 1);

INSERT INTO tenant_subscriptions (
  id,
  tenant_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  trial_ends_at,
  metadata,
  created_at,
  updated_at
)
SELECT
  'sub_t_default_slug_enterprise',
  't-default',
  p.id,
  'internal',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '100 years',
  NULL,
  '{"reason": "default_tenant_slug_fix"}'::jsonb,
  NOW(),
  NOW()
FROM plans p
WHERE p.code = 'enterprise'
  AND NOT EXISTS (
    SELECT 1
    FROM tenant_subscriptions ts
    WHERE ts.tenant_id = 't-default'
      AND ts.status IN ('trialing', 'active', 'past_due', 'internal')
  )
ON CONFLICT (id) DO NOTHING;
