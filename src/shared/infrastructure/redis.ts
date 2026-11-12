import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 100, 2000);
  }
});

redis.on("error", (err) => {
  // Evita crash de unhandled error em testes
  console.warn(`[Redis Warning] ${err.message}`);
});

