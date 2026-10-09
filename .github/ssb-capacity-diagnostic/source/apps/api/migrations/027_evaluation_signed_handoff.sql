CREATE TABLE IF NOT EXISTS evaluation_handoff_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_user_id TEXT NOT NULL REFERENCES tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  evaluation_chat_session_id TEXT NOT NULL REFERENCES evaluation_chat_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  evaluation_ticket_id TEXT NOT NULL REFERENCES agent_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE,
  demo BOOLEAN NOT NULL DEFAULT true,
  synthetic BOOLEAN NOT NULL DEFAULT true,
  payload_body TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  last_error_code TEXT,
  CONSTRAINT evaluation_handoff_events_ticket_unique UNIQUE(evaluation_ticket_id),
  CONSTRAINT evaluation_handoff_events_demo_check CHECK (demo = true AND synthetic = true)
);

CREATE INDEX IF NOT EXISTS evaluation_handoff_events_scope_idx
  ON evaluation_handoff_events(tenant_id, site_id, tenant_user_id, evaluation_chat_session_id, created_at DESC)
  WHERE demo = true AND synthetic = true;

CREATE TABLE IF NOT EXISTS evaluation_handoff_deliveries (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL REFERENCES evaluation_handoff_events(event_id) ON UPDATE CASCADE ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'mock_queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  http_status INTEGER,
  retryable BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  response_summary TEXT,
  CONSTRAINT evaluation_handoff_deliveries_attempt_unique UNIQUE(event_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS evaluation_handoff_deliveries_event_idx
  ON evaluation_handoff_deliveries(event_id, attempt_number DESC);

CREATE TABLE IF NOT EXISTS evaluation_mock_handoff_receipts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES evaluation_handoff_events(event_id) ON UPDATE CASCADE ON DELETE CASCADE,
  first_delivery_id TEXT NOT NULL,
  last_delivery_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON UPDATE CASCADE ON DELETE CASCADE,
  payload_hash TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'verified'
);

CREATE INDEX IF NOT EXISTS evaluation_mock_handoff_receipts_scope_idx
  ON evaluation_mock_handoff_receipts(tenant_id, site_id, received_at DESC);
