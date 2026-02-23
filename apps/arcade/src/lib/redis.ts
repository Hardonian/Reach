import Redis from "ioredis";
import { env } from "./env";

const globalForRedis = global as unknown as { redis: Redis | undefined };

export const redis =
  globalForRedis.redis ??
  (env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        commandTimeout: 1000, // Fast fail
        enableOfflineQueue: false, // Don't queue commands if offline
      })
    : undefined);

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
