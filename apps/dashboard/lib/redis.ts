import Redis from "ioredis";

declare global {
  var __dashboardRedisClient__: Redis | undefined;
}

export function getDashboardRedis() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  if (!globalThis.__dashboardRedisClient__) {
    globalThis.__dashboardRedisClient__ = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });

    globalThis.__dashboardRedisClient__.on("error", (error: unknown) => {
      console.error("Dashboard Redis error", error);
    });
  }

  return globalThis.__dashboardRedisClient__;
}
