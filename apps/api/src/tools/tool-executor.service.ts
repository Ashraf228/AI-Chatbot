import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../db/prisma.service';
import { IntegrationEventDispatcherService } from '../integrations/integration-event-dispatcher.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { SitesService } from '../sites/sites.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { WebhookJobsService } from './webhook-jobs.service';
import { ToolAuditService } from './tool-audit.service';
import { ToolExecutionContext } from './tool-context.types';
import { normalizeToolInput } from './tool-input.schema';
import { ToolRegistryService } from './tool-registry.service';
import { ToolAuditEntry, ToolExecutionResult } from './tool-result.types';
import { UsageLimitService } from '../billing/usage-limit.service';

type SiteRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  config: Record<string, unknown> | null;
};

type ConversationRow = {
  id: string;
  session_id: string;
  metadata: Record<string, unknown> | null;
};

@Injectable()
export class ToolExecutorService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
    private readonly integrations: IntegrationsService,
    private readonly webhookJobs: WebhookJobsService,
    private readonly embedder: EmbeddingService,
    private readonly vector: VectorService,
    private readonly registry: ToolRegistryService,
    private readonly audit: ToolAuditService,
    private readonly integrationEvents: IntegrationEventDispatcherService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  async executeTool(
    toolName: string,
    rawInput: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const definition = this.registry.assertKnown(toolName);
    if (!definition) {
      return {
        toolName,
        status: 'failed',
        message: 'Unbekanntes Tool.',
        error: { code: 'invalid_tool', message: 'Tool is not registered' },
      };
    }

    const site = await this.getScopedSite(context);
    if (!site) {
      return {
        toolName,
        status: 'failed',
        message: 'Kunde oder Mandant passt nicht zum Tool-Kontext.',
        error: { code: 'forbidden_or_missing_site', message: 'Invalid site scope' },
      };
    }

    const validation = normalizeToolInput(toolName, rawInput);
    const auditEntry = await this.audit.start(toolName, validation.input, context);

    if (validation.missingFields.length > 0) {
      return this.finish(auditEntry, {
        toolName,
        status: 'missing_fields',
        message: 'Es fehlen erforderliche Angaben.',
        missingFields: validation.missingFields,
      });
    }

    try {
      let result: ToolExecutionResult;
      switch (toolName) {
        case 'capture_lead':
          result = await this.captureLead(validation.input, context);
          break;
        case 'schedule_contact':
          result = await this.scheduleContact(validation.input, context, auditEntry);
          break;
        case 'create_ticket':
          result = await this.createTicket(validation.input, context, auditEntry);
          break;
        case 'push_webhook':
          result = await this.pushWebhook(validation.input, context, auditEntry);
          break;
        case 'query_knowledge':
          result = await this.queryKnowledge(validation.input, context);
          break;
        case 'recommend_service':
          result = await this.recommendService(validation.input, site);
          break;
        case 'handoff':
          result = await this.handoff(validation.input, context);
          break;
        default:
          result = {
            toolName,
            status: 'failed',
            message: 'Tool-Ausfuehrung ist nicht implementiert.',
            error: { code: 'not_implemented', message: `Tool ${toolName} is not implemented` },
          };
      }

      return this.finish(auditEntry, result);
    } catch (error) {
      const limitError = extractLimitExceeded(error);
      if (limitError) {
        return this.finish(auditEntry, {
          toolName,
          status: 'failed',
          message: limitError.message,
          error: {
            code: 'limit_exceeded',
            message: limitError.message,
          },
        });
      }

      return this.finish(auditEntry, {
        toolName,
        status: 'failed',
        message: 'Tool-Ausfuehrung fehlgeschlagen.',
        error: {
          code: 'tool_execution_failed',
          message: error instanceof Error ? error.message : 'Unknown tool execution error',
        },
      });
    }
  }

  private async getScopedSite(context: ToolExecutionContext) {
    const site = await this.sites.getSite(context.siteId) as SiteRow | null;
    if (!site) {
      return null;
    }
    if (context.tenantId && site.tenant_id && context.tenantId !== site.tenant_id) {
      return null;
    }
    return site;
  }

  private async getConversation(context: ToolExecutionContext) {
    const res = await this.db.query<ConversationRow>(
      `SELECT id, session_id, metadata
       FROM conversations
       WHERE id = $1 AND site_id = $2
       LIMIT 1`,
      [context.conversationId, context.siteId],
    );
    return res.rows[0] || null;
  }

  private async updateConversationMetadata(
    context: ToolExecutionContext,
    patch: Record<string, unknown>,
  ) {
    await this.db.query(
      `UPDATE conversations
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
           last_active_at = now()
       WHERE id = $1 AND site_id = $2`,
      [context.conversationId, context.siteId, JSON.stringify(patch)],
    );
  }

  private async captureLead(
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const conversation = await this.getConversation(context);
    if (!conversation) {
      return failed('capture_lead', 'conversation_not_found', 'Conversation not found');
    }

    const metadata = asObject(conversation.metadata);
    const previousLeadId = getNestedString(metadata, ['toolExecutor', 'leadId']);
    if (previousLeadId) {
      return {
        toolName: 'capture_lead',
        status: 'skipped',
        message: 'Lead wurde fuer diese Unterhaltung bereits erfasst.',
        data: { leadId: previousLeadId },
      };
    }

    const email = text(input.email);
    const phone = text(input.phone);
    const existing = await this.db.query<{ id: string }>(
      `SELECT id
       FROM widget_leads
       WHERE site_id = $1
         AND session_id = $2
         AND (($3 <> '' AND email = $3) OR ($4 <> '' AND phone = $4))
       ORDER BY created_at DESC
       LIMIT 1`,
      [context.siteId, conversation.session_id, email, phone],
    );
    const existingId = existing.rows[0]?.id;
    if (existingId) {
      await this.markLeadCaptured(context, existingId, input);
      return {
        toolName: 'capture_lead',
        status: 'skipped',
        message: 'Lead existiert bereits.',
        data: { leadId: existingId },
      };
    }

    const leadId = randomUUID();
    const captured = await this.usageLimits.withMonthlyLeadLimit(context.tenantId, async (db, assertLimit) => {
      const duplicate = await db.query<{ id: string }>(
        `SELECT id
         FROM widget_leads
         WHERE site_id = $1
           AND session_id = $2
           AND (($3 <> '' AND email = $3) OR ($4 <> '' AND phone = $4))
         ORDER BY created_at DESC
         LIMIT 1`,
        [context.siteId, conversation.session_id, email, phone],
      );
      const duplicateId = duplicate.rows[0]?.id;
      if (duplicateId) {
        return { leadId: duplicateId, created: false };
      }

      await assertLimit();
      await db.query(
        `INSERT INTO widget_leads(id, site_id, session_id, name, email, phone, message, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', now())`,
        [
          leadId,
          context.siteId,
          conversation.session_id,
          text(input.name) || 'Unbekannt',
          email || '',
          phone || null,
          text(input.need) || 'Kontaktanfrage aus dem Chat',
        ],
      );
      return { leadId, created: true };
    });

    await this.markLeadCaptured(context, captured.leadId, input);
    if (!captured.created) {
      return {
        toolName: 'capture_lead',
        status: 'skipped',
        message: 'Lead existiert bereits.',
        data: { leadId: captured.leadId },
      };
    }

    await this.dispatchIntegrationEvent('lead.created', {
      leadId: captured.leadId,
      name: text(input.name) || 'Unbekannt',
      email,
      phone,
      need: text(input.need) || 'Kontaktanfrage aus dem Chat',
      source: text(input.source) || context.source,
    }, context);
    return {
      toolName: 'capture_lead',
      status: 'success',
      message: 'Lead wurde gespeichert.',
      data: { leadId: captured.leadId },
    };
  }

  private async markLeadCaptured(
    context: ToolExecutionContext,
    leadId: string,
    input: Record<string, unknown>,
  ) {
    await this.updateConversationMetadata(context, {
      toolExecutor: {
        leadId,
        leadStatus: 'captured',
        hasEmail: Boolean(text(input.email)),
        hasPhone: Boolean(text(input.phone)),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  private async scheduleContact(
    input: Record<string, unknown>,
    context: ToolExecutionContext,
    auditEntry: ToolAuditEntry,
  ): Promise<ToolExecutionResult> {
    const existing = await this.db.query<{ id: string }>(
      `SELECT id
       FROM agent_contact_requests
       WHERE site_id = $1
         AND (($2 <> '' AND email = $2) OR ($3 <> '' AND phone = $3))
         AND created_at > now() - interval '1 hour'
       ORDER BY created_at DESC
       LIMIT 1`,
      [context.siteId, text(input.email), text(input.phone)],
    );
    if (existing.rows[0]?.id) {
      return {
        toolName: 'schedule_contact',
        status: 'skipped',
        message: 'Kontaktanfrage existiert bereits.',
        data: { contactRequestId: existing.rows[0].id },
      };
    }

    const id = randomUUID();
    await this.db.query(
      `INSERT INTO agent_contact_requests(
         id, tenant_id, site_id, agent_run_id, name, email, phone, preferred_channel, note, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', now())`,
      [
        id,
        context.tenantId || null,
        context.siteId,
        auditEntry?.runId || null,
        text(input.name) || null,
        text(input.email) || null,
        text(input.phone) || null,
        text(input.preferredChannel) || null,
        text(input.topic) || 'Kontaktanfrage aus dem Chat',
      ],
    );
    await this.updateConversationMetadata(context, {
      toolExecutor: {
        contactRequestId: id,
        contactStatus: 'requested',
        updatedAt: new Date().toISOString(),
      },
    });
    await this.dispatchIntegrationEvent('contact.requested', {
      contactRequestId: id,
      name: text(input.name) || null,
      email: text(input.email) || null,
      phone: text(input.phone) || null,
      preferredChannel: text(input.preferredChannel) || null,
      topic: text(input.topic) || 'Kontaktanfrage aus dem Chat',
    }, context, auditEntry);
    return {
      toolName: 'schedule_contact',
      status: 'success',
      message: 'Kontaktanfrage wurde erstellt.',
      data: { contactRequestId: id },
    };
  }

  private async createTicket(
    input: Record<string, unknown>,
    context: ToolExecutionContext,
    auditEntry: ToolAuditEntry,
  ): Promise<ToolExecutionResult> {
    if (!auditEntry?.runId) {
      return failed('create_ticket', 'audit_run_missing', 'Ticket requires a valid agent run');
    }

    const ticketId = randomUUID();
    await this.db.query(
      `INSERT INTO agent_tickets(
         id, tenant_id, site_id, agent_run_id, title, description, reporter_name,
         reporter_email, location, priority, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, null, $7, null, $8, 'new', now())`,
      [
        ticketId,
        context.tenantId || null,
        context.siteId,
        auditEntry.runId,
        text(input.subject),
        text(input.description),
        text(input.customerEmail) || null,
        normalizePriority(text(input.priority)),
      ],
    );
    await this.updateConversationMetadata(context, {
      toolExecutor: {
        ticketId,
        ticketStatus: 'new',
        updatedAt: new Date().toISOString(),
      },
    });
    await this.dispatchIntegrationEvent('ticket.created', {
      ticketId,
      subject: text(input.subject),
      description: text(input.description),
      priority: normalizePriority(text(input.priority)),
      customerEmail: text(input.customerEmail) || null,
      status: 'new',
    }, context, auditEntry);
    return {
      toolName: 'create_ticket',
      status: 'success',
      message: 'Support-Ticket wurde erstellt.',
      data: { ticketId, status: 'new' },
    };
  }

  private async pushWebhook(
    input: Record<string, unknown>,
    context: ToolExecutionContext,
    auditEntry: ToolAuditEntry,
  ): Promise<ToolExecutionResult> {
    if (!auditEntry?.runId) {
      return failed('push_webhook', 'audit_run_missing', 'Webhook requires a valid agent run');
    }

    const eventType = text(input.eventType);
    if (eventType) {
      const dispatched = await this.integrationEvents.dispatch(
        context.siteId,
        eventType as 'lead.created' | 'ticket.created' | 'contact.requested' | 'conversation.handoff' | 'tool.executed',
        asObject(input.payload),
        {
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          messageId: context.messageId,
          source: context.source,
          agentRunId: auditEntry.runId,
          actorId: context.userId,
          actorRole: context.source,
        },
      );
      if (dispatched.length > 0) {
        return {
          toolName: 'push_webhook',
          status: dispatched.some((item) => item.status === 'queued') ? 'queued' : 'skipped',
          message: 'Webhook-Event wurde ueber aktive Integrationen verarbeitet.',
          data: { dispatched },
        };
      }
    }

    const providerKey = text(input.providerKey) || 'webhook';
    const connectionKey = text(input.connectionKey) || 'primary';
    const connection = await this.integrations.getConnectionForSite(context.siteId, providerKey, connectionKey);
    if (!connection || connection.status !== 'connected') {
      return {
        toolName: 'push_webhook',
        status: 'skipped',
        message: 'Keine aktive Webhook-Verbindung konfiguriert.',
        data: { providerKey, connectionKey },
      };
    }

    const endpointUrl = text(connection.config.url) || text(connection.config.endpointUrl) || text(connection.config.webhookUrl);
    if (!endpointUrl) {
      return failed('push_webhook', 'endpoint_missing', 'Webhook endpoint is missing');
    }

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const bearerToken = text(connection.secrets.bearerToken);
    const apiKey = text(connection.secrets.apiKey);
    if (bearerToken) {
      headers.authorization = `Bearer ${bearerToken}`;
    } else if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const queued = await this.webhookJobs.enqueue({
      tenantId: context.tenantId,
      siteId: context.siteId,
      agentRunId: auditEntry.runId,
      providerKey,
      connectionKey,
      endpointUrl,
      payload: {
        eventType: text(input.eventType),
        payload: asObject(input.payload),
        conversationId: context.conversationId,
      },
      headers,
    });

    return {
      toolName: 'push_webhook',
      status: 'queued',
      message: 'Webhook wurde eingereiht.',
      data: { webhookJobId: queued.id, providerKey, connectionKey },
    };
  }

  private async queryKnowledge(
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const query = text(input.query);
    const limit = Number(input.limit) || 4;
    const minScore = Number(input.minScore);
    const embedding = await this.embedder.embed(query);
    const hits = await this.vector.search(
      context.tenantId,
      context.siteId,
      embedding,
      limit,
      Number.isFinite(minScore) ? minScore : undefined,
    );
    const filtered = hits;

    return {
      toolName: 'query_knowledge',
      status: 'success',
      message: filtered.length > 0 ? 'Wissensquellen gefunden.' : 'Keine passenden Wissensquellen gefunden.',
      data: {
        query,
        resultCount: filtered.length,
        sources: filtered.map((hit) => ({
          sourceId: hit.source_id || undefined,
          title: hit.title || undefined,
          type: hit.source_type || undefined,
          url: hit.source_url || undefined,
          score: Number(hit.score),
          excerpt: hit.content ? hit.content.slice(0, 280) : undefined,
        })),
      },
    };
  }

  private async recommendService(
    input: Record<string, unknown>,
    site: SiteRow,
  ): Promise<ToolExecutionResult> {
    const config = asObject(site.config);
    const intent = text(input.intent);
    const industry = text(input.industry) || text(config.industry) || 'allgemein';
    const setupGoal = text(config.setupGoal);
    const recommendation =
      setupGoal === 'product_advice'
        ? 'Produktberatung / E-Commerce Advisor'
        : /support|ticket|faq|kunden/i.test(intent)
          ? 'Support-Automatisierung mit Wissensbasis'
          : /lead|kunden|angebot|sales|anfrage/i.test(intent)
            ? 'Lead- und Sales-Agent'
            : 'KI-Erstberatung mit Wissensbasis';

    return {
      toolName: 'recommend_service',
      status: 'success',
      message: 'Service-Empfehlung wurde vorbereitet.',
      data: {
        recommendation,
        intent,
        industry,
        urgency: text(input.urgency) || 'unknown',
        note: 'Keine Preis- oder Leistungszusage automatisch erzeugt.',
      },
    };
  }

  private async handoff(
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    await this.updateConversationMetadata(context, {
      handoff: {
        recommended: true,
        reason: text(input.reason),
        priority: normalizePriority(text(input.priority)),
        updatedAt: new Date().toISOString(),
      },
    });
    await this.dispatchIntegrationEvent('conversation.handoff', {
      reason: text(input.reason),
      priority: normalizePriority(text(input.priority)),
    }, context);
    return {
      toolName: 'handoff',
      status: 'success',
      message: 'Menschliche Uebergabe wurde markiert.',
      data: { handoffRecommended: true, priority: normalizePriority(text(input.priority)) },
    };
  }

  private async finish(auditEntry: ToolAuditEntry, result: ToolExecutionResult) {
    const auditId = await this.audit.finish(auditEntry, result);
    return auditId ? { ...result, auditId } : result;
  }

  private async dispatchIntegrationEvent(
    eventType: 'lead.created' | 'ticket.created' | 'contact.requested' | 'conversation.handoff',
    payload: Record<string, unknown>,
    context: ToolExecutionContext,
    auditEntry?: ToolAuditEntry,
  ) {
    try {
      await this.integrationEvents.dispatch(context.siteId, eventType, payload, {
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        messageId: context.messageId,
        source: context.source,
        agentRunId: auditEntry?.runId || null,
        actorId: context.userId,
        actorRole: context.source,
      });
    } catch {
      // Integration failures must not break the chat/tool result.
    }
  }
}

function failed(toolName: string, code: string, message: string): ToolExecutionResult {
  return {
    toolName,
    status: 'failed',
    message,
    error: { code, message },
  };
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getNestedString(input: Record<string, unknown>, path: string[]) {
  let current: unknown = input;
  for (const key of path) {
    current = asObject(current)[key];
  }
  return text(current);
}

function normalizePriority(value: string) {
  return ['low', 'normal', 'high', 'urgent'].includes(value) ? value : 'normal';
}

function extractLimitExceeded(error: unknown): { message: string } | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const response = 'response' in error ? (error as { response?: unknown }).response : null;
  const responseObject = asObject(response);
  if (responseObject.code !== 'limit_exceeded') {
    return null;
  }

  const message = text(responseObject.message) || 'Plan-Limit erreicht.';
  return { message };
}
