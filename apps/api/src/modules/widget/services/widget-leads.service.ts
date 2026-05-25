import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';

import { CaptureLeadDto } from '../dto/capture-lead.dto';
import { WidgetLeadEntity } from '../entities/widget-lead.entity';
import { PrismaService } from '../../../db/prisma.service';
import { WidgetConfigService } from './widget-config.service';
import { WidgetSecurityService } from './widget-security.service';
import { LeadMailerService } from './lead-mailer.service';
import { EmailJobsService } from './email-jobs.service';
import { logEvent } from '../../../utils/logger';
import { ReportMailerService } from './report-mailer.service';
import { UsageLimitService } from '../../../billing/usage-limit.service';

@Injectable()
export class WidgetLeadsService {
  constructor(
    private readonly db: PrismaService,
    private readonly widgetConfigService: WidgetConfigService,
    private readonly widgetSecurityService: WidgetSecurityService,
    private readonly leadMailer: LeadMailerService,
    private readonly emailJobs: EmailJobsService,
    private readonly reportMailer: ReportMailerService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  async capture(
    dto: CaptureLeadDto,
    origin?: string,
    _req?: Request,
  ): Promise<WidgetLeadEntity> {
    const site = await this.widgetConfigService.getSiteByKey(dto.siteKey);
    await this.widgetSecurityService.enforceOrigin(dto.siteKey, origin);
    await this.widgetSecurityService.assertSessionBelongsToSite(site.id, dto.sessionId);
    const id = randomUUID();

    await this.usageLimits.withMonthlyLeadLimit(site.tenantId, async (db, assertLimit) => {
      await assertLimit();
      await db.query(
        `INSERT INTO widget_leads(id, site_id, session_id, name, email, phone, message, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [id, site.id, dto.sessionId, dto.name, dto.email, dto.phone || null, dto.message || null, dto.status || 'new'],
      );

      await db.query(
        `UPDATE widget_sessions
         SET lead_captured = true,
             last_seen_at = now()
         WHERE site_id = $1 AND id = $2`,
        [site.id, dto.sessionId],
      );
    });

    if (site.leadNotificationEmail) {
      if (!this.reportMailer.isConfigured()) {
        logEvent('lead_notification_skipped', {
          siteId: site.id,
          recipientEmail: site.leadNotificationEmail,
          reason: 'smtp_not_configured',
        });
      } else {
        const messagePayload = this.leadMailer.buildLeadNotification({
          recipientEmail: site.leadNotificationEmail,
          siteId: site.id,
          siteName: site.companyName || site.name,
          submittedAt: new Date().toISOString(),
          lead: {
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            message: dto.message,
          },
        });

        await this.emailJobs.enqueue({
          kind: 'lead_notification',
          ...messagePayload,
          metadata: {
            siteId: site.id,
            sessionId: dto.sessionId,
            leadEmail: dto.email,
          },
        });
      }
    }

    return {
      id,
      siteId: site.id,
      sessionId: dto.sessionId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      message: dto.message,
      status: dto.status || 'new',
      createdAt: new Date().toISOString(),
    };
  }
}
