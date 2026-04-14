import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';

import { CreateSessionDto } from '../dto/create-session.dto';
import { WidgetSessionEntity } from '../entities/widget-session.entity';
import { PrismaService } from '../../../db/prisma.service';
import { WidgetConfigService } from './widget-config.service';

@Injectable()
export class WidgetSessionService {
  constructor(
    private readonly db: PrismaService,
    private readonly widgetConfigService: WidgetConfigService,
  ) {}

  async createOrResume(
    dto: CreateSessionDto,
    origin?: string,
    req?: Request,
  ): Promise<WidgetSessionEntity> {
    const site = await this.widgetConfigService.getSiteByKey(dto.siteKey);
    const normalizedSourceUrl = this.normalizeSourceUrl(dto.sourceUrl, origin);
    const visitorId = dto.visitorId?.trim() || randomUUID();
    const timestamp = new Date().toISOString();
    const userAgent = dto.userAgent || (req?.headers['user-agent'] as string | undefined);

    const existing = await this.db.query<any>(
      `SELECT id, site_id, visitor_id, started_at, last_seen_at, source_url, user_agent, lead_captured
       FROM widget_sessions
       WHERE site_id = $1 AND visitor_id = $2
       LIMIT 1`,
      [site.id, visitorId],
    );

    if (existing.rows[0]) {
      await this.db.query(
        `UPDATE widget_sessions
         SET last_seen_at = now(),
             source_url = COALESCE($2, source_url),
             user_agent = COALESCE($3, user_agent)
         WHERE id = $1`,
        [existing.rows[0].id, normalizedSourceUrl, userAgent],
      );

      return {
        id: existing.rows[0].id,
        siteId: existing.rows[0].site_id,
        visitorId: existing.rows[0].visitor_id,
        startedAt: new Date(existing.rows[0].started_at).toISOString(),
        lastSeenAt: timestamp,
        sourceUrl: normalizedSourceUrl || existing.rows[0].source_url,
        userAgent: userAgent || existing.rows[0].user_agent,
        leadCaptured: existing.rows[0].lead_captured,
      };
    }

    const sessionId = randomUUID();
    await this.db.query(
      `INSERT INTO widget_sessions(id, site_id, visitor_id, started_at, last_seen_at, source_url, user_agent, lead_captured)
       VALUES ($1, $2, $3, now(), now(), $4, $5, false)`,
      [sessionId, site.id, visitorId, normalizedSourceUrl || null, userAgent || null],
    );

    return {
      id: sessionId,
      siteId: site.id,
      visitorId,
      startedAt: timestamp,
      lastSeenAt: timestamp,
      sourceUrl: normalizedSourceUrl,
      userAgent,
      leadCaptured: false,
    };
  }

  private normalizeSourceUrl(sourceUrl?: string, origin?: string) {
    if (!sourceUrl) {
      return undefined;
    }

    try {
      const parsed = new URL(sourceUrl);
      if (origin && parsed.origin !== origin) {
        return undefined;
      }
      return parsed.toString().slice(0, 2000);
    } catch {
      return undefined;
    }
  }
}
