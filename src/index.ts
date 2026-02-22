import { evaluateDecisionFallback, type DecisionInput, type DecisionOutput } from './lib/fallback.js';

export class DecisionEngine {
  private wasmModule: any = null;
  private initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      // Use dynamic import for ESM compatibility and optional loading
      this.wasmModule = await import('../pkg/decision_engine_rs.js').catch(() => null);
      if (!this.wasmModule) {
        console.warn("WARN: WASM module not found at '../pkg/decision_engine_rs.js'. Using fallback.");
      }
    } catch (e) {
      console.warn("WARN: Failed to load WASM decision engine. Falling back to TS implementation.", e);
    }
    this.initialized = true;
  }

  evaluate(input: DecisionInput): DecisionOutput {
    if (this.wasmModule && typeof this.wasmModule.evaluate_decision === 'function') {
      try {
        const inputJson = JSON.stringify(input);
        const outputJson = this.wasmModule.evaluate_decision(inputJson);
        return JSON.parse(outputJson);
      } catch (e) {
        console.error("ERROR: WASM execution failed. Using fallback.", e);
      }
    }
    return evaluateDecisionFallback(input);
  }
}

/**
 * Singleton instance for convenience, maintaining backwards compatibility
 * while allowing class-based instantiation for testing.
 */
const defaultEngine = new DecisionEngine();

export async function evaluateDecision(input: DecisionInput): Promise<DecisionOutput> {
  await defaultEngine.init();
  return defaultEngine.evaluate(input);
}

export { type DecisionInput, type DecisionOutput };

// Usage Example (for verification)
/*
const input = {
  actions: ["a1", "a2"],
  states: ["s1", "s2"],
  outcomes: { "a1": {"s1": 10, "s2": 5}, "a2": {"s1": 0, "s2": 20} }
};
console.log(evaluateDecision(input));
*/