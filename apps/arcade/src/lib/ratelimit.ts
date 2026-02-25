import { redis } from "./redis";
import { logger } from "./logger";

// Fallback in-memory store if Redis is unavailable
const memoryStore = new Map<string, { count: number; windowStart: number }>();

// Log warning at startup about rate limiting fallback
if (!redis) {
  logger.warn(
    "Redis not configured for rate limiting. Falling back to in-memory rate limiter. " +
      "This is not recommended for production deployments with multiple instances.",
    { hint: "Set REDIS_URL environment variable to enable Redis-based rate limiting" },
  );
}

export async function checkRateLimit(
  ip: string,
  limit: number = 10,
  windowSeconds: number = 60,
): Promise<{ success: boolean; remaining: number }> {
  const key = `rate_limit:${ip}`;

  // Try Redis first
  if (redis) {
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }
      return {
        success: current <= limit,
        remaining: Math.max(0, limit - current),
      };
    } catch (error) {
      logger.warn("Redis rate limit error, falling back to memory", {
        ip,
        error,
      });
    }
  }

  // Fallback to memory - use the configured windowSeconds parameter
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const record = memoryStore.get(ip) || { count: 0, windowStart: now };

  if (now - record.windowStart > windowMs) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count++;
  }

  memoryStore.set(ip, record);

  return {
    success: record.count <= limit,
    remaining: Math.max(0, limit - record.count),
  };
}
