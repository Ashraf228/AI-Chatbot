import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../db/prisma.service';
import { logEvent } from '../../utils/logger';
import { AgentDecision, AgentRunLogStart } from './agent-decision.types';

@Injectable()
export class AgentRunLoggerService {
  constructor(private readonly db: PrismaService) {}

  async start(input: {
    tenantId: string;
    siteId: string;
    conversationId: string;
    message: string;
  }): Promise<AgentRunLogStart> {
    const runId = randomUUID();
    const startedAt = Date.now();

    try {
      await this.db.query(
        `INSERT INTO agent_runs(
           id, tenant_id, site_id, agent_key, trigger_source, status, input_summary, metadata, started_at, created_at
         ) VALUES ($1, $2, $3, 'chat-decision-orchestrator', 'chat', 'processing', $4, $5::jsonb, now(), now())`,
        [
          runId,
          input.tenantId,
          input.siteId,
          summarize(input.message),
          JSON.stringify({
            conversationId: input.conversationId,
            inputLength: input.message.length,
          }),
        ],
      );
      return { runId, startedAt };
    } catch (error) {
      logEvent('agent_run_log_failed', {
        siteId: input.siteId,
        conversationId: input.conversationId,
        phase: 'start',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async complete(run: AgentRunLogStart, decision: AgentDecision) {
    if (!run) {
      return;
    }

    const durationMs = Date.now() - run.startedAt;
    try {
      await this.db.query(
        `UPDATE agent_runs
         SET status = 'completed',
             output_summary = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
             completed_at = now()
         WHERE id = $1`,
        [
          run.runId,
          `${decision.type} (${decision.confidence})`,
          JSON.stringify({
            decisionType: decision.type,
            confidence: decision.confidence,
            reason: decision.reason,
            suggestedTools: decision.suggestedTools,
            requiredFields: decision.requiredFields,
            nextAction: decision.nextAction,
            durationMs,
          }),
        ],
      );
    } catch (error) {
      logEvent('agent_run_log_failed', {
        runId: run.runId,
        phase: 'complete',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async fail(run: AgentRunLogStart, error: unknown) {
    if (!run) {
      return;
    }

    const durationMs = Date.now() - run.startedAt;
    try {
      await this.db.query(
        `UPDATE agent_runs
         SET status = 'failed',
             error_message = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
             completed_at = now()
         WHERE id = $1`,
        [
          run.runId,
          error instanceof Error ? error.message : 'Unknown orchestration error',
          JSON.stringify({ durationMs }),
        ],
      );
    } catch (logError) {
      logEvent('agent_run_log_failed', {
        runId: run.runId,
        phase: 'fail',
        error: logError instanceof Error ? logError.message : 'Unknown error',
      });
    }
  }
}

function summarize(message: string) {
  const normalized = message.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 240) {
    return normalized;
  }
  return `${normalized.slice(0, 237)}...`;
}
