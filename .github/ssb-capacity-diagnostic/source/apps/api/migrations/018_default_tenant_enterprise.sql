INSERT INTO plans(id, code, name, description, monthly_price_cents, currency, limits, features, is_active)
VALUES (
  'plan_enterprise',
  'enterprise',
  'Enterprise',
  'Individuelle Limits und Premium-Funktionen.',
  NULL,
  'EUR',
  NULL,
  '{"customBranding":true,"whiteLabel":true,"strictKnowledgeMode":true,"privacyExport":true,"prioritySupport":true,"customLimits":true}'::jsonb,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  currency = EXCLUDED.currency,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO tenants(id, name)
VALUES ('t_default', 'Interner Mandant')
ON CONFLICT (id) DO NOTHING;

UPDATE tenant_subscriptions
SET status = 'canceled',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"source":"018_default_tenant_enterprise","reason":"default_tenant_enterprise"}'::jsonb,
    updated_at = now()
WHERE tenant_id = 't_default'
  AND status IN ('trialing', 'active', 'past_due', 'internal')
  AND plan_id <> (SELECT id FROM plans WHERE code = 'enterprise' LIMIT 1);

UPDATE tenant_subscriptions
SET status = 'internal',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"source":"018_default_tenant_enterprise"}'::jsonb,
    updated_at = now()
WHERE tenant_id = 't_default'
  AND status IN ('trialing', 'active', 'past_due')
  AND plan_id = (SELECT id FROM plans WHERE code = 'enterprise' LIMIT 1);

INSERT INTO tenant_subscriptions(
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
  'sub_t_default_enterprise',
  't_default',
  p.id,
  'internal',
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month',
  '{"source":"018_default_tenant_enterprise"}'::jsonb,
  now(),
  now()
FROM plans p
WHERE p.code = 'enterprise'
  AND NOT EXISTS (
    SELECT 1
    FROM tenant_subscriptions ts
    WHERE ts.tenant_id = 't_default'
      AND ts.status IN ('trialing', 'active', 'past_due', 'internal')
  );
