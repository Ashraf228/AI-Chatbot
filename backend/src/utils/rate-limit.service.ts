import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService {
  private redis: Redis;

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
}