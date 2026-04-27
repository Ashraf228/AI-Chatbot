import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../../db/prisma.service';
import { logEvent } from '../../../utils/logger';
import { MailMessage, ReportMailerService } from './report-mailer.service';

type EmailJobKind = 'lead_notification' | 'report';

type EmailJobMetadata = Record<string, unknown>;

type EnqueueEmailJobInput = MailMessage & {
  kind: EmailJobKind;
  metadata?: EmailJobMetadata;
  maxAttempts?: number;
};

type EmailJobRow = {
  id: string;
  kind: EmailJobKind;
  recipient_email: string;
  subject: string;
  html: string | null;
  text: string | null;
  metadata: EmailJobMetadata;
  retry_count: number;
  max_attempts: number;
};

@Injectable()
export class EmailJobsService {
  private isProcessing = false;

  constructor(
    private readonly db: PrismaService,
    private readonly reportMailer: ReportMailerService,
  ) {}

  async enqueue(input: EnqueueEmailJobInput) {
    const id = randomUUID();

    await this.db.query(
      `INSERT INTO email_jobs(
         id, kind, status, recipient_email, subject, html, text, metadata, retry_count, max_attempts,
         available_at, locked_at, sent_at, last_error, created_at, updated_at
       )
       VALUES (
         $1, $2, 'queued', $3, $4, $5, $6, $7::jsonb, 0, $8,
         now(), null, null, null, now(), now()
       )`,
      [
        id,
        input.kind,
        input.to,
        input.subject,
        input.html || null,
        input.text || null,
        JSON.stringify(input.metadata || {}),
        input.maxAttempts ?? 5,
      ],
    );

    void this.processPendingJobs();

    return { id, queued: true };
  }

  @Cron('*/30 * * * * *')
  async processPendingJobs() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (true) {
        const picked = await this.pickNextJob();
        if (!picked) {
          break;
        }

        await this.processJob(picked);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async pickNextJob() {
    const res = await this.db.query<EmailJobRow>(
      `WITH next_job AS (
         SELECT id
         FROM email_jobs
         WHERE status = 'queued'
           AND available_at <= now()
         ORDER BY available_at ASC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE email_jobs ej
       SET status = 'processing',
           locked_at = now(),
           updated_at = now()
       FROM next_job
       WHERE ej.id = next_job.id
       RETURNING
         ej.id,
         ej.kind,
         ej.recipient_email,
         ej.subject,
         ej.html,
         ej.text,
         ej.metadata,
         ej.retry_count,
         ej.max_attempts`,
    );

    return res.rows[0];
  }

  private async processJob(job: EmailJobRow) {
    try {
      await this.reportMailer.send({
        to: job.recipient_email,
        subject: job.subject,
        html: job.html || undefined,
        text: job.text || undefined,
      });

      await this.db.query(
        `UPDATE email_jobs
         SET status = 'sent',
             sent_at = now(),
             locked_at = null,
             last_error = null,
             updated_at = now()
         WHERE id = $1`,
        [job.id],
      );

      await this.syncRelatedRecords(job, 'sent');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown mail queue error';
      const nextRetryCount = Number(job.retry_count || 0) + 1;
      const exhausted = nextRetryCount >= Number(job.max_attempts || 5);

      await this.db.query(
        `UPDATE email_jobs
         SET status = $2,
             retry_count = $3,
             available_at = CASE
               WHEN $2 = 'queued' THEN now() + ($4 * interval '1 minute')
               ELSE available_at
             END,
             locked_at = null,
             last_error = $5,
             updated_at = now()
         WHERE id = $1`,
        [
          job.id,
          exhausted ? 'failed' : 'queued',
          nextRetryCount,
          Math.min(nextRetryCount * 2, 30),
          message,
        ],
      );

      await this.syncRelatedRecords(job, exhausted ? 'failed' : 'queued', message);

      logEvent('email_job_failed', {
        jobId: job.id,
        kind: job.kind,
        recipientEmail: job.recipient_email,
        retryCount: nextRetryCount,
        maxAttempts: job.max_attempts,
        exhausted,
        error: message,
      });
    }
  }

  private async syncRelatedRecords(
    job: EmailJobRow,
    status: 'sent' | 'failed' | 'queued',
    errorMessage?: string,
  ) {
    const reportRunId =
      job.kind === 'report' && typeof job.metadata?.reportRunId === 'string'
        ? job.metadata.reportRunId
        : null;

    if (!reportRunId) {
      return;
    }

    if (status === 'sent') {
      await this.db.query(
        `UPDATE report_runs
         SET status = 'sent',
             completed_at = now(),
             error_message = null
         WHERE id = $1`,
        [reportRunId],
      );
      return;
    }

    if (status === 'failed') {
      await this.db.query(
        `UPDATE report_runs
         SET status = 'failed',
             completed_at = now(),
             error_message = $2
         WHERE id = $1`,
        [reportRunId, errorMessage || 'Unknown report email error'],
      );
      return;
    }

    await this.db.query(
      `UPDATE report_runs
       SET status = 'queued',
           error_message = $2
       WHERE id = $1`,
      [reportRunId, errorMessage || 'Queued for retry'],
    );
  }
}
