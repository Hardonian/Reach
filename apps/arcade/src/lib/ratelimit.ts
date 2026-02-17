import { redis } from './redis';

// Fallback in-memory store if Redis is unavailable
const memoryStore = new Map<string, { count: number; windowStart: number }>();
const FALLBACK_WINDOW_MS = 60 * 1000; // 1 minute

export async function checkRateLimit(ip: string, limit: number = 10, windowSeconds: number = 60): Promise<{ success: boolean; remaining: number }> {
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
      console.warn('Redis rate limit error, falling back to memory:', error);
    }
  }

  // Fallback to memory
  const now = Date.now();
  const record = memoryStore.get(ip) || { count: 0, windowStart: now };

  if (now - record.windowStart > FALLBACK_WINDOW_MS) {
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
