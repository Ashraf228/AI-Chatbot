import { BadRequestException, Injectable } from '@nestjs/common';
import { getAgentDefinition } from './agent-registry';
import { AgentsService } from './agents.service';
import { ToolDispatcherService } from '../tools/tool-dispatcher.service';

type OrchestratorToolInputs = Record<string, Record<string, unknown>>;

function normalizeObject(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function summarizeKnowledgeHits(hits: unknown) {
  if (!Array.isArray(hits) || hits.length === 0) {
    return 'keine Wissens-Treffer';
  }

  return `${hits.length} Wissens-Treffer`;
}

@Injectable()
export class AgentOrchestratorService {
  constructor(
    private readonly agents: AgentsService,
    private readonly tools: ToolDispatcherService,
  ) {}

  private getBaseQuery(run: {
    inputSummary?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const metadata = normalizeObject(run.metadata);
    return (
      normalizeString(metadata.query) ||
      normalizeString(metadata.message) ||
      normalizeString(run.inputSummary) ||
      ''
    );
  }

  private buildToolPayload(
    run: {
      agentKey: string;
      inputSummary?: string | null;
      metadata?: Record<string, unknown>;
    },
    toolKey: string,
    toolInputs: OrchestratorToolInputs,
  ) {
    const metadata = normalizeObject(run.metadata);
    const baseQuery = this.getBaseQuery(run);
    const explicit = normalizeObject(toolInputs[toolKey]);

    if (Object.keys(explicit).length > 0) {
      return explicit;
    }

    switch (toolKey) {
      case 'query_knowledge':
        return baseQuery ? { query: baseQuery, limit: 4 } : null;
      case 'search_catalog':
        return baseQuery ? { query: baseQuery, limit: 4 } : null;
      case 'capture_lead':
        return normalizeObject(metadata.lead as Record<string, unknown> | null | undefined);
      case 'schedule_contact':
        return normalizeObject(metadata.contact as Record<string, unknown> | null | undefined);
      case 'create_ticket': {
        const ticket = normalizeObject(metadata.ticket as Record<string, unknown> | null | undefined);
        if (Object.keys(ticket).length > 0) {
          return ticket;
        }

        return baseQuery
          ? {
              title: 'Automatisch erfasster Support-Fall',
              description: baseQuery,
            }
          : null;
      }
      case 'push_webhook': {
        const webhook = normalizeObject(metadata.webhook as Record<string, unknown> | null | undefined);
        if (Object.keys(webhook).length > 0) {
          return webhook;
        }

        return null;
      }
      default:
        return null;
    }
  }

  private shouldSkipTool(toolKey: string, payload: Record<string, unknown> | null) {
    if (!payload || Object.keys(payload).length === 0) {
      return true;
    }

    if ((toolKey === 'capture_lead' || toolKey === 'schedule_contact') && !payload.email && !payload.phone) {
      return true;
    }

    if (toolKey === 'capture_lead' && (!payload.name || !payload.email)) {
      return true;
    }

    if (toolKey === 'push_webhook' && !payload.providerKey) {
      return true;
    }

    if ((toolKey === 'query_knowledge' || toolKey === 'search_catalog') && !payload.query) {
      return true;
    }

    if (toolKey === 'create_ticket' && !payload.description && !payload.title) {
      return true;
    }

    return false;
  }

  private summarizeToolResult(toolKey: string, outputPayload: Record<string, unknown>) {
    switch (toolKey) {
      case 'query_knowledge':
        return summarizeKnowledgeHits(outputPayload.hits);
      case 'search_catalog':
        return `${Number(outputPayload.resultCount || 0)} Katalog-Treffer`;
      case 'capture_lead':
        return outputPayload.leadId ? 'Lead erfasst' : 'Lead-Schritt ausgefuehrt';
      case 'schedule_contact':
        return outputPayload.contactRequestId ? 'Kontaktwunsch vorgemerkt' : 'Kontakt-Schritt ausgefuehrt';
      case 'create_ticket':
        return outputPayload.ticketId ? 'Ticket angelegt' : 'Ticket-Schritt ausgefuehrt';
      case 'push_webhook':
        return outputPayload.webhookJobId ? 'Webhook eingereiht' : 'Webhook-Schritt ausgefuehrt';
      default:
        return toolKey;
    }
  }

  async executeExistingRun(
    runId: string,
    payload?: {
      toolInputs?: OrchestratorToolInputs;
      continueOnError?: boolean;
    },
  ) {
    const run = await this.agents.getRunById(runId);
    const definition = getAgentDefinition(run.agentKey);
    if (!definition) {
      throw new BadRequestException('Unknown agent definition');
    }

    const toolInputs = normalizeObject(payload?.toolInputs) as OrchestratorToolInputs;
    const continueOnError = payload?.continueOnError === true;
    const executedTools: string[] = [];
    const skippedTools: string[] = [];
    const failedTools: string[] = [];
    const stepSummaries: string[] = [];

    await this.agents.updateRunStatus(runId, {
      status: 'processing',
      errorMessage: null,
      metadata: {
        orchestration: {
          plan: definition.defaultToolPlan,
          continueOnError,
        },
      },
    });

    for (const toolKey of definition.defaultToolPlan) {
      const toolPayload = this.buildToolPayload(run, toolKey, toolInputs);
      if (this.shouldSkipTool(toolKey, toolPayload)) {
        skippedTools.push(toolKey);
        continue;
      }

      const invocation = await this.tools.execute(runId, {
        toolKey,
        inputPayload: toolPayload || {},
        controlRunStatus: false,
      });

      if (invocation.status === 'failed') {
        failedTools.push(toolKey);
        if (!continueOnError) {
          await this.agents.updateRunStatus(runId, {
            status: 'failed',
            outputSummary: stepSummaries.join(' · ') || null,
            errorMessage: invocation.errorMessage || `Tool ${toolKey} failed`,
            metadata: {
              orchestration: {
                plan: definition.defaultToolPlan,
                executedTools,
                skippedTools,
                failedTools,
              },
            },
          });
          return {
            run: await this.agents.getRunById(runId),
            tools: await this.agents.listToolInvocations(runId),
          };
        }

        continue;
      }

      executedTools.push(toolKey);
      stepSummaries.push(this.summarizeToolResult(toolKey, invocation.outputPayload));
    }

    const finalStatus = failedTools.length > 0 ? 'failed' : 'completed';
    const outputSummary =
      stepSummaries.length > 0
        ? stepSummaries.join(' · ')
        : skippedTools.length > 0
          ? 'Keine ausfuehrbaren Tool-Schritte fuer diesen Lauf'
          : 'Agentenlauf abgeschlossen';

    await this.agents.updateRunStatus(runId, {
      status: finalStatus,
      outputSummary,
      errorMessage: failedTools.length > 0 ? `Fehlgeschlagene Tools: ${failedTools.join(', ')}` : null,
      metadata: {
        orchestration: {
          plan: definition.defaultToolPlan,
          executedTools,
          skippedTools,
          failedTools,
        },
      },
    });

    return {
      run: await this.agents.getRunById(runId),
      tools: await this.agents.listToolInvocations(runId),
    };
  }

  async createAndExecute(
    siteId: string,
    payload: {
      agentKey: string;
      inputSummary?: string;
      triggerSource?: 'manual' | 'chat' | 'automation';
      metadata?: Record<string, unknown>;
      toolInputs?: OrchestratorToolInputs;
      continueOnError?: boolean;
    },
  ) {
    const run = await this.agents.createRun(siteId, {
      agentKey: payload.agentKey,
      inputSummary: payload.inputSummary,
      triggerSource: payload.triggerSource,
      metadata: payload.metadata,
    });

    if (!run) {
      throw new BadRequestException('Agent run could not be created');
    }

    return this.executeExistingRun(run.id, {
      toolInputs: payload.toolInputs,
      continueOnError: payload.continueOnError,
    });
  }
}
