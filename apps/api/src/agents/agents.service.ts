import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SitesService } from '../sites/sites.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { PrismaService } from '../db/prisma.service';
import { AGENT_REGISTRY, getAgentDefinition } from './agent-registry';
import { getToolDefinition } from '../tools/tool-registry';
import { WebhookJobsService } from '../tools/webhook-jobs.service';

type AgentRunRow = {
  id: string;
  tenant_id: string | null;
  site_id: string;
  agent_key: string;
  trigger_source: string;
  status: string;
  input_summary: string | null;
  output_summary: string | null;
  metadata: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type ToolInvocationRow = {
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
};

type AgentTicketRow = {
  id: string;
  tenant_id: string | null;
  site_id: string;
  agent_run_id: string;
  title: string;
  description: string;
  reporter_name: string | null;
  reporter_email: string | null;
  location: string | null;
  priority: string;
  status: string;
  created_at: string;
};

type WebhookJobRow = {
  id: string;
  tenant_id: string | null;
  site_id: string;
  agent_run_id: string | null;
  provider_key: string;
  connection_key: string;
  endpoint_url: string;
  payload: Record<string, unknown> | null;
  status: string;
  retry_count: number;
  max_attempts: number;
  last_error: string | null;
  last_response_status: number | null;
  last_response_body: string | null;
  created_at: string;
  completed_at: string | null;
};

function normalizeObject(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mapRunRow(row: AgentRunRow) {
  const definition = getAgentDefinition(row.agent_key);
  return {
    id: row.id,
    siteId: row.site_id,
    tenantId: row.tenant_id,
    agentKey: row.agent_key,
    agentLabel: definition?.label || row.agent_key,
    triggerSource: row.trigger_source,
    status: row.status,
    inputSummary: row.input_summary,
    outputSummary: row.output_summary,
    metadata: normalizeObject(row.metadata),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function mapTicketRow(row: AgentTicketRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    agentRunId: row.agent_run_id,
    title: row.title,
    description: row.description,
    reporterName: row.reporter_name,
    reporterEmail: row.reporter_email,
    location: row.location,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapWebhookJobRow(row: WebhookJobRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    agentRunId: row.agent_run_id,
    providerKey: row.provider_key,
    connectionKey: row.connection_key,
    endpointUrl: row.endpoint_url,
    payload: normalizeObject(row.payload),
    status: row.status,
    retryCount: Number(row.retry_count || 0),
    maxAttempts: Number(row.max_attempts || 0),
    lastError: row.last_error,
    lastResponseStatus: row.last_response_status ?? null,
    lastResponseBody: row.last_response_body || null,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
    private readonly siteModules: SiteModulesService,
    private readonly webhookJobs: WebhookJobsService,
  ) {}

  async listAvailableAgents(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const modules = await this.siteModules.listForSite(siteId);
    const enabledModuleKeys = new Set(
      modules.filter((module) => module.isEnabled).map((module) => module.key),
    );

    return AGENT_REGISTRY.map((agent) => {
      const missingModules = agent.requiredModuleKeys.filter((key) => !enabledModuleKeys.has(key));
      return {
        key: agent.key,
        label: agent.label,
        description: agent.description,
        category: agent.category,
        requiredModuleKeys: agent.requiredModuleKeys,
        toolKeys: agent.toolKeys,
        tools: agent.toolKeys.map((toolKey) => getToolDefinition(toolKey)).filter(Boolean),
        isAvailable: missingModules.length === 0,
        missingModules,
      };
    });
  }

  async listRuns(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const res = await this.db.query<AgentRunRow>(
      `SELECT
         id,
         tenant_id,
         site_id,
         agent_key,
         trigger_source,
         status,
         input_summary,
         output_summary,
         metadata,
         error_message,
         created_at,
         started_at,
         completed_at
       FROM agent_runs
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [siteId],
    );

    return res.rows.map(mapRunRow);
  }

  async createRun(
    siteId: string,
    payload: {
      agentKey: string;
      inputSummary?: string;
      triggerSource?: 'manual' | 'chat' | 'automation';
      metadata?: Record<string, unknown>;
    },
  ) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const tenantId = site.tenant_id;
    if (!tenantId) {
      throw new BadRequestException('Site has no tenant');
    }

    const definition = getAgentDefinition(payload.agentKey);
    if (!definition) {
      throw new BadRequestException('Unknown agentKey');
    }

    const availableAgents = await this.listAvailableAgents(siteId);
    const selected = availableAgents.find((agent) => agent.key === definition.key);
    if (!selected?.isAvailable) {
      throw new BadRequestException('Agent prerequisites not met');
    }

    const id = randomUUID();
    await this.db.query(
      `INSERT INTO agent_runs(
         id,
         tenant_id,
         site_id,
         agent_key,
         trigger_source,
         status,
         input_summary,
         metadata,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7::jsonb, now())`,
      [
        id,
        tenantId,
        siteId,
        definition.key,
        payload.triggerSource || 'manual',
        payload.inputSummary || null,
        JSON.stringify(normalizeObject(payload.metadata)),
      ],
    );

    const runs = await this.listRuns(siteId);
    return runs.find((run) => run.id === id) || null;
  }

  async getRunById(runId: string) {
    const res = await this.db.query<AgentRunRow>(
      `SELECT
         id,
         tenant_id,
         site_id,
         agent_key,
         trigger_source,
         status,
         input_summary,
         output_summary,
         metadata,
         error_message,
         created_at,
         started_at,
         completed_at
       FROM agent_runs
       WHERE id = $1
       LIMIT 1`,
      [runId],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Agent run not found');
    }

    return mapRunRow(row);
  }

  async updateRunStatus(
    runId: string,
    payload: {
      status: 'queued' | 'processing' | 'completed' | 'failed';
      outputSummary?: string | null;
      errorMessage?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const current = await this.getRunById(runId);
    const mergedMetadata = {
      ...normalizeObject(current.metadata),
      ...normalizeObject(payload.metadata),
    };

    await this.db.query(
      `UPDATE agent_runs
       SET status = $2,
           output_summary = $3,
           error_message = $4,
           metadata = $5::jsonb,
           started_at = CASE WHEN $2 = 'processing' AND started_at IS NULL THEN now() ELSE started_at END,
           completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN now() ELSE completed_at END
       WHERE id = $1`,
      [
        runId,
        payload.status,
        payload.outputSummary ?? current.outputSummary ?? null,
        payload.errorMessage ?? null,
        JSON.stringify(mergedMetadata),
      ],
    );

    return this.getRunById(runId);
  }

  async listToolInvocations(runId: string) {
    const res = await this.db.query<ToolInvocationRow>(
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
       WHERE agent_run_id = $1
       ORDER BY created_at ASC`,
      [runId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      agentRunId: row.agent_run_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      toolKey: row.tool_key,
      toolLabel: getToolDefinition(row.tool_key)?.label || row.tool_key,
      status: row.status,
      inputPayload: normalizeObject(row.input_payload),
      outputPayload: normalizeObject(row.output_payload),
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
  }

  async listTickets(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const res = await this.db.query<AgentTicketRow>(
      `SELECT
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
         created_at
       FROM agent_tickets
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [siteId],
    );

    return res.rows.map(mapTicketRow);
  }

  async listWebhookJobs(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const res = await this.db.query<WebhookJobRow>(
      `SELECT
         id,
         tenant_id,
         site_id,
         agent_run_id,
         provider_key,
         connection_key,
         endpoint_url,
         payload,
         status,
         retry_count,
         max_attempts,
         last_error,
         last_response_status,
         last_response_body,
         created_at,
         completed_at
       FROM webhook_jobs
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [siteId],
    );

    return res.rows.map(mapWebhookJobRow);
  }

  async updateTicketStatus(
    ticketId: string,
    status: 'new' | 'open' | 'in_progress' | 'resolved' | 'closed',
  ) {
    const res = await this.db.query<AgentTicketRow>(
      `UPDATE agent_tickets
       SET status = $2
       WHERE id = $1
       RETURNING
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
         created_at`,
      [ticketId, status],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Agent ticket not found');
    }

    return mapTicketRow(row);
  }

  async retryWebhookJob(jobId: string) {
    const retried = await this.webhookJobs.retry(jobId);
    if (!retried) {
      throw new NotFoundException('Failed webhook job not found');
    }

    return retried;
  }

  async recordToolInvocation(
    runId: string,
    payload: {
      toolKey: string;
      status?: 'queued' | 'completed' | 'failed' | 'skipped';
      inputPayload?: Record<string, unknown>;
      outputPayload?: Record<string, unknown>;
      errorMessage?: string;
    },
  ) {
    const runRes = await this.db.query<AgentRunRow>(
      `SELECT *
       FROM agent_runs
       WHERE id = $1
       LIMIT 1`,
      [runId],
    );

    const run = runRes.rows[0];
    if (!run) {
      throw new NotFoundException('Agent run not found');
    }

    if (!getToolDefinition(payload.toolKey)) {
      throw new BadRequestException('Unknown toolKey');
    }

    const id = randomUUID();
    const status = payload.status || 'queued';
    const completedAt = status === 'completed' || status === 'failed' || status === 'skipped';

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
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, now(), $10)`,
      [
        id,
        run.id,
        run.tenant_id,
        run.site_id,
        payload.toolKey,
        status,
        JSON.stringify(normalizeObject(payload.inputPayload)),
        JSON.stringify(normalizeObject(payload.outputPayload)),
        payload.errorMessage || null,
        completedAt ? new Date().toISOString() : null,
      ],
    );

    const invocations = await this.listToolInvocations(runId);
    return invocations.find((invocation) => invocation.id === id) || null;
  }

  async getOverview(siteId: string) {
    const [agents, runs, tickets, webhookJobs] = await Promise.all([
      this.listAvailableAgents(siteId),
      this.listRuns(siteId),
      this.listTickets(siteId),
      this.listWebhookJobs(siteId),
    ]);

    return { agents, runs, tickets, webhookJobs };
  }
}
