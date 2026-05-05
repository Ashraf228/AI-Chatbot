import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../db/prisma.service';

type WebhookJobRow = {
  id: string;
  tenant_id?: string | null;
  site_id?: string;
  agent_run_id?: string | null;
  provider_key: string;
  connection_key: string;
  endpoint_url: string;
  method: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  retry_count: number;
  max_attempts: number;
  status?: string;
  last_error?: string | null;
  last_response_status?: number | null;
  last_response_body?: string | null;
  created_at?: string;
  completed_at?: string | null;
};

function clipText(value: string | null | undefined, maxLength = 4000) {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

@Injectable()
export class WebhookJobsService {
  private isProcessing = false;

  constructor(private readonly db: PrismaService) {}

  async enqueue(input: {
    tenantId: string;
    siteId: string;
    agentRunId: string;
    providerKey: string;
    connectionKey: string;
    endpointUrl: string;
    payload: Record<string, unknown>;
    headers?: Record<string, string>;
    maxAttempts?: number;
  }) {
    const id = randomUUID();

    await this.db.query(
      `INSERT INTO webhook_jobs(
         id,
         tenant_id,
         site_id,
         agent_run_id,
         provider_key,
         connection_key,
         endpoint_url,
         method,
         headers,
         payload,
         status,
         retry_count,
         max_attempts,
         available_at,
         locked_at,
         completed_at,
         last_error,
         last_response_status,
         last_response_body,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, 'POST', $8::jsonb, $9::jsonb, 'queued', 0, $10,
         now(), null, null, null, null, null, now(), now()
       )`,
      [
        id,
        input.tenantId || null,
        input.siteId,
        input.agentRunId,
        input.providerKey,
        input.connectionKey,
        input.endpointUrl,
        JSON.stringify(input.headers || {}),
        JSON.stringify(input.payload || {}),
        input.maxAttempts ?? 5,
      ],
    );

    void this.processPendingJobs();

    return { id, queued: true };
  }

  async retry(jobId: string) {
    const res = await this.db.query<WebhookJobRow>(
      `UPDATE webhook_jobs
       SET status = 'queued',
           retry_count = 0,
           available_at = now(),
           locked_at = null,
           completed_at = null,
           last_error = null,
           last_response_status = null,
           last_response_body = null,
           updated_at = now()
       WHERE id = $1
         AND status = 'failed'
       RETURNING
         id,
         tenant_id,
         site_id,
         agent_run_id,
         provider_key,
         connection_key,
         endpoint_url,
         method,
         headers,
         payload,
         retry_count,
         max_attempts,
         status,
         last_error,
         last_response_status,
         last_response_body,
         created_at,
         completed_at`,
      [jobId],
    );

    const row = res.rows[0];
    if (!row) {
      return null;
    }

    void this.processPendingJobs();

    return {
      id: row.id,
      tenantId: row.tenant_id || null,
      siteId: row.site_id || '',
      agentRunId: row.agent_run_id || null,
      providerKey: row.provider_key,
      connectionKey: row.connection_key,
      status: row.status || 'queued',
      retryCount: Number(row.retry_count || 0),
      maxAttempts: Number(row.max_attempts || 0),
      lastError: row.last_error || null,
      lastResponseStatus: row.last_response_status ?? null,
      lastResponseBody: row.last_response_body || null,
      createdAt: row.created_at || null,
      completedAt: row.completed_at || null,
    };
  }

  @Cron('*/30 * * * * *')
  async processPendingJobs() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (true) {
        const job = await this.pickNextJob();
        if (!job) {
          break;
        }

        await this.processJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async pickNextJob() {
    const res = await this.db.query<WebhookJobRow>(
      `WITH next_job AS (
         SELECT id
         FROM webhook_jobs
         WHERE status = 'queued'
           AND available_at <= now()
         ORDER BY available_at ASC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE webhook_jobs wj
       SET status = 'processing',
           locked_at = now(),
           updated_at = now()
       FROM next_job
       WHERE wj.id = next_job.id
       RETURNING
         wj.id,
         wj.provider_key,
         wj.connection_key,
         wj.endpoint_url,
         wj.method,
         wj.headers,
         wj.payload,
         wj.retry_count,
         wj.max_attempts`,
    );

    return res.rows[0];
  }

  private async processJob(job: WebhookJobRow) {
    try {
      const response = await fetch(job.endpoint_url, {
        method: job.method || 'POST',
        headers: job.headers || {},
        body: JSON.stringify(job.payload || {}),
      });
      const responseBody = clipText(await response.text());

      if (!response.ok) {
        await this.markJobFailure(job, `Webhook returned ${response.status}`, response.status, responseBody);
        return;
      }

      await this.db.query(
        `UPDATE webhook_jobs
         SET status = 'sent',
             completed_at = now(),
             locked_at = null,
             last_error = null,
             last_response_status = $2,
             last_response_body = $3,
             updated_at = now()
         WHERE id = $1`,
        [job.id, response.status, responseBody],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown webhook error';
      await this.markJobFailure(job, message, null, null);
    }
  }

  private async markJobFailure(
    job: WebhookJobRow,
    message: string,
    responseStatus: number | null,
    responseBody: string | null,
  ) {
    const nextRetryCount = Number(job.retry_count || 0) + 1;
    const exhausted = nextRetryCount >= Number(job.max_attempts || 5);

    await this.db.query(
      `UPDATE webhook_jobs
       SET status = $2,
           retry_count = $3,
           available_at = CASE
             WHEN $2 = 'queued' THEN now() + ($4 * interval '1 minute')
             ELSE available_at
           END,
           locked_at = null,
           completed_at = CASE WHEN $2 = 'failed' THEN now() ELSE completed_at END,
           last_error = $5,
           last_response_status = $6,
           last_response_body = $7,
           updated_at = now()
       WHERE id = $1`,
      [
        job.id,
        exhausted ? 'failed' : 'queued',
        nextRetryCount,
        Math.min(nextRetryCount * 2, 30),
        message,
        responseStatus,
        responseBody,
      ],
    );
  }
}
