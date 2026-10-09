import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private redis: Redis;
  private closing?: Promise<void>;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(url);
  }

  /**
   * Simple fixed-window limiter.
   * @returns allowed + used counter within window
   */
  async allow(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; used: number }> {
    const redisKey = `rl:${key}`;

    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
    }

    return { allowed: count <= limit, used: count };
  }

  async ping(): Promise<'PONG' | string> {
    return this.redis.ping();
  }

  onModuleDestroy(): Promise<void> {
    return this.closing ??= (async () => {
      let ended!: () => void;
      const end = new Promise<void>(resolve => { ended = resolve; });
      this.redis.once('end', ended);
      try {
        // A disconnected socket is not proof that the outstanding QUIT succeeded.
        try { await this.redis.quit(); }
        catch (cause) { throw Object.assign(new Error('Redis shutdown failed'), { code: 'redis_quit_failed', cause }); }
        await end;
      } finally { this.redis.removeListener('end', ended); }
    })();
  }
}
