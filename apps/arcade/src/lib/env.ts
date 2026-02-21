import { z } from 'zod';

const envSchema = z.object({
  // Base
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Reach Cloud Features
  REACH_CLOUD_ENABLED: z.string().optional().transform(v => v === 'true'),
  REACH_ENCRYPTION_KEY_BASE64: z.string().optional(),
  CLOUD_DB_PATH: z.string().optional(),
  
  // Auth
  REACH_SESSION_COOKIE_NAME: z.string().default('reach_session'),
  REACH_SESSION_TTL_HOURS: z.coerce.number().default(24),
  
  // Redis (for rate limiting)
  REDIS_URL: z.string().optional(),
  
  // Billing
  BILLING_ENABLED: z.string().optional().transform(v => v === 'true'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_TEAM: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE: z.string().optional(),
  
  // GitHub (optional for runner + gates)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URL: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),

  // ReadyLayer suite
  READYLAYER_BASE_URL: z.string().url().optional(),
  READYLAYER_ALERT_EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Policy
  REACH_ENTERPRISE_MAX_SPAWN_DEPTH: z.coerce.number().default(4),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  REACH_CLOUD_ENABLED: process.env.REACH_CLOUD_ENABLED,
  REACH_ENCRYPTION_KEY_BASE64: process.env.REACH_ENCRYPTION_KEY_BASE64,
  CLOUD_DB_PATH: process.env.CLOUD_DB_PATH,
  REACH_SESSION_COOKIE_NAME: process.env.REACH_SESSION_COOKIE_NAME,
  REACH_SESSION_TTL_HOURS: process.env.REACH_SESSION_TTL_HOURS,
  REDIS_URL: process.env.REDIS_URL,
  BILLING_ENABLED: process.env.BILLING_ENABLED,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,
  STRIPE_PRICE_TEAM: process.env.STRIPE_PRICE_TEAM,
  STRIPE_PRICE_ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_REDIRECT_URL: process.env.GITHUB_REDIRECT_URL,
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  READYLAYER_BASE_URL: process.env.READYLAYER_BASE_URL,
  READYLAYER_ALERT_EMAIL_FROM: process.env.READYLAYER_ALERT_EMAIL_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  REACH_ENTERPRISE_MAX_SPAWN_DEPTH: process.env.REACH_ENTERPRISE_MAX_SPAWN_DEPTH,
});
