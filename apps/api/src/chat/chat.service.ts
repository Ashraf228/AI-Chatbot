import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

import { ChatPipelineService } from '../ai/chat-pipeline/chat-pipeline.service';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from '../sites/sites.service';
import { isDomainAllowed } from '../utils/cors';
import { logEvent } from '../utils/logger';
import { RateLimitService } from '../utils/rate-limit.service';
import { sanitizeInput } from '../utils/security';
import { ChatMessageDto } from './dto';

@Injectable()
export class ChatService {
  private getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
  }

  constructor(
    private readonly sites: SitesService,
    private readonly rateLimit: RateLimitService,
    private readonly db: PrismaService,
    private readonly chatPipeline: ChatPipelineService,
  ) {}

  async reply(dto: ChatMessageDto, origin?: string, req?: Request) {
    const site = await this.sites.getSite(dto.siteId);
    if (!site) {
      throw new HttpException('Invalid siteId', HttpStatus.NOT_FOUND);
    }

    const tenantId = site.tenant_id;
    if (!tenantId) {
      throw new HttpException(
        'Site misconfigured (tenant missing)',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!site.public_key || dto.publicKey !== site.public_key) {
      throw new HttpException('Invalid publicKey', HttpStatus.FORBIDDEN);
    }

    if (!origin) {
      throw new HttpException('Missing origin', HttpStatus.FORBIDDEN);
    }

    if (!origin.startsWith('http')) {
      throw new HttpException('Invalid origin', HttpStatus.FORBIDDEN);
    }

    const mode = process.env.SITE_DOMAIN_ALLOWLIST_MODE || 'strict';
    if (mode === 'strict') {
      const allowed = site.allowed_domains || [];
      if (!isDomainAllowed(origin, allowed)) {
        throw new HttpException('Origin not allowed', HttpStatus.FORBIDDEN);
      }
    }

    logEvent('chat_request', {
      siteId: dto.siteId,
      tenantId,
      origin,
      hasSessionId: !!dto.sessionId,
      messageLength: dto.message?.length,
    });

    const ipRaw =
      (req?.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      'unknown';
    const ip = String(ipRaw).replace('::ffff:', '');

    const ipLimit = await this.rateLimit.allow(`ip:${ip}`, 30, 60_000);
    const siteLimit = await this.rateLimit.allow(`site:${dto.siteId}`, 300, 60_000);
    const tenantLimit = await this.rateLimit.allow(`tenant:${tenantId}`, 1000, 60_000);
    const globalLimit = await this.rateLimit.allow(`global`, 5000, 60_000);

    if (!ipLimit.allowed || !siteLimit.allowed || !tenantLimit.allowed || !globalLimit.allowed) {
      logEvent('rate_limit_exceeded', {
        ip,
        siteId: dto.siteId,
        tenantId,
        limits: {
          ip: ipLimit.allowed ? 'ok' : 'exceeded',
          site: siteLimit.allowed ? 'ok' : 'exceeded',
          tenant: tenantLimit.allowed ? 'ok' : 'exceeded',
          global: globalLimit.allowed ? 'ok' : 'exceeded',
        },
      });

      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    const dailyLimitRes = await this.db.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       WHERE c.tenant_id = $1
         AND m.role = 'user'
         AND m.created_at > now() - interval '1 day'`,
      [tenantId],
    );

    const dailyCount = Number(dailyLimitRes.rows[0].count);
    if (dailyCount >= 5000) {
      logEvent('daily_limit_exceeded', {
        tenantId,
        dailyCount,
        limit: 5000,
      });

      throw new HttpException('Daily usage limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }

    let safeMessage: string;
    try {
      safeMessage = sanitizeInput(dto.message);
    } catch (err: unknown) {
      throw new HttpException(
        this.getErrorMessage(err, 'Invalid input'),
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.chatPipeline.process({
      tenantId,
      siteId: dto.siteId,
      sessionId: dto.sessionId,
      message: safeMessage,
      source: 'api',
      siteConfig: site.config as Record<string, unknown> | null,
    });
  }
}
