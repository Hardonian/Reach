/**
 * Decision Engine Adapter
 * Provides a unified interface for decision evaluation engines with support for TS fallback and WASM engine.
 */

import { DecisionInput, DecisionOutput } from '../fallback';

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
    const { evaluateDecisionFallback } = await import('../fallback');
    return evaluateDecisionFallback(input);
  }
}

/**
 * WASM Engine (Placeholder)
 * Will be implemented when Rust/WASM engine is available.
 */
export class WasmEngine implements DecisionEngine {
  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    // TODO: Replace with actual WASM engine integration when available
    throw new Error('WASM engine not available yet');
  }
}

/**
 * Decision Engine Factory
 * Returns the appropriate engine based on environment configuration.
 */
export function createDecisionEngine(): DecisionEngine {
  const engineType = process.env.DECISION_ENGINE || 'ts';
  
  switch (engineType.toLowerCase()) {
    case 'wasm':
      return new WasmEngine();
    case 'ts':
    default:
      return new TsReferenceEngine();
  }
}

/**
 * Singleton instance of the decision engine
 */
let engineInstance: DecisionEngine | undefined;

/**
 * Gets the singleton decision engine instance
 */
export function getDecisionEngine(): DecisionEngine {
  if (!engineInstance) {
    engineInstance = createDecisionEngine();
  }
  return engineInstance;
}

/**
 * Evaluate a decision using the configured engine
 */
export async function evaluateDecision(input: DecisionInput): Promise<DecisionOutput> {
  const engine = getDecisionEngine();
  return engine.evaluate(input);
}

// Re-export types for convenience
export type { DecisionInput, DecisionOutput };
