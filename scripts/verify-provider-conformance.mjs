#!/usr/bin/env node
import {
  ProviderRequestSchema,
  ProviderResponseSchema,
  defaultProviderHealth,
  recordFailure,
  recordSuccess,
  PerformanceOptimizedFallbackStrategy,
  CostOptimizedFallbackStrategy,
} from "../apps/arcade/src/lib/providers/provider-adapter.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const request = ProviderRequestSchema.parse({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "ping" }],
    temperature: 0.2,
    max_tokens: 64,
  });
  assert(request.messages.length === 1, "request schema should accept minimal valid payload");

  const response = ProviderResponseSchema.parse({
    id: "resp_1",
    provider: "openai",
    model: "gpt-4o-mini",
    choices: [{ index: 0, message: { role: "assistant", content: "pong" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    latency_ms: 120,
    cumulative_cost_usd: 0.0004,
    finish_reason: "stop",
    created_at: "2026-02-25T00:00:00.000Z",
  });
  assert(response.provider === "openai", "response schema should parse provider");

  const healthy = defaultProviderHealth("openai");
  const afterSuccess = recordSuccess(healthy, 100);
  assert(afterSuccess.total_requests === 1, "success should increment request count");
  assert(
    afterSuccess.status === "healthy" || afterSuccess.status === "degraded",
    "status must be valid",
  );

  const afterFailure = recordFailure(afterSuccess, new Error("timeout"));
  assert(afterFailure.total_errors === 1, "failure should increment error count");
  assert(afterFailure.total_requests === 2, "failure should increment request count");

  const fallbackContext = {
    request,
    availableProviders: ["openai", "anthropic", "google"],
    healthMap: {
      openai: defaultProviderHealth("openai"),
      anthropic: defaultProviderHealth("anthropic"),
      google: defaultProviderHealth("google"),
    },
  };

  const perfFallback = PerformanceOptimizedFallbackStrategy.selectFallbacks(
    "openai",
    fallbackContext,
  );
  assert(
    perfFallback.every((provider) => provider !== "openai"),
    "performance fallback excludes primary",
  );

  const costFallback = CostOptimizedFallbackStrategy.selectFallbacks("openai", fallbackContext);
  assert(
    costFallback.every((provider) => provider !== "openai"),
    "cost fallback excludes primary",
  );

  console.log("✅ provider adapter conformance passed");
}

main();
