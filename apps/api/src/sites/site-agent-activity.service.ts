import { Injectable } from '@nestjs/common';

import { PrismaService } from '../db/prisma.service';

type ActivityStatus = 'success' | 'warning' | 'error' | 'pending';

type ActivityType =
  | 'lead_captured'
  | 'contact_requested'
  | 'email_queued'
  | 'email_failed'
  | 'tool_invocation'
  | 'agent_run';

export type SiteAgentActivity = {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  label: string;
  description: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
};

type ContactRequestRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  preferred_channel: string | null;
  status: string;
  created_at: string;
};

type EmailJobRow = {
  id: string;
  status: string;
  retry_count: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  metadata: Record<string, unknown>;
};

type AgentRunRow = {
  id: string;
  agent_key: string;
  trigger_source: string;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

type ToolInvocationRow = {
  id: string;
  agent_run_id: string;
  agent_key: string | null;
  tool_key: string;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

type AuditLogRow = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

@Injectable()
export class SiteAgentActivityService {
  constructor(private readonly db: PrismaService) {}

  async listForSite(siteId: string, limit = 50): Promise<SiteAgentActivity[]> {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const [leads, contacts, emails, runs, tools, audits] = await Promise.all([
      this.listLeads(siteId, safeLimit),
      this.listContactRequests(siteId, safeLimit),
      this.listEmailJobs(siteId, safeLimit),
      this.listAgentRuns(siteId, safeLimit),
      this.listToolInvocations(siteId, safeLimit),
      this.listAuditActivities(siteId, safeLimit),
    ]);

    return [...leads, ...contacts, ...emails, ...runs, ...tools, ...audits]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, safeLimit);
  }

  private async listLeads(siteId: string, limit: number) {
    const res = await this.db.query<LeadRow>(
      `SELECT id, name, email, phone, status, created_at
       FROM widget_leads
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [siteId, limit],
    );

    return res.rows.map((row) => ({
      id: row.id,
      type: 'lead_captured' as const,
      status: 'success' as const,
      label: 'Lead gespeichert',
      description: `Neue Anfrage von ${row.name || 'unbekannt'}`,
      createdAt: toIso(row.created_at),
      metadata: {
        leadId: row.id,
        leadStatus: row.status,
        hasEmail: Boolean(row.email),
        hasPhone: Boolean(row.phone),
      },
    }));
  }

  private async listContactRequests(siteId: string, limit: number) {
    const res = await this.db.query<ContactRequestRow>(
      `SELECT id, name, email, phone, preferred_channel, status, created_at
       FROM agent_contact_requests
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [siteId, limit],
    );

    return res.rows.map((row) => ({
      id: row.id,
      type: 'contact_requested' as const,
      status: mapPendingStatus(row.status),
      label: 'Terminabsicht erkannt',
      description: `Kontaktanfrage${row.name ? ` von ${row.name}` : ''} wurde vorbereitet.`,
      createdAt: toIso(row.created_at),
      metadata: {
        contactRequestId: row.id,
        requestStatus: row.status,
        preferredChannel: row.preferred_channel || undefined,
        hasEmail: Boolean(row.email),
        hasPhone: Boolean(row.phone),
      },
    }));
  }

  private async listEmailJobs(siteId: string, limit: number) {
    const res = await this.db.query<EmailJobRow>(
      `SELECT id, status, retry_count, max_attempts, last_error, created_at, sent_at, metadata
       FROM email_jobs
       WHERE kind = 'lead_notification'
         AND metadata->>'siteId' = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [siteId, limit],
    );

    return res.rows.map((row) => {
      const status = mapEmailStatus(row.status);
      return {
        id: row.id,
        type: status === 'error' ? 'email_failed' as const : 'email_queued' as const,
        status,
        label: status === 'error' ? 'E-Mail fehlgeschlagen' : status === 'success' ? 'E-Mail gesendet' : 'E-Mail ausgelöst',
        description: buildEmailDescription(row.status),
        createdAt: toIso(row.sent_at || row.created_at),
        metadata: {
          emailJobId: row.id,
          emailStatus: row.status,
          retryCount: row.retry_count,
          maxAttempts: row.max_attempts,
          leadId: typeof row.metadata?.leadId === 'string' ? row.metadata.leadId : undefined,
          hasError: Boolean(row.last_error),
        },
      };
    });
  }

  private async listAgentRuns(siteId: string, limit: number) {
    const res = await this.db.query<AgentRunRow>(
      `SELECT id, agent_key, trigger_source, status, error_message, created_at, completed_at
       FROM agent_runs
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [siteId, limit],
    );

    return res.rows.map((row) => ({
      id: row.id,
      type: 'agent_run' as const,
      status: mapExecutionStatus(row.status),
      label: 'Automation ausgeführt',
      description: `${formatKey(row.agent_key)} wurde durch ${formatKey(row.trigger_source)} gestartet.`,
      createdAt: toIso(row.completed_at || row.created_at),
      metadata: {
        agentRunId: row.id,
        agentKey: row.agent_key,
        triggerSource: row.trigger_source,
        runStatus: row.status,
        hasError: Boolean(row.error_message),
      },
    }));
  }

  private async listToolInvocations(siteId: string, limit: number) {
    const res = await this.db.query<ToolInvocationRow>(
      `SELECT ti.id, ti.agent_run_id, ar.agent_key, ti.tool_key, ti.status, ti.error_message, ti.created_at, ti.completed_at
       FROM tool_invocations ti
       LEFT JOIN agent_runs ar ON ar.id = ti.agent_run_id
       WHERE ti.site_id = $1
       ORDER BY ti.created_at DESC
       LIMIT $2`,
      [siteId, limit],
    );

    return res.rows.map((row) => ({
      id: row.id,
      type: 'tool_invocation' as const,
      status: mapExecutionStatus(row.status),
      label: 'Aktion ausgeführt',
      description: `${formatKey(row.tool_key)}${row.agent_key ? ` für ${formatKey(row.agent_key)}` : ''}.`,
      createdAt: toIso(row.completed_at || row.created_at),
      metadata: {
        toolInvocationId: row.id,
        agentRunId: row.agent_run_id,
        agentKey: row.agent_key || undefined,
        toolKey: row.tool_key,
        toolStatus: row.status,
        hasError: Boolean(row.error_message),
      },
    }));
  }

  private async listAuditActivities(siteId: string, limit: number) {
    const res = await this.db.query<AuditLogRow>(
      `SELECT id, action, resource_type, resource_id, metadata, created_at
       FROM audit_logs
       WHERE site_id = $1
         AND action = ANY($2::text[])
       ORDER BY created_at DESC
       LIMIT $3`,
      [
        siteId,
        [
          'lead_notification_sent',
          'lead_notification_failed',
          'lead_notification_queued',
          'lead_pending_started',
          'lead_pending_updated',
          'lead_captured',
          'capture_lead',
          'schedule_contact',
        ],
        limit,
      ],
    );

    return res.rows.map((row) => {
      const isFailed = row.action.includes('failed');
      const isEmail = row.action.includes('lead_notification');
      const isLeadCapture = row.action === 'lead_captured' || row.action === 'capture_lead';
      return {
        id: row.id,
        type: isEmail
          ? (isFailed ? 'email_failed' as const : 'email_queued' as const)
          : isLeadCapture
            ? 'lead_captured' as const
            : 'tool_invocation' as const,
        status: isFailed ? 'error' as const : 'success' as const,
        label: formatAuditAction(row.action),
        description: `${formatAuditAction(row.action)} wurde protokolliert.`,
        createdAt: toIso(row.created_at),
        metadata: {
          auditLogId: row.id,
          action: row.action,
          resourceType: row.resource_type,
          resourceId: row.resource_id || undefined,
          leadId: typeof row.metadata?.leadId === 'string' ? row.metadata.leadId : undefined,
          jobId: typeof row.metadata?.jobId === 'string' ? row.metadata.jobId : undefined,
        },
      };
    });
  }
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

function mapExecutionStatus(status: string): ActivityStatus {
  if (['completed', 'success', 'sent'].includes(status)) {
    return 'success';
  }

  if (['failed', 'error'].includes(status)) {
    return 'error';
  }

  if (['skipped', 'cancelled', 'canceled'].includes(status)) {
    return 'warning';
  }

  return 'pending';
}

function mapPendingStatus(status: string): ActivityStatus {
  if (['failed', 'error'].includes(status)) {
    return 'error';
  }

  if (['closed', 'completed', 'done'].includes(status)) {
    return 'success';
  }

  return 'pending';
}

function mapEmailStatus(status: string): ActivityStatus {
  if (status === 'sent') {
    return 'success';
  }

  if (status === 'failed') {
    return 'error';
  }

  return 'pending';
}

function buildEmailDescription(status: string) {
  if (status === 'sent') {
    return 'Interne Benachrichtigung wurde versendet.';
  }

  if (status === 'failed') {
    return 'Interne Benachrichtigung konnte nicht versendet werden.';
  }

  return 'Interne Benachrichtigung wurde in die Mail-Queue gelegt.';
}

function formatKey(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    lead_notification_sent: 'E-Mail gesendet',
    lead_notification_failed: 'E-Mail fehlgeschlagen',
    lead_notification_queued: 'E-Mail ausgelöst',
    lead_pending_started: 'Lead-Erfassung gestartet',
    lead_pending_updated: 'Lead-Erfassung aktualisiert',
    lead_captured: 'Lead gespeichert',
    capture_lead: 'Lead gespeichert',
    schedule_contact: 'Terminabsicht erkannt',
  };

  return labels[action] || formatKey(action);
}
