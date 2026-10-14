import Redis from "ioredis";

declare global {
  var __dashboardRedisClient__: Redis | undefined;
  var __ssbDashboardLifecycle__: { registerRedis(client: Redis): void } | undefined;
}

export function getDashboardRedis() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;
  const lifecycle = globalThis.__ssbDashboardLifecycle__;
  if (!lifecycle) throw new Error("Dashboard lifecycle binding missing");
  if (!globalThis.__dashboardRedisClient__) {
    const client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
    lifecycle.registerRedis(client);
    client.on("error", () => { /* The caller receives the error; never print credentials or raw data. */ });
    globalThis.__dashboardRedisClient__ = client;
  }
  return globalThis.__dashboardRedisClient__;
}
