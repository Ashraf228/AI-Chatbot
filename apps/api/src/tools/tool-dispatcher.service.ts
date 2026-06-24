import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from '../sites/sites.service';
import { getToolDefinition } from './tool-registry';
import { IntegrationsService } from '../integrations/integrations.service';
import { EmailJobsService } from '../modules/widget/services/email-jobs.service';
import { LeadMailerService } from '../modules/widget/services/lead-mailer.service';
import { ReportMailerService } from '../modules/widget/services/report-mailer.service';
import { WebhookJobsService } from './webhook-jobs.service';
import { ShopifyCatalogService } from '../integrations/shopify/shopify-catalog.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { PropertyTicketingService } from '../modules/property-ticketing/property-ticketing.service';
import { UsageLimitService } from '../billing/usage-limit.service';
import { logEvent } from '../utils/logger';
import { deepRedactSensitiveValues, redactSensitiveText } from '../modules/it-support/it-support-flow';

type AgentRunRow = {
  id: string;
  tenant_id: string | null;
  site_id: string;
  status: string;
};

type ToolInvocationOutput = {
  id: string;
  agentRunId: string;
  tenantId: string | null;
  siteId: string;
  toolKey: string;
  status: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

function normalizeObject(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class ToolDispatcherService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
    private readonly integrations: IntegrationsService,
    private readonly emailJobs: EmailJobsService,
    private readonly leadMailer: LeadMailerService,
    private readonly reportMailer: ReportMailerService,
    private readonly webhookJobs: WebhookJobsService,
    private readonly shopifyCatalog: ShopifyCatalogService,
    private readonly embedder: EmbeddingService,
    private readonly vector: VectorService,
    private readonly propertyTicketing: PropertyTicketingService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  private async getRun(runId: string) {
    const res = await this.db.query<AgentRunRow>(
      `SELECT id, tenant_id, site_id, status
       FROM agent_runs
       WHERE id = $1
       LIMIT 1`,
      [runId],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Agent run not found');
    }

    return row;
  }

  private async createInvocation(
    run: AgentRunRow,
    toolKey: string,
    inputPayload: Record<string, unknown>,
  ) {
    const id = randomUUID();

    await this.db.query(
      `INSERT INTO tool_invocations(
         id,
         agent_run_id,
         tenant_id,
         site_id,
         tool_key,
         status,
         input_payload,
         output_payload,
         error_message,
         created_at,
         completed_at
       ) VALUES ($1, $2, $3, $4, $5, 'queued', $6::jsonb, '{}'::jsonb, null, now(), null)`,
      [id, run.id, run.tenant_id, run.site_id, toolKey, JSON.stringify(inputPayload)],
    );

    return id;
  }

  private async finalizeInvocation(
    invocationId: string,
    status: 'completed' | 'failed' | 'skipped',
    outputPayload: Record<string, unknown>,
    errorMessage?: string,
  ) {
    await this.db.query(
      `UPDATE tool_invocations
       SET status = $2,
           output_payload = $3::jsonb,
           error_message = $4,
           completed_at = now()
       WHERE id = $1`,
      [invocationId, status, JSON.stringify(outputPayload), errorMessage || null],
    );

    const res = await this.db.query<{
      id: string;
      agent_run_id: string;
      tenant_id: string | null;
      site_id: string;
      tool_key: string;
      status: string;
      input_payload: Record<string, unknown> | null;
      output_payload: Record<string, unknown> | null;
      error_message: string | null;
      created_at: string;
      completed_at: string | null;
    }>(
      `SELECT
         id,
         agent_run_id,
         tenant_id,
         site_id,
         tool_key,
         status,
         input_payload,
         output_payload,
         error_message,
         created_at,
         completed_at
       FROM tool_invocations
       WHERE id = $1`,
      [invocationId],
    );

    const row = res.rows[0];
    return {
      id: row.id,
      agentRunId: row.agent_run_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      toolKey: row.tool_key,
      status: row.status,
      inputPayload: normalizeObject(row.input_payload),
      outputPayload: normalizeObject(row.output_payload),
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    } satisfies ToolInvocationOutput;
  }

  private async updateRunStatus(
    runId: string,
    status: 'processing' | 'completed' | 'failed',
    outputSummary?: string,
    errorMessage?: string,
  ) {
    await this.db.query(
      `UPDATE agent_runs
       SET status = $2,
           started_at = CASE WHEN $2 = 'processing' AND started_at IS NULL THEN now() ELSE started_at END,
           output_summary = COALESCE($3, output_summary),
           error_message = $4,
           completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN now() ELSE completed_at END
       WHERE id = $1`,
      [runId, status, outputSummary || null, errorMessage || null],
    );
  }

  private async executeCaptureLead(
    run: AgentRunRow,
    inputPayload: Record<string, unknown>,
  ) {
    const site = await this.sites.getSite(run.site_id);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const name = normalizeString(inputPayload.name);
    const email = normalizeString(inputPayload.email);
    const phone = normalizeString(inputPayload.phone) || null;
    const message = normalizeString(inputPayload.message) || null;
    const status = ['new', 'contacted', 'qualified', 'closed'].includes(
      normalizeString(inputPayload.status),
    )
      ? normalizeString(inputPayload.status)
      : 'new';

    if (!name || !email) {
      throw new BadRequestException('capture_lead requires name and email');
    }

    const leadId = randomUUID();
    const sessionId = `agent-run:${run.id}`;

    const captured = await this.usageLimits.withMonthlyLeadLimit(run.tenant_id, async (db, assertLimit) => {
      const existing = await db.query<{ id: string }>(
        `SELECT id
         FROM widget_leads
         WHERE site_id = $1
           AND session_id = $2
           AND email = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [run.site_id, sessionId, email],
      );
      const existingId = existing.rows[0]?.id;
      if (existingId) {
        return { leadId: existingId, created: false };
      }

      await assertLimit();
      await db.query(
        `INSERT INTO widget_leads(id, site_id, session_id, name, email, phone, message, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [leadId, run.site_id, sessionId, name, email, phone, message, status],
      );
      return { leadId, created: true };
    });

    const siteConfig = normalizeObject(site.config);
    const leadNotificationEmail = normalizeString(siteConfig.leadNotificationEmail);
    const companyName = normalizeString(siteConfig.companyName) || site.name;

    let queuedNotification = false;
    if (captured.created && leadNotificationEmail) {
      if (this.reportMailer.isConfigured()) {
        const mailPayload = this.leadMailer.buildLeadNotification({
          recipientEmail: leadNotificationEmail,
          siteId: run.site_id,
          siteName: companyName,
          submittedAt: new Date().toISOString(),
          lead: { name, email, phone, message },
        });

        try {
          await this.emailJobs.enqueue({
            kind: 'lead_notification',
            ...mailPayload,
            metadata: {
              siteId: run.site_id,
              agentRunId: run.id,
              leadId,
              leadEmail: email,
            },
          });
          queuedNotification = true;
        } catch (error) {
          logEvent('lead_notification_failed', {
            siteId: run.site_id,
            agentRunId: run.id,
            recipientEmail: leadNotificationEmail,
            reason: 'email_queue_failed',
            error: error instanceof Error ? error.message : 'Unknown mail queue error',
          });
        }
      }
    }

    return {
      leadId: captured.leadId,
      status,
      created: captured.created,
      queuedNotification,
    };
  }

  private async executeScheduleContact(
    run: AgentRunRow,
    inputPayload: Record<string, unknown>,
  ) {
    const name = normalizeString(inputPayload.name) || null;
    const email = normalizeString(inputPayload.email) || null;
    const phone = normalizeString(inputPayload.phone) || null;
    const preferredChannel = normalizeString(inputPayload.preferredChannel) || null;
    const note = normalizeString(inputPayload.note) || null;

    if (!email && !phone) {
      throw new BadRequestException('schedule_contact requires email or phone');
    }

    const id = randomUUID();
    await this.db.query(
      `INSERT INTO agent_contact_requests(
         id,
         tenant_id,
         site_id,
         agent_run_id,
         name,
         email,
         phone,
         preferred_channel,
         note,
         status,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', now())`,
      [id, run.tenant_id, run.site_id, run.id, name, email, phone, preferredChannel, note],
    );

    return {
      contactRequestId: id,
      preferredChannel,
      status: 'new',
    };
  }

  private async executePushWebhook(
    run: AgentRunRow,
    inputPayload: Record<string, unknown>,
  ) {
    const providerKey = normalizeString(inputPayload.providerKey);
    const connectionKey = normalizeString(inputPayload.connectionKey) || 'primary';
    const payload = normalizeObject(
      inputPayload.payload as Record<string, unknown> | null | undefined,
    );

    if (!providerKey) {
      throw new BadRequestException('push_webhook requires providerKey');
    }

    const connection = await this.integrations.getConnectionForSite(
      run.site_id,
      providerKey,
      connectionKey,
    );

    if (!connection || connection.status !== 'connected') {
      throw new BadRequestException('Requested integration is not connected');
    }

    const endpointUrl =
      normalizeString(connection.config.endpointUrl) ||
      normalizeString(connection.config.webhookUrl);

    if (!endpointUrl) {
      throw new BadRequestException('Connected integration is missing endpointUrl');
    }

    const signingMode = connection.signingMode === 'hmac_sha256' ? 'hmac_sha256' : 'legacy_secret_header';
    const headers = this.integrations.buildHeaders(connection.config, connection.secrets, signingMode);

    const queued = await this.webhookJobs.enqueue({
      tenantId: run.tenant_id || '',
      siteId: run.site_id,
      agentRunId: run.id,
      providerKey,
      connectionKey,
      endpointUrl,
      payload,
      headers,
      signingMode,
      signingSecret: signingMode === 'hmac_sha256'
        ? this.integrations.getWebhookSigningSecret(connection.secrets)
        : undefined,
    });

    return {
      webhookJobId: queued.id,
      providerKey,
      connectionKey,
      queued: true,
    };
  }

  private async executeSearchCatalog(
    run: AgentRunRow,
    inputPayload: Record<string, unknown>,
  ) {
    const query = normalizeString(inputPayload.query || inputPayload.message);
    if (!query) {
      throw new BadRequestException('search_catalog requires query');
    }

    const limitRaw = Number(inputPayload.limit);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 3;
    const products = await this.shopifyCatalog.searchProductsForSite({
      siteId: run.site_id,
      query,
      limit,
    });

    return {
      query,
      resultCount: products.length,
      products,
    };
  }

  private async executeQueryKnowledge(
    run: AgentRunRow,
    inputPayload: Record<string, unknown>,
  ) {
    const query = normalizeString(inputPayload.query || inputPayload.message || inputPayload.inputSummary);
    if (!query) {
      throw new BadRequestException('query_knowledge requires query');
    }

    const site = await this.sites.getSite(run.site_id);
    const tenantId = run.tenant_id || site?.tenant_id;
    if (!tenantId) {
      throw new BadRequestException('Site has no tenant context');
    }

    const limitRaw = Number(inputPayload.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 6)) : 4;
    const embedding = await this.embedder.embed(query);
    const hits = await this.vector.search(tenantId, run.site_id, embedding, limit);

    return {
      query,
      resultCount: hits.length,
      hits: hits.map((hit) => ({
        id: hit.id,
        title: hit.title,
        sourceUrl: hit.source_url,
        score: hit.score,
        content: hit.content,
        metadata: normalizeObject(hit.metadata),
      })),
    };
  }

  private async executeCreateTicket(
    run: AgentRunRow,
    inputPayload: Record<string, unknown>,
  ) {
    const title = redactSensitiveText(normalizeString(inputPayload.title || inputPayload.subject) || 'Neuer Support-Fall');
    const description = redactSensitiveText(normalizeString(inputPayload.description || inputPayload.message));
    const reporterName = normalizeString(inputPayload.reporterName || inputPayload.customerName || inputPayload.name) || null;
    const reporterEmail = normalizeString(inputPayload.reporterEmail || inputPayload.customerEmail || inputPayload.email) || null;
    const reporterPhone = normalizeString(inputPayload.reporterPhone || inputPayload.phone) || null;
    const company = normalizeString(inputPayload.company) || null;
    const location = normalizeString(inputPayload.location || inputPayload.unit) || null;
    const priority = ['low', 'normal', 'high', 'urgent', 'critical'].includes(normalizeString(inputPayload.priority))
      ? normalizeString(inputPayload.priority)
      : 'normal';
    const category = normalizeString(inputPayload.category) || 'support';
    const issueType = normalizeString(inputPayload.issueType) || null;
    const affectedSystem = normalizeString(inputPayload.affectedSystem) || null;
    const impact = normalizeString(inputPayload.impact) || null;
    const urgency = ['low', 'normal', 'high', 'urgent', 'critical'].includes(normalizeString(inputPayload.urgency))
      ? normalizeString(inputPayload.urgency)
      : priority;
    const affectedUsers = normalizeString(inputPayload.affectedUsers) || null;
    const device = normalizeString(inputPayload.device) || null;
    const operatingSystem = normalizeString(inputPayload.operatingSystem) || null;
    const errorMessage = normalizeString(inputPayload.errorMessage)
      ? redactSensitiveText(normalizeString(inputPayload.errorMessage))
      : null;
    const alreadyTried = normalizeString(inputPayload.alreadyTried)
      ? redactSensitiveText(normalizeString(inputPayload.alreadyTried))
      : null;
    const department = normalizeString(inputPayload.department) || null;
    const source = normalizeString(inputPayload.source) || 'chat';
    const conversationId = normalizeString(inputPayload.conversationId) || null;
    const metadata = normalizeObject(
      deepRedactSensitiveValues(inputPayload.metadata) as Record<string, unknown> | null | undefined,
    );
    const explicitForward =
      inputPayload.forwardExternally === true ||
      inputPayload.forwardWebhook === true ||
      normalizeString(inputPayload.providerKey) === 'ticket-webhook';

    if (!description) {
      throw new BadRequestException('create_ticket requires description');
    }

    const id = randomUUID();
    await this.db.query(
      `INSERT INTO agent_tickets(
         id,
         tenant_id,
         site_id,
         agent_run_id,
         title,
         description,
         reporter_name,
         reporter_email,
         location,
         priority,
         status,
         reporter_phone,
         category,
         issue_type,
         affected_system,
         impact,
         urgency,
         affected_users,
         device,
         operating_system,
         error_message,
         already_tried,
         department,
         source,
         metadata,
         created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new',
         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
         $21, $22, $23, $24::jsonb, now()
       )`,
      [
        id,
        run.tenant_id,
        run.site_id,
        run.id,
        title,
        description,
        reporterName,
        reporterEmail,
        location,
        priority,
        reporterPhone,
        category,
        issueType,
        affectedSystem,
        impact,
        urgency,
        affectedUsers,
        device,
        operatingSystem,
        errorMessage,
        alreadyTried,
        department,
        source,
        JSON.stringify({
          ...metadata,
          company,
          conversationId,
        }),
      ],
    );

    const propertyConfig = await this.propertyTicketing.getConfigForSite(run.site_id);
    const shouldForward = explicitForward || propertyConfig.intakeMode === 'ticket_system';
    let webhookJobId: string | null = null;
    let forwardedToExternal = false;
    let forwardingStatus: 'queued' | 'not_configured' | 'disabled' = 'disabled';

    if (shouldForward) {
      const connection = await this.integrations.getConnectionForSite(
        run.site_id,
        'ticket-webhook',
        'primary',
      );

      if (
        connection &&
        connection.status === 'connected' &&
        (normalizeString(connection.config.endpointUrl) || normalizeString(connection.config.webhookUrl))
      ) {
        const endpointUrl =
          normalizeString(connection.config.endpointUrl) ||
          normalizeString(connection.config.webhookUrl);
        const headers: Record<string, string> = {
          'content-type': 'application/json',
        };
        const apiKey = normalizeString(connection.secrets.apiKey);
        const bearerToken = normalizeString(connection.secrets.bearerToken);

        if (bearerToken) {
          headers.authorization = `Bearer ${bearerToken}`;
        } else if (apiKey) {
          headers['x-api-key'] = apiKey;
        }

        const queued = await this.webhookJobs.enqueue({
          tenantId: run.tenant_id || '',
          siteId: run.site_id,
          agentRunId: run.id,
          providerKey: 'ticket-webhook',
          connectionKey: 'primary',
          endpointUrl,
          payload: buildTicketWebhookPayload({
            ticketId: id,
            subject: title,
            title,
            description,
            category,
            priority,
            urgency,
            impact,
            issueType,
            affectedSystem,
            affectedUsers,
            reporterName,
            reporterEmail,
            reporterPhone,
            company,
            department,
            location,
            device,
            operatingSystem,
            errorMessage,
            alreadyTried,
            status: 'new',
            source,
            conversationId,
            siteId: run.site_id,
            tenantId: run.tenant_id || null,
            metadata,
            createdAt: new Date().toISOString(),
          }),
          headers,
        });

        webhookJobId = queued.id;
        forwardedToExternal = true;
        forwardingStatus = 'queued';
      } else {
        forwardingStatus = 'not_configured';
      }
    }

    const persistedForwardingStatus = forwardingStatus === 'disabled' ? 'not_configured' : forwardingStatus;
    await this.db.query(
      `UPDATE agent_tickets
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $1 AND site_id = $3`,
      [
        id,
        JSON.stringify({
          forwardingStatus: persistedForwardingStatus,
          webhookJobId,
        }),
        run.site_id,
      ],
    );

    return {
      ticketId: id,
      title,
      category,
      priority,
      issueType,
      affectedSystem,
      status: 'new',
      forwardedToExternal,
      forwardingStatus: persistedForwardingStatus,
      webhookJobId,
    };
  }

  async execute(
    runId: string,
    payload: {
      toolKey: string;
      inputPayload?: Record<string, unknown>;
      controlRunStatus?: boolean;
    },
  ) {
    const definition = getToolDefinition(payload.toolKey);
    if (!definition) {
      throw new BadRequestException('Unknown toolKey');
    }

    const run = await this.getRun(runId);
    const inputPayload = normalizeObject(payload.inputPayload);
    const invocationId = await this.createInvocation(run, definition.key, inputPayload);

    if (payload.controlRunStatus !== false) {
      await this.updateRunStatus(run.id, 'processing');
    }

    try {
      let outputPayload: Record<string, unknown>;

      switch (definition.key) {
        case 'capture_lead':
          outputPayload = await this.executeCaptureLead(run, inputPayload);
          break;
        case 'schedule_contact':
          outputPayload = await this.executeScheduleContact(run, inputPayload);
          break;
        case 'push_webhook':
          outputPayload = await this.executePushWebhook(run, inputPayload);
          break;
        case 'search_catalog':
          outputPayload = await this.executeSearchCatalog(run, inputPayload);
          break;
        case 'query_knowledge':
          outputPayload = await this.executeQueryKnowledge(run, inputPayload);
          break;
        case 'create_ticket':
          outputPayload = await this.executeCreateTicket(run, inputPayload);
          break;
        default:
          throw new BadRequestException(`Tool execution not implemented for ${definition.key}`);
      }

      if (payload.controlRunStatus !== false) {
        await this.updateRunStatus(run.id, 'completed', `${definition.label} erfolgreich ausgefuehrt`);
      }
      return this.finalizeInvocation(invocationId, 'completed', outputPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown tool execution error';
      const limitError = extractLimitExceeded(error);
      const safeMessage = limitError?.message || message;
      if (payload.controlRunStatus !== false) {
        await this.updateRunStatus(run.id, 'failed', undefined, safeMessage);
      }
      return this.finalizeInvocation(
        invocationId,
        'failed',
        limitError ? { code: 'limit_exceeded', message: limitError.message } : {},
        safeMessage,
      );
    }
  }
}

function extractLimitExceeded(error: unknown): { message: string } | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const response = 'response' in error ? (error as { response?: unknown }).response : null;
  const responseObject = normalizeObject(response as Record<string, unknown> | null | undefined);
  if (responseObject.code !== 'limit_exceeded') {
    return null;
  }

  const message = normalizeString(responseObject.message) || 'Plan-Limit erreicht.';
  return { message };
}

function buildTicketWebhookPayload(input: {
  ticketId: string;
  subject: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  urgency: string;
  impact: string | null;
  issueType: string | null;
  affectedSystem: string | null;
  affectedUsers: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  company: string | null;
  department: string | null;
  location: string | null;
  device: string | null;
  operatingSystem: string | null;
  errorMessage: string | null;
  alreadyTried: string | null;
  status: string;
  source: string;
  conversationId: string | null;
  siteId: string;
  tenantId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}) {
  return deepRedactSensitiveValues({
    ticketId: input.ticketId,
    subject: input.subject,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    urgency: input.urgency,
    impact: input.impact,
    issueType: input.issueType,
    affectedSystem: input.affectedSystem,
    affectedUsers: input.affectedUsers,
    customerEmail: input.reporterEmail,
    customerName: input.reporterName,
    reporter: {
      name: input.reporterName,
      email: input.reporterEmail,
      phone: input.reporterPhone,
      company: input.company,
      department: input.department,
      location: input.location,
    },
    technicalContext: {
      device: input.device,
      operatingSystem: input.operatingSystem,
      errorMessage: input.errorMessage,
      alreadyTried: input.alreadyTried,
    },
    status: input.status,
    source: input.source,
    conversationId: input.conversationId,
    siteId: input.siteId,
    tenantId: input.tenantId,
    metadata: input.metadata,
    createdAt: input.createdAt,
  }) as Record<string, unknown>;
}
