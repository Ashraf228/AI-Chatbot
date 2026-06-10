import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../db/prisma.service';
import { logEvent } from '../utils/logger';
import { sanitizeToolInputForLog } from './tool-input.schema';
import { ToolExecutionContext } from './tool-context.types';
import { ToolAuditEntry, ToolExecutionResult } from './tool-result.types';

@Injectable()
export class ToolAuditService {
  constructor(private readonly db: PrismaService) {}

  async start(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolAuditEntry> {
    try {
      const runId = await this.ensureRun(toolName, context);
      const invocationId = randomUUID();
      await this.db.query(
        `INSERT INTO tool_invocations(
           id, agent_run_id, tenant_id, site_id, tool_key, status, input_payload, output_payload,
           error_message, created_at, completed_at
         ) VALUES ($1, $2, $3, $4, $5, 'queued', $6::jsonb, '{}'::jsonb, null, now(), null)`,
        [
          invocationId,
          runId,
          context.tenantId || null,
          context.siteId,
          toolName,
          JSON.stringify(sanitizeToolInputForLog(input)),
        ],
      );

      return { runId, invocationId, startedAt: Date.now() };
    } catch (error) {
      logEvent('tool_audit_start_failed', {
        toolName,
        siteId: context.siteId,
        conversationId: context.conversationId,
        error: error instanceof Error ? error.message : 'Unknown audit error',
      });
      return null;
    }
  }

  async finish(entry: ToolAuditEntry, result: ToolExecutionResult) {
    if (!entry) {
      return undefined;
    }

    const durationMs = Date.now() - entry.startedAt;
    try {
      await this.db.query(
        `UPDATE tool_invocations
         SET status = $2,
             output_payload = $3::jsonb,
             error_message = $4,
             completed_at = now()
         WHERE id = $1`,
        [
          entry.invocationId,
          result.status,
          JSON.stringify({
            status: result.status,
            message: result.message,
            data: summarizeData(result.data || {}),
            missingFields: result.missingFields || [],
            durationMs,
          }),
          result.error?.message || null,
        ],
      );

      await this.db.query(
        `UPDATE agent_runs
         SET status = CASE WHEN status = 'processing' THEN 'completed' ELSE status END,
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             completed_at = CASE WHEN completed_at IS NULL THEN now() ELSE completed_at END
         WHERE id = $1`,
        [
          entry.runId,
          JSON.stringify({
            lastToolExecution: {
              toolName: result.toolName,
              status: result.status,
              durationMs,
              invocationId: entry.invocationId,
            },
          }),
        ],
      );

      return entry.invocationId;
    } catch (error) {
      logEvent('tool_audit_finish_failed', {
        toolName: result.toolName,
        invocationId: entry.invocationId,
        error: error instanceof Error ? error.message : 'Unknown audit error',
      });
      return undefined;
    }
  }

  private async ensureRun(toolName: string, context: ToolExecutionContext) {
    if (context.decisionId) {
      const existing = await this.db.query<{ id: string }>(
        `SELECT id
         FROM agent_runs
         WHERE id = $1 AND site_id = $2
         LIMIT 1`,
        [context.decisionId, context.siteId],
      );
      if (existing.rows[0]?.id) {
        return existing.rows[0].id;
      }
    }

    const id = randomUUID();
    await this.db.query(
      `INSERT INTO agent_runs(
         id, tenant_id, site_id, agent_key, trigger_source, status, input_summary, metadata, started_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, 'processing', $6, $7::jsonb, now(), now())`,
      [
        id,
        context.tenantId || null,
        context.siteId,
        context.agentKey || 'tool-executor',
        context.source || 'system',
        `Tool execution: ${toolName}`,
        JSON.stringify({
          conversationId: context.conversationId,
          moduleKey: context.moduleKey || null,
          messageId: context.messageId || null,
          userId: context.userId || null,
          visitorId: context.visitorId || null,
        }),
      ],
    );

    return id;
  }
}

function summarizeData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (/email|phone|name/i.test(key)) {
        return [key, value ? '[redacted]' : value];
      }
      if (typeof value === 'string' && value.length > 240) {
        return [key, `${value.slice(0, 237)}...`];
      }
      if (Array.isArray(value)) {
        return [key, { count: value.length }];
      }
      return [key, value];
    }),
  );
}
