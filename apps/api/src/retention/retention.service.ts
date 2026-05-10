import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class RetentionService {
  constructor(private db: PrismaService) {}

  async dryRun(siteId: string) {
    const [conversations, leads, reports] = await Promise.all([
      this.countExpired(
        `SELECT COUNT(*)::int AS count
         FROM conversations c
         JOIN sites s ON s.id = c.site_id
         WHERE c.site_id = $1
           AND c.last_active_at < (
             now() - make_interval(days => CASE
               WHEN (s.config->>'chatRetentionDays') ~ '^[0-9]+$'
                 THEN (s.config->>'chatRetentionDays')::int
               ELSE 90
             END)
           )`,
        [siteId],
      ),
      this.countExpired(
        `SELECT COUNT(*)::int AS count
         FROM widget_leads l
         JOIN sites s ON s.id = l.site_id
         WHERE l.site_id = $1
           AND l.created_at < (
             now() - make_interval(days => CASE
               WHEN (s.config->>'leadRetentionDays') ~ '^[0-9]+$'
                 THEN (s.config->>'leadRetentionDays')::int
               ELSE 365
             END)
           )`,
        [siteId],
      ),
      this.countExpired(
        `SELECT COUNT(*)::int AS count
         FROM report_runs r
         JOIN sites s ON s.id = r.site_id
         WHERE r.site_id = $1
           AND r.created_at < (
             now() - make_interval(days => CASE
               WHEN (s.config->>'reportRetentionDays') ~ '^[0-9]+$'
                 THEN (s.config->>'reportRetentionDays')::int
               ELSE 365
             END)
           )`,
        [siteId],
      ),
    ]);

    return {
      siteId,
      defaults: {
        conversationRetentionDays: 90,
        leadRetentionDays: 365,
        auditRetentionDays: 180,
        storeFullMessages: true,
      },
      deletable: {
        conversations,
        leads,
        reports,
      },
    };
  }

  // täglich 03:30 Uhr
  @Cron('30 3 * * *')
  async cleanup() {
    await this.db.query(
      `DELETE FROM conversations c
       USING sites s
       WHERE s.id = c.site_id
         AND c.last_active_at < (
           now() - make_interval(days => CASE
             WHEN (s.config->>'chatRetentionDays') ~ '^[0-9]+$'
               THEN (s.config->>'chatRetentionDays')::int
             ELSE 90
           END)
         )`,
    );

    await this.db.query(
      `DELETE FROM widget_leads l
       USING sites s
       WHERE s.id = l.site_id
         AND l.created_at < (
           now() - make_interval(days => CASE
             WHEN (s.config->>'leadRetentionDays') ~ '^[0-9]+$'
               THEN (s.config->>'leadRetentionDays')::int
             ELSE 365
           END)
         )`,
    );

    await this.db.query(
      `DELETE FROM report_runs r
       USING sites s
       WHERE s.id = r.site_id
         AND r.created_at < (
           now() - make_interval(days => CASE
             WHEN (s.config->>'reportRetentionDays') ~ '^[0-9]+$'
               THEN (s.config->>'reportRetentionDays')::int
             ELSE 365
           END)
         )`,
    );
  }

  private async countExpired(sql: string, params: unknown[]) {
    const res = await this.db.query<{ count: number | string }>(sql, params);
    return Number(res.rows[0]?.count || 0);
  }
}
