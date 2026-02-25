/**
 * ReadyLayer Simulation Runner
 *
 * Executes scenario variants against the base run inputs.
 * Produces side-by-side comparison results with a best-variant recommendation.
 */

import {
  getScenario,
  getScenarioRun,
  updateScenarioRun,
  getWorkflowRun,
  type Scenario,
  type ScenarioRun,
  type ScenarioVariant,
  type ScenarioVariantResult,
} from "./cloud-db";
import { logger } from "./logger";

// ── Variant execution ─────────────────────────────────────────────────────

/**
 * Executes a single variant against the playground API.
 * In production, routes to the actual model/provider/tool configuration specified in the variant.
 */
async function executeVariant(
  variant: ScenarioVariant,
  baseInputs: Record<string, unknown>,
  tenantId: string,
): Promise<ScenarioVariantResult> {
  const start = Date.now();

  try {
    // Apply prompt override
    const inputs: Record<string, unknown> = {
      ...baseInputs,
      ...(variant.prompt_override ? { prompt: variant.prompt_override } : {}),
      __variant_config: {
        model: variant.model,
        provider: variant.provider,
        temperature: variant.temperature,
        top_p: variant.top_p,
        disable_tools: variant.disable_tools ?? [],
        inject_latency_ms: variant.inject_latency_ms ?? 0,
      },
    };

    // Inject simulated latency
    if (variant.inject_latency_ms && variant.inject_latency_ms > 0) {
      await new Promise((r) => setTimeout(r, Math.min(variant.inject_latency_ms!, 2000)));
    }

    // Call the playground endpoint for evaluation
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      process.env.READYLAYER_BASE_URL ??
      "http://localhost:3000";
    const maxAttempts = 2;
    let lastErr: string | undefined;
    let outputs: unknown = null;
    let passed = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetch(`${baseUrl}/api/v1/playground`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
            "x-simulation": "1",
          },
          body: JSON.stringify(inputs),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          outputs = await res.json();
          passed = true;
          break;
        } else {
          lastErr = `Playground returned ${res.status}`;
        }
      } catch (fetchErr) {
        lastErr = String(fetchErr);
      }
    }

    const latency_ms = Date.now() - start;

    return {
      variant_id: variant.id,
      variant_label: variant.label,
      status: passed ? "passed" : "failed",
      latency_ms,
      pass_rate: passed ? 1 : 0,
      cumulative_cost_usd: estimateCost(variant, latency_ms),
      error: passed ? undefined : lastErr,
      outputs,
    };
  } catch (err) {
    logger.warn("Variant execution error", {
      variant_id: variant.id,
      err: String(err),
    });
    return {
      variant_id: variant.id,
      variant_label: variant.label,
      status: "error",
      latency_ms: Date.now() - start,
      pass_rate: 0,
      cumulative_cost_usd: 0,
      error: String(err),
    };
  }
}

// Simple cost estimator based on latency as a proxy (no real token counting without model call)
function estimateCost(variant: ScenarioVariant, latencyMs: number): number {
  const baseRate = 0.000002; // ~$2 per million tokens equivalent
  const tokens = Math.ceil(latencyMs / 10); // Rough approximation
  return parseFloat((tokens * baseRate).toFixed(6));
}

// ── Recommendation logic ──────────────────────────────────────────────────

function pickRecommendation(results: ScenarioVariantResult[]): string {
  const passing = results.filter((r) => r.status === "passed");
  if (passing.length === 0)
    return "No variant passed. Review your base prompt or model configuration.";

  // Score: pass_rate × (1 / latency_ms) × (1 / (cost_usd + 0.0001))
  const scored = passing.map((r) => ({
    ...r,
    score: r.pass_rate * (1 / (r.latency_ms || 1)) * (1 / (r.cumulative_cost_usd + 0.0001)),
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  const improvements = results
    .filter((r) => r.variant_id !== best.variant_id && r.status === "passed")
    .map((r) => {
      const latDelta = (((r.latency_ms - best.latency_ms) / best.latency_ms) * 100).toFixed(0);
      return `${r.variant_label}: ${Math.abs(Number(latDelta))}% ${Number(latDelta) > 0 ? "slower" : "faster"}`;
    });

  const riskNote = results.some((r) => r.status === "failed" || r.status === "error")
    ? " ⚠ Some variants failed — check for regressions before deploying."
    : "";

  const improvNote =
    improvements.length > 0 ? ` Compared to: ${improvements.slice(0, 2).join("; ")}.` : "";
  return `Best variant: "${best.variant_label}" (pass rate: ${(best.pass_rate * 100).toFixed(0)}%, latency: ${best.latency_ms}ms, cost: $${best.cumulative_cost_usd}).${improvNote}${riskNote}`;
}

// ── Public runner ─────────────────────────────────────────────────────────

export async function runSimulation(tenantId: string, scenarioRunId: string): Promise<void> {
  const scenarioRun = getScenarioRun(scenarioRunId, tenantId);
  if (!scenarioRun) throw new Error(`Scenario run ${scenarioRunId} not found`);

  const scenario = getScenario(scenarioRun.scenario_id, tenantId);
  if (!scenario) throw new Error(`Scenario ${scenarioRun.scenario_id} not found`);

  // Load base inputs from the linked run if available
  const baseInputs: Record<string, unknown> = scenario.base_run_id
    ? (() => {
        const wr = getWorkflowRun(scenario.base_run_id!, tenantId);
        try {
          return wr ? JSON.parse(wr.inputs_json) : {};
        } catch {
          return {};
        }
      })()
    : {};

  try {
    // Execute all variants in parallel (max 5 concurrent)
    const results: ScenarioVariantResult[] = [];
    const batchSize = 5;
    for (let i = 0; i < scenario.variants.length; i += batchSize) {
      const batch = scenario.variants.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((v) => executeVariant(v, baseInputs, tenantId)),
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          results.push(r.value);
        } else {
          // Variant threw — record as error
          const v = batch[batchResults.indexOf(r)];
          results.push({
            variant_id: v.id,
            variant_label: v.label,
            status: "error",
            latency_ms: 0,
            pass_rate: 0,
            cumulative_cost_usd: 0,
            error: String(r.reason),
          });
        }
      }
    }

    const recommendation = pickRecommendation(results);

    updateScenarioRun(scenarioRunId, tenantId, {
      status: "completed",
      results,
      recommendation,
    });
  } catch (err) {
    logger.warn("Simulation run failed", {
      scenario_run_id: scenarioRunId,
      err: String(err),
    });
    updateScenarioRun(scenarioRunId, tenantId, { status: "failed" });
    throw err;
  }
}
