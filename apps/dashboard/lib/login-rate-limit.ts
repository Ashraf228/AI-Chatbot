import { getDashboardRedis } from "@/lib/redis";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const REDIS_KEY_PREFIX = "admin-login-attempts";

type AttemptEntry = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptEntry>();

function getNow() {
  return Date.now();
}

function getEntry(key: string) {
  const existing = attempts.get(key);
  if (!existing) {
    return null;
  }

  if (existing.resetAt <= getNow()) {
    attempts.delete(key);
    return null;
  }

  return existing;
}

function getRedisKey(key: string) {
  return `${REDIS_KEY_PREFIX}:${key}`;
}

async function getRedisEntry(key: string) {
  const redis = getDashboardRedis();
  if (!redis) {
    return null;
  }

  try {
    await redis.connect();
  } catch {
    if (redis.status !== "ready") {
      return null;
    }
  }

  try {
    const redisKey = getRedisKey(key);
    const [countRaw, ttlMs] = await Promise.all([
      redis.get(redisKey),
      redis.pttl(redisKey),
    ]);

    if (!countRaw || ttlMs <= 0) {
      return null;
    }

    return {
      count: Number(countRaw),
      ttlMs,
    };
  } catch {
    return null;
  }
}

export async function isLoginRateLimited(key: string) {
  const redisEntry = await getRedisEntry(key);
  if (redisEntry) {
    return redisEntry.count >= MAX_ATTEMPTS;
  }

  const entry = getEntry(key);
  if (!entry) {
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

export async function registerLoginFailure(key: string) {
  const redis = getDashboardRedis();
  if (redis) {
    try {
      await redis.connect();
    } catch {
      if (redis.status !== "ready") {
        // fall back to in-memory limiter below
      }
    }

    if (redis.status === "ready") {
      try {
        const nextCount = await redis.incr(getRedisKey(key));
        if (nextCount === 1) {
          await redis.pexpire(getRedisKey(key), WINDOW_MS);
        }
        return;
      } catch {
        // fall back to in-memory limiter below
      }
    }
  }

  const now = getNow();
  const entry = getEntry(key);

  if (!entry) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  attempts.set(key, {
    count: entry.count + 1,
    resetAt: entry.resetAt,
  });
}

export async function clearLoginFailures(key: string) {
  const redis = getDashboardRedis();
  if (redis) {
    try {
      await redis.connect();
    } catch {
      if (redis.status !== "ready") {
        // fall back to in-memory limiter below
      }
    }

    if (redis.status === "ready") {
      try {
        await redis.del(getRedisKey(key));
      } catch {
        // fall back to in-memory limiter below
      }
    }
  }

  attempts.delete(key);
}

export async function getRetryAfterSeconds(key: string) {
  const redisEntry = await getRedisEntry(key);
  if (redisEntry) {
    return Math.max(1, Math.ceil(redisEntry.ttlMs / 1000));
  }

  const entry = getEntry(key);
  if (!entry) {
    return 0;
  }

  return Math.max(1, Math.ceil((entry.resetAt - getNow()) / 1000));
}
