import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis | undefined };

export const redis =
  globalForRedis.redis ??
  (process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        commandTimeout: 1000, // Fast fail
        enableOfflineQueue: false, // Don't queue commands if offline
      })
    : undefined);

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
