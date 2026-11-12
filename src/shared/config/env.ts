import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  FEATURE_ASYNC_PAYMENT: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9090)
});

export const env = envSchema.parse(process.env);

