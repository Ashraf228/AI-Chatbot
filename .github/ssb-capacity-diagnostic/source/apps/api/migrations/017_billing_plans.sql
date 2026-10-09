CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  monthly_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  limits JSONB,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'internal',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  trial_ends_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_subscriptions_active_tenant_idx
ON tenant_subscriptions(tenant_id)
WHERE status IN ('trialing', 'active', 'past_due', 'internal');

INSERT INTO plans(id, code, name, description, monthly_price_cents, currency, limits, features, is_active)
VALUES
  (
    'plan_starter',
    'starter',
    'Starter',
    'Einstiegspaket fuer einen Kundenstandort.',
    NULL,
    'EUR',
    '{"maxSites":1,"monthlyMessages":1000,"monthlyLeads":100,"maxKnowledgeSources":10,"maxIntegrations":1}'::jsonb,
    '{"customBranding":false,"whiteLabel":false,"strictKnowledgeMode":true,"privacyExport":true}'::jsonb,
    true
  ),
  (
    'plan_business',
    'business',
    'Business',
    'Mehrere Kundenstandorte mit professioneller Nutzung.',
    NULL,
    'EUR',
    '{"maxSites":5,"monthlyMessages":10000,"monthlyLeads":1000,"maxKnowledgeSources":100,"maxIntegrations":5}'::jsonb,
    '{"customBranding":true,"whiteLabel":false,"strictKnowledgeMode":true,"privacyExport":true}'::jsonb,
    true
  ),
  (
    'plan_agency',
    'agency',
    'Agency',
    'Agenturpaket fuer viele Kundenstandorte.',
    NULL,
    'EUR',
    '{"maxSites":25,"monthlyMessages":100000,"monthlyLeads":10000,"maxKnowledgeSources":1000,"maxIntegrations":25}'::jsonb,
    '{"customBranding":true,"whiteLabel":true,"strictKnowledgeMode":true,"privacyExport":true}'::jsonb,
    true
  ),
  (
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
  'sub_' || t.id,
  t.id,
  CASE WHEN t.id = 't_default' THEN 'plan_enterprise' ELSE 'plan_starter' END,
  CASE WHEN t.id = 't_default' THEN 'internal' ELSE 'active' END,
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month',
  '{"source":"migration"}'::jsonb,
  now(),
  now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = t.id
    AND ts.status IN ('trialing', 'active', 'past_due', 'internal')
);
