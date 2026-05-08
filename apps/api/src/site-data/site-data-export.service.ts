import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { type DashboardAuthContext } from '../utils/admin-scope.service';

export type DeleteSiteDataScope =
  | 'leads'
  | 'conversations'
  | 'knowledge'
  | 'reports'
  | 'technical'
  | 'all';

type DeleteResult = {
  scope: DeleteSiteDataScope;
  deleted: Record<string, number>;
};

const SENSITIVE_KEY_PATTERN = /(secret|token|password|passwort|api[_-]?key|apikey|oauth|authorization|private[_-]?key|smtp|redis|postgres|openai)/i;

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeValue(entry),
    ]),
  );
}

function sanitizeRecord<T extends Record<string, unknown>>(value: T): T {
  return sanitizeValue(value) as T;
}

@Injectable()
export class SiteDataExportService {
  constructor(
    private readonly db: PrismaService,
    private readonly auditLogs: AuditLogService,
  ) {}

  async exportSiteData(siteId: string, auth: DashboardAuthContext) {
    const site = await this.db.query<Record<string, unknown>>(
      `SELECT id, tenant_id, site_key, name, allowed_domains, public_key, config, created_at
       FROM sites
       WHERE id = $1
       LIMIT 1`,
      [siteId],
    );
    const siteRow = site.rows[0];
    if (!siteRow) {
      throw new BadRequestException('site not found');
    }

    const [
      leads,
      conversations,
      messages,
      knowledgeSources,
      documents,
      documentChunkCounts,
      reportSubscriptions,
      reportRuns,
      modules,
      integrations,
      auditLogs,
      agentRuns,
      toolInvocations,
      agentTickets,
      webhookJobs,
    ] = await Promise.all([
      this.queryRows(`SELECT id, site_id, session_id, name, email, phone, message, status, created_at FROM widget_leads WHERE site_id = $1 ORDER BY created_at DESC`, [siteId]),
      this.queryRows(`SELECT id, tenant_id, site_id, session_id, created_at, last_active_at FROM conversations WHERE site_id = $1 ORDER BY last_active_at DESC`, [siteId]),
      this.queryRows(
        `SELECT m.id, m.conversation_id, m.role, m.content, m.created_at
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.site_id = $1
         ORDER BY c.last_active_at DESC, m.created_at ASC`,
        [siteId],
      ),
      this.queryRows(
        `SELECT id, tenant_id, site_id, source_type, label, source_url, sync_status, config, created_at, updated_at
         FROM knowledge_sources
         WHERE site_id = $1
         ORDER BY created_at DESC`,
        [siteId],
      ),
      this.queryRows(
        `SELECT id, source_id, tenant_id, site_id, type, title, source_url, created_at
         FROM documents
         WHERE site_id = $1
         ORDER BY created_at DESC`,
        [siteId],
      ),
      this.queryRows(
        `SELECT document_id, COUNT(*)::int AS chunk_count
         FROM chunks
         WHERE site_id = $1
         GROUP BY document_id`,
        [siteId],
      ),
      this.queryRows(`SELECT id, site_id, recipient_email, frequency, is_enabled FROM report_subscriptions WHERE site_id = $1 ORDER BY recipient_email ASC`, [siteId]),
      this.queryRows(
        `SELECT id, site_id, frequency, trigger_source, status, recipient_email, report_subject, error_message, created_at, completed_at
         FROM report_runs
         WHERE site_id = $1
         ORDER BY created_at DESC`,
        [siteId],
      ),
      this.queryRows(`SELECT site_id, module_key, is_enabled, config, created_at, updated_at FROM site_modules WHERE site_id = $1 ORDER BY module_key ASC`, [siteId]),
      this.queryRows(
        `SELECT id, tenant_id, site_id, provider_key, connection_key, display_name, status, config, secrets_encrypted, created_at, updated_at
         FROM integration_connections
         WHERE site_id = $1
         ORDER BY provider_key ASC, connection_key ASC`,
        [siteId],
      ),
      this.queryRows(
        `SELECT id, site_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, metadata, created_at
         FROM audit_logs
         WHERE site_id = $1
         ORDER BY created_at DESC
         LIMIT 500`,
        [siteId],
      ),
      this.queryRows(
        `SELECT id, tenant_id, site_id, agent_key, trigger_source, status, input_summary, output_summary, metadata, error_message, created_at, started_at, completed_at
         FROM agent_runs
         WHERE site_id = $1
         ORDER BY created_at DESC
         LIMIT 500`,
        [siteId],
      ),
      this.queryRows(
        `SELECT id, agent_run_id, tenant_id, site_id, tool_key, status, input_payload, output_payload, error_message, created_at, completed_at
         FROM tool_invocations
         WHERE site_id = $1
         ORDER BY created_at DESC
         LIMIT 1000`,
        [siteId],
      ),
      this.queryRows(
        `SELECT id, tenant_id, site_id, agent_run_id, title, description, reporter_name, reporter_email, location, priority, status, created_at
         FROM agent_tickets
         WHERE site_id = $1
         ORDER BY created_at DESC
         LIMIT 500`,
        [siteId],
      ),
      this.queryRows(
        `SELECT id, tenant_id, site_id, agent_run_id, provider_key, connection_key, endpoint_url, method, status, retry_count, max_attempts, available_at, locked_at, completed_at, last_error, last_response_status, last_response_body, created_at, updated_at
         FROM webhook_jobs
         WHERE site_id = $1
         ORDER BY created_at DESC
         LIMIT 500`,
        [siteId],
      ),
    ]);

    const chunkCountByDocumentId = new Map(
      documentChunkCounts.map((row) => [String(row.document_id), Number(row.chunk_count || 0)]),
    );
    const exportedAt = new Date().toISOString();
    const exportPayload = sanitizeRecord({
      exportedAt,
      site: siteRow,
      leads,
      conversations: conversations.map((conversation) => ({
        ...conversation,
        messages: messages.filter((message) => message.conversation_id === conversation.id),
      })),
      knowledge: {
        sources: knowledgeSources,
        documents: documents.map((document) => ({
          ...document,
          chunkCount: chunkCountByDocumentId.get(String(document.id)) || 0,
        })),
      },
      reports: {
        subscriptions: reportSubscriptions,
        runs: reportRuns,
      },
      modules,
      integrations: integrations.map(({ secrets, ...connection }) => ({
        ...connection,
        secrets: undefined,
        secretsConfigured: Boolean(connection.secrets_encrypted),
      })),
      auditLogs,
      technical: {
        agentRuns,
        toolInvocations,
        agentTickets,
        webhookJobs,
      },
    });

    await this.auditLogs.record({
      siteId,
      tenantId: typeof siteRow.tenant_id === 'string' ? siteRow.tenant_id : null,
      actorId: auth.actorId,
      actorRole: auth.role,
      action: 'export_site_data',
      resourceType: 'site_data',
      resourceId: siteId,
      metadata: {
        counts: {
          leads: leads.length,
          conversations: conversations.length,
          messages: messages.length,
          knowledgeSources: knowledgeSources.length,
          documents: documents.length,
          reportRuns: reportRuns.length,
          reportSubscriptions: reportSubscriptions.length,
          modules: modules.length,
          integrations: integrations.length,
          auditLogs: auditLogs.length,
          agentRuns: agentRuns.length,
          toolInvocations: toolInvocations.length,
          webhookJobs: webhookJobs.length,
        },
      },
    });

    return exportPayload;
  }

  async deleteSiteData(
    siteId: string,
    input: { scope: DeleteSiteDataScope; confirm?: boolean },
    auth: DashboardAuthContext,
  ): Promise<DeleteResult> {
    if (input.confirm !== true) {
      throw new BadRequestException('confirm=true required');
    }

    const site = await this.db.query<{ tenant_id: string | null }>(
      `SELECT tenant_id FROM sites WHERE id = $1 LIMIT 1`,
      [siteId],
    );
    const siteRow = site.rows[0];
    if (!siteRow) {
      throw new BadRequestException('site not found');
    }

    const deleted: Record<string, number> = {};
    const scopes = input.scope === 'all'
      ? (['leads', 'conversations', 'knowledge', 'reports', 'technical'] as DeleteSiteDataScope[])
      : [input.scope];

    for (const scope of scopes) {
      Object.assign(deleted, await this.deleteScope(siteId, scope));
    }

    await this.auditLogs.record({
      siteId,
      tenantId: siteRow.tenant_id,
      actorId: auth.actorId,
      actorRole: auth.role,
      action: 'delete_site_data',
      resourceType: 'site_data',
      resourceId: siteId,
      metadata: {
        scope: input.scope,
        counts: deleted,
      },
    });

    return {
      scope: input.scope,
      deleted,
    };
  }

  private async deleteScope(siteId: string, scope: DeleteSiteDataScope) {
    switch (scope) {
      case 'leads':
        return {
          widgetLeads: await this.deleteRows(`DELETE FROM widget_leads WHERE site_id = $1`, [siteId]),
        };
      case 'conversations':
        return {
          conversations: await this.deleteRows(`DELETE FROM conversations WHERE site_id = $1`, [siteId]),
          widgetSessions: await this.deleteRows(`DELETE FROM widget_sessions WHERE site_id = $1`, [siteId]),
          widgetEvents: await this.deleteRows(`DELETE FROM widget_events WHERE site_id = $1`, [siteId]),
        };
      case 'knowledge':
        return {
          documents: await this.deleteRows(`DELETE FROM documents WHERE site_id = $1`, [siteId]),
          knowledgeSources: await this.deleteRows(`DELETE FROM knowledge_sources WHERE site_id = $1`, [siteId]),
        };
      case 'reports':
        return {
          reportRuns: await this.deleteRows(`DELETE FROM report_runs WHERE site_id = $1`, [siteId]),
          reportSubscriptions: await this.deleteRows(`DELETE FROM report_subscriptions WHERE site_id = $1`, [siteId]),
        };
      case 'technical':
        return {
          webhookJobs: await this.deleteRows(`DELETE FROM webhook_jobs WHERE site_id = $1`, [siteId]),
          agentContactRequests: await this.deleteRows(`DELETE FROM agent_contact_requests WHERE site_id = $1`, [siteId]),
          agentTickets: await this.deleteRows(`DELETE FROM agent_tickets WHERE site_id = $1`, [siteId]),
          agentRuns: await this.deleteRows(`DELETE FROM agent_runs WHERE site_id = $1`, [siteId]),
        };
      default:
        throw new BadRequestException('Unsupported delete scope');
    }
  }

  private async queryRows<T extends Record<string, unknown>>(sql: string, params: unknown[]) {
    const res = await this.db.query<T>(sql, params);
    return res.rows.map((row) => sanitizeRecord(row));
  }

  private async deleteRows(sql: string, params: unknown[]) {
    const res = await this.db.query(`${sql} RETURNING 1`, params);
    return res.rows.length;
  }
}
