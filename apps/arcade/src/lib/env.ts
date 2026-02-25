import { z } from "zod";

const envSchema = z.object({
  // Base
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Reach Cloud Features
  REACH_CLOUD_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  REACH_ENCRYPTION_KEY_BASE64: z.string().optional(),
  CLOUD_DB_PATH: z.string().optional(),

  // Auth
  REACH_SESSION_COOKIE_NAME: z.string().default("reach_session"),
  REACH_SESSION_TTL_HOURS: z.coerce.number().default(24),

  // Redis (for rate limiting)
  REDIS_URL: z.string().optional(),

  // Billing
  BILLING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
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
  READYLAYER_ALERT_EMAIL_ENDPOINT: z.string().optional(),
  READYLAYER_ALERT_EMAIL_API_KEY: z.string().optional(),
  READYLAYER_ALERT_EMAIL_FROM: z.string().email().optional(),
  READYLAYER_ALERT_DEDUPE_WINDOW_SECONDS: z.coerce.number().default(300),
  READYLAYER_STRICT_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  READYLAYER_GATE_WARNINGS_BLOCK: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  READYLAYER_GATE_MAX_WARNINGS: z.coerce.number().default(25),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_BRAND_NAME: z.string().optional(),
  REACH_RUNNER_URL: z.string().url().optional(),
  DECISION_ENGINE: z.string().optional(),

  // Policy
  REACH_ENTERPRISE_MAX_SPAWN_DEPTH: z.coerce.number().default(4),
});

type NodeEnv = "development" | "test" | "production";

export interface EnvValidationIssue {
  key: string;
  message: string;
}

function normalizeNodeEnv(value: string | undefined, issues: EnvValidationIssue[]): NodeEnv {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    issues.push({
      key: "NODE_ENV",
      message: `Invalid value "${value}" was ignored; defaulted to "development".`,
    });
  }

  return "development";
}

function sanitizeOptionalUrl(
  key: string,
  value: string | undefined,
  issues: EnvValidationIssue[],
): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    issues.push({
      key,
      message: `Invalid URL was ignored for ${key}.`,
    });
    return undefined;
  }
}

function sanitizeOptionalEmail(
  key: string,
  value: string | undefined,
  issues: EnvValidationIssue[],
): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const normalized = value.trim();
  const result = z.string().email().safeParse(normalized);
  if (result.success) {
    return normalized;
  }

  issues.push({
    key,
    message: `Invalid email was ignored for ${key}.`,
  });
  return undefined;
}

const envValidationIssues: EnvValidationIssue[] = [];

export const env = envSchema.parse({
  NODE_ENV: normalizeNodeEnv(process.env.NODE_ENV, envValidationIssues),
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
  GITHUB_REDIRECT_URL: sanitizeOptionalUrl(
    "GITHUB_REDIRECT_URL",
    process.env.GITHUB_REDIRECT_URL,
    envValidationIssues,
  ),
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  READYLAYER_BASE_URL: sanitizeOptionalUrl(
    "READYLAYER_BASE_URL",
    process.env.READYLAYER_BASE_URL,
    envValidationIssues,
  ),
  READYLAYER_ALERT_EMAIL_ENDPOINT: process.env.READYLAYER_ALERT_EMAIL_ENDPOINT,
  READYLAYER_ALERT_EMAIL_API_KEY: process.env.READYLAYER_ALERT_EMAIL_API_KEY,
  READYLAYER_ALERT_EMAIL_FROM: sanitizeOptionalEmail(
    "READYLAYER_ALERT_EMAIL_FROM",
    process.env.READYLAYER_ALERT_EMAIL_FROM,
    envValidationIssues,
  ),
  READYLAYER_ALERT_DEDUPE_WINDOW_SECONDS: process.env.READYLAYER_ALERT_DEDUPE_WINDOW_SECONDS,
  READYLAYER_STRICT_MODE: process.env.READYLAYER_STRICT_MODE,
  READYLAYER_GATE_WARNINGS_BLOCK: process.env.READYLAYER_GATE_WARNINGS_BLOCK,
  READYLAYER_GATE_MAX_WARNINGS: process.env.READYLAYER_GATE_MAX_WARNINGS,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  NEXT_PUBLIC_BASE_URL: sanitizeOptionalUrl(
    "NEXT_PUBLIC_BASE_URL",
    process.env.NEXT_PUBLIC_BASE_URL,
    envValidationIssues,
  ),
  NEXT_PUBLIC_APP_URL: sanitizeOptionalUrl(
    "NEXT_PUBLIC_APP_URL",
    process.env.NEXT_PUBLIC_APP_URL,
    envValidationIssues,
  ),
  NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
  REACH_RUNNER_URL: sanitizeOptionalUrl(
    "REACH_RUNNER_URL",
    process.env.REACH_RUNNER_URL,
    envValidationIssues,
  ),
  DECISION_ENGINE: process.env.DECISION_ENGINE,
  REACH_ENTERPRISE_MAX_SPAWN_DEPTH: process.env.REACH_ENTERPRISE_MAX_SPAWN_DEPTH,
});

export const envValidation = {
  ok: envValidationIssues.length === 0,
  issues: envValidationIssues,
};
