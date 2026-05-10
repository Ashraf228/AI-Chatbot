import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from './db/prisma.service';
import { RateLimitService } from './utils/rate-limit.service';

@Controller()
export class HealthController {
  constructor(
    private readonly db: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get('healthz')
  async healthz(@Res({ passthrough: true }) response: Response) {
    const startedAt = Date.now();
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const ok = database.status === 'ok' && (redis.status === 'ok' || redis.status === 'skipped');

    response.status(ok ? 200 : 503);

    return {
      status: ok ? 'ok' : 'error',
      service: 'api',
      version: process.env.APP_VERSION || process.env.npm_package_version || 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
      database: database.status,
      redis: redis.status,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  }

  private async checkDatabase() {
    try {
      await this.db.query('SELECT 1');
      return { status: 'ok' as const };
    } catch {
      return { status: 'error' as const };
    }
  }

  private async checkRedis() {
    if (!process.env.REDIS_URL) {
      return { status: 'skipped' as const };
    }

    try {
      const pong = await this.rateLimit.ping();
      return { status: pong === 'PONG' ? 'ok' as const : 'error' as const };
    } catch {
      return { status: 'error' as const };
    }
  }
}
