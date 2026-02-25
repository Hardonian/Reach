#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const providerAdapterPath = path.join(
  repoRoot,
  "apps",
  "arcade",
  "src",
  "lib",
  "providers",
  "provider-adapter.ts",
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requirePattern(source, pattern, description) {
  const matches = pattern.test(source);
  assert(matches, description);
}

function main() {
  assert(fs.existsSync(providerAdapterPath), "provider adapter source file is missing");
  const source = fs.readFileSync(providerAdapterPath, "utf8");

  requirePattern(source, /export\s+type\s+ProviderId\s*=\s*/, "ProviderId type must be exported");
  requirePattern(
    source,
    /export\s+const\s+ProviderRequestSchema\s*=\s*z\.object\(/,
    "ProviderRequestSchema zod contract must exist",
  );
  requirePattern(
    source,
    /export\s+const\s+ProviderResponseSchema\s*=\s*z\.object\(/,
    "ProviderResponseSchema zod contract must exist",
  );
  requirePattern(
    source,
    /export\s+function\s+defaultProviderHealth\s*\(/,
    "defaultProviderHealth must be exported",
  );
  requirePattern(
    source,
    /export\s+function\s+recordSuccess\s*\(/,
    "recordSuccess must be exported",
  );
  requirePattern(
    source,
    /export\s+function\s+recordFailure\s*\(/,
    "recordFailure must be exported",
  );
  requirePattern(
    source,
    /export\s+const\s+HealthBasedFallbackStrategy\s*:\s*FallbackStrategy\s*=/,
    "HealthBasedFallbackStrategy must be exported",
  );
  requirePattern(
    source,
    /export\s+const\s+CostOptimizedFallbackStrategy\s*:\s*FallbackStrategy\s*=/,
    "CostOptimizedFallbackStrategy must be exported",
  );

  for (const provider of ["openai", "anthropic", "google"]) {
    requirePattern(
      source,
      new RegExp(`"${provider}"`),
      `ProviderId must include ${provider} for baseline adapter coverage`,
    );
  }

  for (const requestField of ["model:", "messages:", "temperature:", "max_tokens:"]) {
    requirePattern(
      source,
      new RegExp(requestField.replace(":", "\\s*:\\s*")),
      `ProviderRequestSchema must define ${requestField.replace(":", "")}`,
    );
  }

  for (const responseField of ["choices:", "usage:", "latency_ms:", "cumulative_cost_usd:"]) {
    requirePattern(
      source,
      new RegExp(responseField.replace(":", "\\s*:\\s*")),
      `ProviderResponseSchema must define ${responseField.replace(":", "")}`,
    );
  }

  console.log("✅ provider adapter conformance passed");
}

main();
