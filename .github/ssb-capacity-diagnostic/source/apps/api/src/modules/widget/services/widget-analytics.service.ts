import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';

import { TrackEventDto } from '../dto/track-event.dto';
import { WidgetEventEntity } from '../entities/widget-event.entity';
import { PrismaService } from '../../../db/prisma.service';
import { WidgetConfigService } from './widget-config.service';
import { WidgetSecurityService } from './widget-security.service';
import { normalizeWidgetAnalyticsEventType } from '../analytics-events';

@Injectable()
export class WidgetAnalyticsService {
  constructor(
    private readonly db: PrismaService,
    private readonly widgetConfigService: WidgetConfigService,
    private readonly widgetSecurityService: WidgetSecurityService,
  ) {}

  async track(
    dto: TrackEventDto,
    origin?: string,
    _req?: Request,
  ): Promise<WidgetEventEntity> {
    const site = await this.widgetConfigService.getSiteByKey(dto.siteKey);
    await this.widgetSecurityService.enforceOrigin(dto.siteKey, origin);
    await this.widgetSecurityService.assertSessionBelongsToSite(site.id, dto.sessionId);
    const id = randomUUID();
    const eventType = normalizeWidgetAnalyticsEventType(dto.eventType);

    await this.db.query(
      `INSERT INTO widget_events(id, site_id, session_id, event_type, page_url, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [id, site.id, dto.sessionId, eventType, dto.pageUrl, dto.metadata || {}],
    );

    await this.db.query(
      `UPDATE widget_sessions
       SET last_seen_at = now(),
           source_url = COALESCE($3, source_url)
       WHERE site_id = $1 AND id = $2`,
      [site.id, dto.sessionId, dto.pageUrl],
    );

    return {
      id,
      siteId: site.id,
      sessionId: dto.sessionId,
      eventType,
      pageUrl: dto.pageUrl,
      metadata: dto.metadata || {},
      createdAt: new Date().toISOString(),
    };
  }
}
