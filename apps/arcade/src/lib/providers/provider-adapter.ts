/**
 * ReadyLayer Provider Abstraction Layer
 *
 * Provides a unified interface for all LLM providers with:
 * - Standard request/response contracts
 * - Timeout handling
 * - Retry strategies
 * - Fallback cascades
 * - Health scoring
 * - Cost/latency normalization
 *
 * @module provider-adapter
 */

import { z } from "zod";
import { logger } from "../logger";

// ── Core Types ───────────────────────────────────────────────────────────────

/**
 * Supported provider identifiers.
 */
export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "cohere"
  | "meta"
  | "custom";

/**
 * Provider health status.
 */
export type ProviderHealthStatus = "healthy" | "degraded" | "unhealthy" | "offline";

/**
 * Standardized request to any provider.
 */
export interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop_sequences?: string[];
  tools?: ProviderTool[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; name: string };
  metadata?: Record<string, unknown>;
  stream?: boolean;
}

/**
 * Standardized message format.
 */
export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ProviderContentBlock[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ProviderToolCall[];
}

/**
 * Content block for multimodal messages.
 */
export interface ProviderContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result";
  text?: string;
  image_url?: { url: string; detail?: "low" | "high" | "auto" };
  tool_use?: { id: string; name: string; input: Record<string, unknown> };
  tool_result?: { tool_use_id: string; content: string; is_error?: boolean };
}

/**
 * Tool definition for function calling.
 */
export interface ProviderTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Tool call from the model.
 */
export interface ProviderToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Standardized response from any provider.
 */
export interface ProviderResponse {
  id: string;
  provider: ProviderId;
  model: string;
  choices: ProviderChoice[];
  usage: ProviderUsage;
  latency_ms: number;
  cost_usd: number;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "error";
  created_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response choice.
 */
export interface ProviderChoice {
  index: number;
  message: ProviderMessage;
  finish_reason: string;
  logprobs?: unknown;
}

/**
 * Normalized usage statistics.
 */
export interface ProviderUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
  };
}

// ── Provider Health ──────────────────────────────────────────────────────────

/**
 * Provider health metrics.
 */
export interface ProviderHealth {
  provider: ProviderId;
  status: ProviderHealthStatus;
  health_score: number; // 0.0 to 1.0
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  error_rate: number; // 0.0 to 1.0
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
  total_requests: number;
  total_errors: number;
  updated_at: string;
}

/**
 * Default health state for a new provider.
 */
export function defaultProviderHealth(provider: ProviderId): ProviderHealth {
  return {
    provider,
    status: "healthy",
    health_score: 1.0,
    latency_p50_ms: 0,
    latency_p95_ms: 0,
    latency_p99_ms: 0,
    error_rate: 0,
    last_success_at: null,
    last_failure_at: null,
    consecutive_failures: 0,
    total_requests: 0,
    total_errors: 0,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Updates health metrics after a successful request.
 */
export function recordSuccess(health: ProviderHealth, latencyMs: number): ProviderHealth {
  const total = health.total_requests + 1;
  const errors = health.total_errors;
  const errorRate = errors / total;

  // Simple exponential moving average for latency percentiles
  const alpha = 0.1;
  const p50 =
    health.latency_p50_ms === 0
      ? latencyMs
      : Math.round(health.latency_p50_ms + alpha * (latencyMs - health.latency_p50_ms));
  const p95 =
    health.latency_p95_ms === 0
      ? latencyMs
      : Math.round(health.latency_p95_ms + alpha * 1.5 * (latencyMs - health.latency_p95_ms));
  const p99 =
    health.latency_p99_ms === 0
      ? latencyMs
      : Math.round(health.latency_p99_ms + alpha * 2 * (latencyMs - health.latency_p99_ms));

  // Health score calculation
  const latencyScore = Math.max(0, 1 - p95 / 10000); // Penalize if p95 > 10s
  const errorScore = 1 - errorRate;
  const healthScore = latencyScore * 0.4 + errorScore * 0.6;

  let status: ProviderHealthStatus = "healthy";
  if (healthScore < 0.3 || health.consecutive_failures >= 5) {
    status = "unhealthy";
  } else if (healthScore < 0.7 || health.consecutive_failures >= 2) {
    status = "degraded";
  }

  return {
    ...health,
    status,
    health_score: Math.round(healthScore * 100) / 100,
    latency_p50_ms: p50,
    latency_p95_ms: p95,
    latency_p99_ms: p99,
    error_rate: Math.round(errorRate * 10000) / 10000,
    last_success_at: new Date().toISOString(),
    consecutive_failures: 0,
    total_requests: total,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Updates health metrics after a failed request.
 */
export function recordFailure(health: ProviderHealth, _error: Error): ProviderHealth {
  const total = health.total_requests + 1;
  const errors = health.total_errors + 1;
  const errorRate = errors / total;
  const consecutive = health.consecutive_failures + 1;

  // Health score calculation
  const errorScore = 1 - errorRate;
  const consecutivePenalty = Math.min(consecutive * 0.1, 0.5);
  const healthScore = Math.max(0, errorScore - consecutivePenalty);

  let status: ProviderHealthStatus = "healthy";
  if (healthScore < 0.3 || consecutive >= 5) {
    status = "unhealthy";
  } else if (healthScore < 0.7 || consecutive >= 2) {
    status = "degraded";
  }

  return {
    ...health,
    status,
    health_score: Math.round(healthScore * 100) / 100,
    error_rate: Math.round(errorRate * 10000) / 10000,
    last_failure_at: new Date().toISOString(),
    consecutive_failures: consecutive,
    total_requests: total,
    total_errors: errors,
    updated_at: new Date().toISOString(),
  };
}

// ── Retry Strategy ───────────────────────────────────────────────────────────

/**
 * Retry configuration.
 */
export interface RetryConfig {
  max_retries: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  retryable_errors: string[];
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_retries: 3,
  initial_delay_ms: 1000,
  max_delay_ms: 30000,
  backoff_multiplier: 2,
  retryable_errors: ["rate_limit", "timeout", "overloaded", "server_error", "connection_error"],
};

/**
 * Calculates delay for a retry attempt with exponential backoff.
 */
export function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initial_delay_ms * Math.pow(config.backoff_multiplier, attempt);
  const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
  return Math.min(delay + jitter, config.max_delay_ms);
}

/**
 * Determines if an error is retryable.
 */
export function isRetryableError(error: Error, config: RetryConfig): boolean {
  const errorStr = error.message.toLowerCase();
  return config.retryable_errors.some(
    (re) => errorStr.includes(re.toLowerCase()) || errorStr.includes(re.replace("_", " ")),
  );
}

// ── Timeout Handling ─────────────────────────────────────────────────────────

/**
 * Timeout configuration.
 */
export interface TimeoutConfig {
  connect_timeout_ms: number;
  read_timeout_ms: number;
  write_timeout_ms: number;
  total_timeout_ms: number;
}

/**
 * Default timeout configuration.
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  connect_timeout_ms: 5000,
  read_timeout_ms: 60000,
  write_timeout_ms: 10000,
  total_timeout_ms: 120000,
};

// ── Provider Adapter Interface ───────────────────────────────────────────────

/**
 * Interface that all provider adapters must implement.
 */
export interface ProviderAdapter {
  readonly providerId: ProviderId;
  readonly displayName: string;

  /**
   * Execute a request to this provider.
   */
  execute(request: ProviderRequest, options?: ExecutionOptions): Promise<ProviderResponse>;

  /**
   * Check if this provider is available.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get current health metrics.
   */
  getHealth(): ProviderHealth;

  /**
   * Get supported models.
   */
  getSupportedModels(): string[];

  /**
   * Estimate cost for a request.
   */
  estimateCost(request: ProviderRequest): number;
}

/**
 * Execution options for a single request.
 */
export interface ExecutionOptions {
  timeout?: Partial<TimeoutConfig>;
  retry?: Partial<RetryConfig>;
  fallback?: ProviderId[];
  metadata?: Record<string, unknown>;
}

// ── Provider Router ──────────────────────────────────────────────────────────

/**
 * Router for managing multiple providers with fallback support.
 */
export class ProviderRouter {
  private adapters: Map<ProviderId, ProviderAdapter> = new Map();
  private health: Map<ProviderId, ProviderHealth> = new Map();
  private defaultProvider: ProviderId = "openai";

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
    this.health.set(adapter.providerId, defaultProviderHealth(adapter.providerId));
    logger.info("Provider registered", { provider: adapter.providerId });
  }

  setDefault(provider: ProviderId): void {
    if (!this.adapters.has(provider)) {
      throw new Error(`Provider ${provider} not registered`);
    }
    this.defaultProvider = provider;
  }

  async execute(request: ProviderRequest, options?: ExecutionOptions): Promise<ProviderResponse> {
    const providers = this.getProviderCascade(options?.fallback);
    let lastError: Error | null = null;

    for (const providerId of providers) {
      const adapter = this.adapters.get(providerId);
      if (!adapter) continue;

      const health = this.health.get(providerId);
      if (health?.status === "unhealthy") {
        logger.warn("Skipping unhealthy provider", { provider: providerId });
        continue;
      }

      try {
        const response = await this.executeWithRetry(adapter, request, options);
        this.health.set(providerId, recordSuccess(health!, response.latency_ms));
        return response;
      } catch (error) {
        lastError = error as Error;
        this.health.set(providerId, recordFailure(health!, error as Error));
        logger.warn("Provider request failed", {
          provider: providerId,
          error: String(error),
        });
      }
    }

    throw lastError || new Error("No providers available");
  }

  private getProviderCascade(fallbacks?: ProviderId[]): ProviderId[] {
    const cascade: ProviderId[] = [this.defaultProvider];

    if (fallbacks) {
      cascade.push(...fallbacks.filter((p) => p !== this.defaultProvider));
    }

    // Add remaining providers sorted by health score
    const remaining = Array.from(this.adapters.keys())
      .filter((p) => !cascade.includes(p))
      .sort((a, b) => {
        const healthA = this.health.get(a);
        const healthB = this.health.get(b);
        return (healthB?.health_score ?? 0) - (healthA?.health_score ?? 0);
      });

    return [...cascade, ...remaining];
  }

  private async executeWithRetry(
    adapter: ProviderAdapter,
    request: ProviderRequest,
    options?: ExecutionOptions,
  ): Promise<ProviderResponse> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options?.retry };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.max_retries; attempt++) {
      try {
        return await adapter.execute(request, options);
      } catch (error) {
        lastError = error as Error;

        if (!isRetryableError(lastError, retryConfig)) {
          throw lastError;
        }

        if (attempt < retryConfig.max_retries) {
          const delay = calculateRetryDelay(attempt, retryConfig);
          logger.info("Retrying request", {
            provider: adapter.providerId,
            attempt: attempt + 1,
            delay_ms: delay,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  getHealth(provider: ProviderId): ProviderHealth | undefined {
    return this.health.get(provider);
  }

  getAllHealth(): ProviderHealth[] {
    return Array.from(this.health.values());
  }

  getAvailableProviders(): ProviderId[] {
    return Array.from(this.adapters.keys()).filter((p) => {
      const health = this.health.get(p);
      return health?.status !== "offline";
    });
  }
}

// ── Cost Normalization ───────────────────────────────────────────────────────

/**
 * Pricing information for a model.
 */
export interface ModelPricing {
  provider: ProviderId;
  model: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  cached_input_cost_per_1k?: number;
}

/**
 * Known model pricing (simplified - in production, fetch from config).
 */
export const MODEL_PRICING: ModelPricing[] = [
  {
    provider: "openai",
    model: "gpt-4o",
    input_cost_per_1k: 0.0025,
    output_cost_per_1k: 0.01,
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    input_cost_per_1k: 0.00015,
    output_cost_per_1k: 0.0006,
  },
  {
    provider: "openai",
    model: "gpt-4-turbo",
    input_cost_per_1k: 0.01,
    output_cost_per_1k: 0.03,
  },
  {
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    input_cost_per_1k: 0.003,
    output_cost_per_1k: 0.015,
  },
  {
    provider: "anthropic",
    model: "claude-3-opus",
    input_cost_per_1k: 0.015,
    output_cost_per_1k: 0.075,
  },
  {
    provider: "google",
    model: "gemini-1.5-pro",
    input_cost_per_1k: 0.00125,
    output_cost_per_1k: 0.005,
  },
  {
    provider: "google",
    model: "gemini-1.5-flash",
    input_cost_per_1k: 0.000075,
    output_cost_per_1k: 0.0003,
  },
  {
    provider: "mistral",
    model: "mistral-large",
    input_cost_per_1k: 0.002,
    output_cost_per_1k: 0.006,
  },
];

/**
 * Calculates cost for a request/response.
 */
export function calculateCost(provider: ProviderId, model: string, usage: ProviderUsage): number {
  const pricing = MODEL_PRICING.find((p) => p.provider === provider && p.model === model);

  if (!pricing) {
    // Default fallback pricing
    return (usage.prompt_tokens * 0.001 + usage.completion_tokens * 0.002) / 1000;
  }

  const inputCost = (usage.prompt_tokens / 1000) * pricing.input_cost_per_1k;
  const outputCost = (usage.completion_tokens / 1000) * pricing.output_cost_per_1k;

  return Math.round((inputCost + outputCost) * 100000) / 100000;
}

// ── Fallback Strategy Interface ──────────────────────────────────────────────

/**
 * Strategy for selecting fallback providers.
 */
export interface FallbackStrategy {
  name: string;
  selectFallbacks(primary: ProviderId, context: FallbackContext): ProviderId[];
}

/**
 * Context for fallback decisions.
 */
export interface FallbackContext {
  request: ProviderRequest;
  error?: Error;
  attemptNumber: number;
  healthScores: Map<ProviderId, number>;
}

/**
 * Health-based fallback strategy.
 */
export const HealthBasedFallbackStrategy: FallbackStrategy = {
  name: "health-based",
  selectFallbacks(primary: ProviderId, context: FallbackContext): ProviderId[] {
    const scores = Array.from(context.healthScores.entries())
      .filter(([id]) => id !== primary)
      .sort((a, b) => b[1] - a[1]);

    return scores.map(([id]) => id);
  },
};

/**
 * Cost-optimized fallback strategy.
 */
export const CostOptimizedFallbackStrategy: FallbackStrategy = {
  name: "cost-optimized",
  selectFallbacks(primary: ProviderId, context: FallbackContext): ProviderId[] {
    // Sort by cost (cheapest first)
    const model = context.request.model;
    const relevantPricing = MODEL_PRICING.filter((p) => p.model === model);

    return relevantPricing
      .filter((p) => p.provider !== primary)
      .sort(
        (a, b) =>
          a.input_cost_per_1k + a.output_cost_per_1k - (b.input_cost_per_1k + b.output_cost_per_1k),
      )
      .map((p) => p.provider);
  },
};

// ── Zod Schemas ──────────────────────────────────────────────────────────────

export const ProviderRequestSchema = z.object({
  model: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "tool"]),
        content: z.union([
          z.string(),
          z.array(
            z.object({
              type: z.enum(["text", "image", "tool_use", "tool_result"]),
              text: z.string().optional(),
              image_url: z
                .object({
                  url: z.string(),
                  detail: z.enum(["low", "high", "auto"]).optional(),
                })
                .optional(),
              tool_use: z
                .object({
                  id: z.string(),
                  name: z.string(),
                  input: z.record(z.string(), z.unknown()),
                })
                .optional(),
              tool_result: z
                .object({
                  tool_use_id: z.string(),
                  content: z.string(),
                  is_error: z.boolean().optional(),
                })
                .optional(),
            }),
          ),
        ]),
        name: z.string().optional(),
        tool_call_id: z.string().optional(),
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              type: z.literal("function"),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            }),
          )
          .optional(),
      }),
    )
    .min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  stop_sequences: z.array(z.string()).optional(),
  tools: z
    .array(
      z.object({
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          description: z.string(),
          parameters: z.record(z.string(), z.unknown()),
        }),
      }),
    )
    .optional(),
  tool_choice: z
    .union([
      z.enum(["auto", "none", "required"]),
      z.object({ type: z.literal("function"), name: z.string() }),
    ])
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  stream: z.boolean().optional(),
});

export const ProviderResponseSchema = z.object({
  id: z.string(),
  provider: z.enum(["openai", "anthropic", "google", "mistral", "cohere", "meta", "custom"]),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number().int(),
      message: z.object({
        role: z.enum(["system", "user", "assistant", "tool"]),
        content: z.union([z.string(), z.array(z.unknown())]),
      }),
      finish_reason: z.string(),
    }),
  ),
  usage: z.object({
    prompt_tokens: z.number().int(),
    completion_tokens: z.number().int(),
    total_tokens: z.number().int(),
  }),
  latency_ms: z.number(),
  cost_usd: z.number(),
  finish_reason: z.enum(["stop", "length", "tool_calls", "content_filter", "error"]),
  created_at: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
