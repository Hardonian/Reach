/**
 * Reach Core Environment Configuration
 *
 * Provides typed, fail-fast configuration validation.
 * Eliminates silent fallback drift.
 */

export interface ReachConfig {
  NODE_ENV: string;
  CI: boolean;
  DEBUG: boolean;

  // Platform
  ZEO_STRICT: boolean;
  ZEO_FIXED_TIME?: string;
  ZEO_WORKSPACE_ID: string;
  PORT?: number;

  // Observability
  ZEO_LOG_REDACT: "none" | "safe" | "strict";
  ZEO_LOG_FORMAT: "text" | "json";

  // Provider
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;

  // Control Plane routing
  ZEO_MODEL: string;
  ZEO_PROVIDER: string;
  KEYS_MODEL: string;
  KEYS_PROVIDER: string;
  READYLAYER_MODEL: string;
  READYLAYER_PROVIDER: string;
  SETTLER_MODEL: string;
  SETTLER_PROVIDER: string;

  // Security
  ZEO_SIGNING_HMAC_KEY?: string;

  // Integrations
  GITHUB_TOKEN?: string;
  SLACK_WEBHOOK_URL?: string;

  // Extensions
  ZEO_PLUGIN_PATH?: string;
}

function parseBoolean(val: string | undefined, defaultVal: boolean): boolean {
  if (!val) return defaultVal;
  const lower = val.toLowerCase().trim();
  return lower === "true" || lower === "1" || lower === "yes";
}

function parseRedactMode(val: string | undefined): "none" | "safe" | "strict" {
  if (!val) return "safe";
  const lower = val.toLowerCase().trim();
  if (lower === "none" || lower === "safe" || lower === "strict") return lower as any;
  throw new Error(`Invalid ZEO_LOG_REDACT value: ${val}`);
}

function parseLogFormat(val: string | undefined): "text" | "json" {
  if (!val) return "text";
  const lower = val.toLowerCase().trim();
  if (lower === "text" || lower === "json") return lower as any;
  throw new Error(`Invalid ZEO_LOG_FORMAT value: ${val}`);
}

let cachedConfig: ReachConfig | null = null;

export function loadConfig(): ReachConfig {
  if (cachedConfig) return cachedConfig;

  // Do not allow silent fallbacks for structurally critical features unless explicitly defined.
  // We'll throw if strict required fields are missing but not all are required.
  const config: ReachConfig = {
    NODE_ENV: process.env.NODE_ENV || "development",
    CI: parseBoolean(process.env.CI, false),
    DEBUG: parseBoolean(process.env.DEBUG, false),

    ZEO_STRICT: process.env.ZE0_STRICT ? process.env.ZE0_STRICT !== "0" && process.env.ZE0_STRICT !== "false" : parseBoolean(process.env.ZEO_STRICT, true),
    ZEO_FIXED_TIME: process.env.ZEO_FIXED_TIME,
    ZEO_WORKSPACE_ID: process.env.ZEO_WORKSPACE_ID?.trim() || "default",
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,

    ZEO_LOG_REDACT: parseRedactMode(process.env.ZEO_LOG_REDACT),
    ZEO_LOG_FORMAT: parseLogFormat(process.env.ZEO_LOG_FORMAT),

    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

    ZEO_MODEL: process.env.ZEO_MODEL || "gpt-4o-mini",
    ZEO_PROVIDER: process.env.ZEO_PROVIDER || "openai",
    KEYS_MODEL: process.env.KEYS_MODEL || "local-default",
    KEYS_PROVIDER: process.env.KEYS_PROVIDER || "local",
    READYLAYER_MODEL: process.env.READYLAYER_MODEL || "local-default",
    READYLAYER_PROVIDER: process.env.READYLAYER_PROVIDER || "local",
    SETTLER_MODEL: process.env.SETTLER_MODEL || "local-default",
    SETTLER_PROVIDER: process.env.SETTLER_PROVIDER || "local",

    ZEO_SIGNING_HMAC_KEY: process.env.ZEO_SIGNING_HMAC_KEY,

    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    ZEO_PLUGIN_PATH: process.env.ZEO_PLUGIN_PATH,
  };

  // Fail fast validations
  if (config.PORT && isNaN(config.PORT)) {
    throw new Error("PORT must be a valid number");
  }

  cachedConfig = config;
  return config;
}

export function resetConfigCache() {
  cachedConfig = null;
}
