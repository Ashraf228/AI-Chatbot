CREATE TABLE IF NOT EXISTS agent_tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  site_id TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reporter_name TEXT,
  reporter_email TEXT,
  location TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_tickets_site_created_idx
ON agent_tickets(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_tickets_run_idx
ON agent_tickets(agent_run_id);
