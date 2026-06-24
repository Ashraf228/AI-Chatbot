ALTER TABLE agent_tickets
  ADD COLUMN IF NOT EXISTS support_profile TEXT NOT NULL DEFAULT 'it',
  ADD COLUMN IF NOT EXISTS product TEXT,
  ADD COLUMN IF NOT EXISTS module TEXT,
  ADD COLUMN IF NOT EXISTS customer_organization TEXT,
  ADD COLUMN IF NOT EXISTS customer_reference TEXT,
  ADD COLUMN IF NOT EXISTS process_or_form_name TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS forwarding_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS synthetic BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evaluation_chat_session_id TEXT,
  ADD COLUMN IF NOT EXISTS demo_reference TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS agent_tickets_confirmation_id_unique
  ON agent_tickets(confirmation_id)
  WHERE confirmation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_tickets_evaluation_demo_idx
  ON agent_tickets(tenant_id, site_id, evaluation_chat_session_id, created_at DESC)
  WHERE demo = true AND synthetic = true;

CREATE TABLE IF NOT EXISTS evaluation_ticket_previews (
  id TEXT PRIMARY KEY,
  preview_token_hash TEXT NOT NULL UNIQUE,
  tenant_user_id TEXT NOT NULL REFERENCES tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON UPDATE CASCADE ON DELETE CASCADE,
  evaluation_chat_session_id TEXT NOT NULL REFERENCES evaluation_chat_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  preview JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ticket_id TEXT,
  demo_reference TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS evaluation_ticket_previews_owner_idx
  ON evaluation_ticket_previews(tenant_user_id, site_id, status, expires_at);

CREATE INDEX IF NOT EXISTS evaluation_ticket_previews_session_idx
  ON evaluation_ticket_previews(tenant_id, site_id, evaluation_chat_session_id, created_at DESC);
