import { DecisionInput, DecisionOutput } from "../lib/fallback";
import { getRequiemEngine } from "../engine/adapters/requiem";
import { ExecRequest } from "../engine/contract";

export interface DecisionEngine {
  evaluate(input: DecisionInput): Promise<DecisionOutput>;
}

/**
 * TypeScript Reference Engine
 * Uses the existing fallback implementation as the reference.
 */
export class TsReferenceEngine implements DecisionEngine {
  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    // Import dynamically to allow tree-shaking
    const { evaluateDecisionFallback } = await import("../lib/fallback");
    return evaluateDecisionFallback(input);
  }
}

/**
 * Requiem C++ Engine
 * Integration with the native high-performance engine.
 */
export class RequiemEngine implements DecisionEngine {
  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    const engine = getRequiemEngine();
    
    // Convert DecisionInput to canonical ExecRequest
    const request: ExecRequest = {
      requestId: `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      params: {
        algorithm: (input.algorithm as any) || 'adaptive',
        actions: input.actions,
        states: input.states,
        outcomes: input.outcomes,
        weights: input.weights,
        strict: input.strict,
        temperature: input.temperature,
        optimism: input.optimism,
        confidence: input.confidence,
        iterations: input.iterations,
        epsilon: input.epsilon,
        seed: input.seed
      }
    };

    const result = await engine.evaluate(request);
    
    if (result.status === 'error') {
      throw new Error(`Requiem Evaluation Failed: ${result.error || 'Unknown Error'}`);
    }

    return {
      recommended_action: result.recommendedAction,
      ranking: result.ranking,
      trace: result.trace as any
    };
  }
}

/**
 * WASM Engine (Placeholder)
 * Will be implemented when Rust/WASM engine is available.
 */
export class WasmEngine implements DecisionEngine {
  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    // TODO: Replace with actual WASM engine integration when available
    throw new Error("WASM engine not available yet");
  }
}

/**
 * Decision Engine Factory
 * Returns the appropriate engine based on environment configuration.
 * 
 * SECURITY: Prioritizes REACH_ENGINE_FORCE_RUST for immediate emergency rollback.
 */
export function createDecisionEngine(): DecisionEngine {
  if (process.env.REACH_ENGINE_FORCE_RUST === 'true') {
    return new TsReferenceEngine();
  }

  const engineType = process.env.DECISION_ENGINE || "ts";

  switch (engineType.toLowerCase()) {
    case "requiem":
      return new RequiemEngine();
    case "wasm":
      return new WasmEngine();
    case "ts":
    default:
      return new TsReferenceEngine();
  }
}

/**
 * Singleton instance of the decision engine
 */
let engineInstance: DecisionEngine | undefined;
let activeEngineType: string | undefined;

/**
 * Gets the singleton decision engine instance
 * 
 * NOTE: Detects environment changes and invalidates the singleton
 * to ensure FORCE_RUST and engine switches are respected immediately.
 */
export function getDecisionEngine(): DecisionEngine {
  const forceRust = process.env.REACH_ENGINE_FORCE_RUST === 'true';
  const targetType = forceRust ? "ts" : (process.env.DECISION_ENGINE || "ts").toLowerCase();

  // Invalidate cache if environment flags changed
  if (engineInstance && activeEngineType !== targetType) {
    engineInstance = undefined;
  }

  if (!engineInstance) {
    engineInstance = createDecisionEngine();
    activeEngineType = targetType;
  }
  return engineInstance;
}

/**
 * Evaluate a decision using the configured engine
 */
export async function evaluateDecision(
  input: DecisionInput,
): Promise<DecisionOutput> {
  const engine = getDecisionEngine();
  return engine.evaluate(input);
}

// Re-export types for convenience
export type { DecisionInput, DecisionOutput };
