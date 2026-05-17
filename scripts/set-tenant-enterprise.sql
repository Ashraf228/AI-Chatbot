-- Usage:
-- psql "$DATABASE_URL" -v tenant_id='your-tenant-id' -f scripts/set-tenant-enterprise.sql
-- Docker example:
-- docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v tenant_id="t_default"' < scripts/set-tenant-enterprise.sql

\if :{?tenant_id}
\else
\echo 'Missing psql variable: tenant_id'
\quit 1
\endif

BEGIN;

UPDATE tenant_subscriptions
SET status = 'canceled',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('source', 'set-tenant-enterprise.sql'),
    updated_at = now()
WHERE tenant_id = :'tenant_id'
  AND status IN ('trialing', 'active', 'past_due', 'internal');

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
  'sub_' || regexp_replace(:'tenant_id', '[^a-zA-Z0-9_]+', '_', 'g') || '_enterprise_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
  :'tenant_id',
  p.id,
  'internal',
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month',
  jsonb_build_object('source', 'set-tenant-enterprise.sql'),
  now(),
  now()
FROM plans p
WHERE p.code = 'enterprise';

COMMIT;
