import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';
import { RateLimitService } from '../../../utils/rate-limit.service';
import { isDomainAllowed } from '../../../utils/cors';
import { WidgetConfigService } from './widget-config.service';

@Injectable()
export class WidgetSecurityService {
  constructor(
    private readonly db: PrismaService,
    private readonly rateLimitService: RateLimitService,
    private readonly widgetConfigService: WidgetConfigService,
  ) {}

  async isAllowedOrigin(siteKey: string, origin?: string) {
    if (!origin) {
      return false;
    }

    const site = await this.widgetConfigService.getSiteByKey(siteKey);
    const res = await this.db.query<{ allowed_domains: string[] }>(
      `SELECT allowed_domains FROM sites WHERE id = $1 LIMIT 1`,
      [site.id],
    );

    return isDomainAllowed(origin, res.rows[0]?.allowed_domains || []);
  }

  async checkRateLimit(key: string, limit = 60, windowMs = 60_000) {
    return this.rateLimitService.allow(`widget:${key}`, limit, windowMs);
  }

  async assertSessionBelongsToSite(siteId: string, sessionId: string) {
    const res = await this.db.query<{ id: string }>(
      `SELECT id FROM widget_sessions WHERE id = $1 AND site_id = $2 LIMIT 1`,
      [sessionId, siteId],
    );

    if (!res.rows[0]) {
      throw new NotFoundException('Unknown widget session');
    }
  }

  async enforceOrigin(siteKey: string, origin?: string) {
    const allowed = await this.isAllowedOrigin(siteKey, origin);
    if (!allowed) {
      throw new ForbiddenException('Origin not allowed');
    }
  }

  async enforceRateLimit(key: string, limit = 60, windowMs = 60_000) {
    const result = await this.checkRateLimit(key, limit, windowMs);
    if (!result.allowed) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  getClientIp(req?: { headers?: Record<string, unknown>; socket?: { remoteAddress?: string } }) {
    const forwarded = req?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim().replace('::ffff:', '');
    }

    return String(req?.socket?.remoteAddress || 'unknown').replace('::ffff:', '');
  }
}
