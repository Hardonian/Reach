/**
 * Decision Engine Adapter
 * 
 * Provides a unified interface for decision evaluation engines with support for:
 * - Requiem C++ engine (primary)
 * - Rust engine (WASM/TypeScript fallback)
 * - Dual-run mode (safety comparison)
 * 
 * This module now uses the new engine abstraction layer at src/engine/.
 * 
 * @module decision/engineAdapter
 * @deprecated Use src/engine/ for new code
 */

import {
  createEngine,
  getEngine,
  executeWithEngine,
  checkEngineHealth,
  getEngineInfo,
  parseEngineFlags,
  printEngineStatus,
  loadEngineConfig,
  EngineAdapter,
  ExecRequest,
  ExecResult,
  EngineType,
  EngineHealth,
  EngineCapabilities,
} from '../engine';

import {
  decisionInputToExecRequest,
  execResultToDecisionOutput,
} from '../engine/translate';

import { DecisionInput, DecisionOutput } from '../lib/fallback';

// Re-export types from engine layer
export type { DecisionInput, DecisionOutput };

// ============================================================================
// Legacy Decision Engine Interface (maintained for compatibility)
// ============================================================================

/**
 * Legacy decision engine interface
 * @deprecated Use EngineAdapter from src/engine/
 */
export interface DecisionEngine {
  evaluate(input: DecisionInput): Promise<DecisionOutput>;
}

/**
 * TypeScript Reference Engine
 * Uses the existing fallback implementation as the reference.
 * @deprecated Use RustEngineAdapter from src/engine/
 */
export class TsReferenceEngine implements DecisionEngine {
  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    const { evaluateDecisionFallback } = await import('../lib/fallback');
    return evaluateDecisionFallback(input);
  }
}

/**
 * WASM Engine (Placeholder)
 * Now routes to the new engine abstraction layer.
 * @deprecated Use createEngine() from src/engine/
 */
export class WasmEngine implements DecisionEngine {
  private adapter: EngineAdapter;
  
  constructor() {
    this.adapter = createEngine({ engine: 'rust' });
  }
  
  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    const request = decisionInputToExecRequest(input);
    const result = await this.adapter.execute(request);
    return execResultToDecisionOutput(result);
  }
}

/**
 * Requiem Engine
 * Routes to the new Requiem C++ engine adapter.
 */
export class RequiemDecisionEngine implements DecisionEngine {
  private adapter: EngineAdapter;
  
  constructor() {
    this.adapter = createEngine({ engine: 'requiem' });
  }
  
  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    const request = decisionInputToExecRequest(input);
    const result = await this.adapter.execute(request);
    return execResultToDecisionOutput(result);
  }
}

// ============================================================================
// Decision Engine Factory
// ============================================================================

/**
 * Decision Engine Factory
 * Returns the appropriate engine based on environment configuration.
 * 
 * Resolution order:
 * 1. REACH_ENGINE_FORCE_RUST env var (forces Rust fallback)
 * 2. REACH_ENGINE env var (requiem|rust|dual)
 * 3. --engine CLI flag (if parseEngineFlags used)
 * 4. Default: requiem (with fallback to rust)
 */
export function createDecisionEngine(): DecisionEngine {
  const engineType = resolveEngineType();
  
  console.log(`[DecisionEngine] Using engine: ${engineType}`);
  
  switch (engineType) {
    case 'requiem':
      return new RequiemDecisionEngine();
      
    case 'rust':
    case 'ts':
      return new WasmEngine();
      
    case 'dual':
      return new DualRunDecisionEngine();
      
    default:
      return new RequiemDecisionEngine();
  }
}

/**
 * Resolve engine type from environment
 */
function resolveEngineType(): EngineType {
  // Check force rollback first
  if (process.env.REACH_ENGINE_FORCE_RUST) {
    console.warn('[DecisionEngine] REACH_ENGINE_FORCE_RUST set - using Rust fallback');
    return 'rust';
  }
  
  // Check environment variable
  const envEngine = process.env.REACH_ENGINE;
  if (envEngine) {
    return normalizeEngineType(envEngine);
  }
  
  // Default to Requiem
  return 'requiem';
}

/**
 * Normalize engine type string
 */
function normalizeEngineType(type: string): EngineType {
  const normalized = type.toLowerCase().trim();
  
  if (normalized === 'requiem' || normalized === 'cpp' || normalized === 'c++') {
    return 'requiem';
  }
  
  if (normalized === 'rust' || normalized === 'wasm' || normalized === 'ts' || normalized === 'typescript') {
    return 'rust';
  }
  
  if (normalized === 'dual' || normalized === 'compare' || normalized === 'both') {
    return 'dual';
  }
  
  console.warn(`[DecisionEngine] Unknown engine type "${type}", defaulting to requiem`);
  return 'requiem';
}

// ============================================================================
// Dual-Run Decision Engine
// ============================================================================

/**
 * Dual-Run Decision Engine
 * Runs both engines and compares results for safety validation.
 */
export class DualRunDecisionEngine implements DecisionEngine {
  private requiem: RequiemDecisionEngine;
  private rust: WasmEngine;
  
  constructor() {
    this.requiem = new RequiemDecisionEngine();
    this.rust = new WasmEngine();
  }
  
  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    // Execute both engines
    const [requiemResult, rustResult] = await Promise.all([
      this.requiem.evaluate(input).catch(err => {
        console.warn('[DualRun] Requiem failed:', err);
        return null;
      }),
      this.rust.evaluate(input).catch(err => {
        console.warn('[DualRun] Rust failed:', err);
        return null;
      }),
    ]);
    
    // If Requiem succeeded, use it but compare
    if (requiemResult) {
      if (rustResult) {
        this.compareResults(input, requiemResult, rustResult);
      }
      return requiemResult;
    }
    
    // If Requiem failed but Rust succeeded, fall back to Rust
    if (rustResult) {
      console.warn('[DualRun] Requiem failed, using Rust fallback');
      return rustResult;
    }
    
    // Both failed
    throw new Error('Both engines failed');
  }
  
  private compareResults(
    input: DecisionInput,
    requiem: DecisionOutput,
    rust: DecisionOutput,
  ): void {
    const differences: string[] = [];
    
    if (requiem.recommended_action !== rust.recommended_action) {
      differences.push(`recommended_action: ${requiem.recommended_action} vs ${rust.recommended_action}`);
    }
    
    if (requiem.trace.fingerprint !== rust.trace.fingerprint) {
      differences.push(`fingerprint mismatch`);
    }
    
    if (differences.length > 0) {
      console.warn('[DualRun] Engine mismatch detected:');
      differences.forEach(d => console.warn(`  - ${d}`));
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

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
 * Reset the singleton instance (useful for testing)
 */
export function resetDecisionEngine(): void {
  engineInstance = undefined;
}

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Evaluate a decision using the configured engine
 * 
 * This is the main entry point for decision evaluation.
 * It routes to the appropriate engine based on configuration.
 * 
 * @example
 * ```typescript
 * const result = await evaluateDecision({
 *   actions: ['accept', 'reject'],
 *   states: ['success', 'failure'],
 *   outcomes: {
 *     accept: { success: 1.0, failure: 0.0 },
 *     reject: { success: 0.5, failure: 0.5 },
 *   },
 *   algorithm: 'minimax_regret',
 * });
 * ```
 */
export async function evaluateDecision(input: DecisionInput): Promise<DecisionOutput> {
  const engine = getDecisionEngine();
  return engine.evaluate(input);
}

// ============================================================================
// Re-export Engine Layer Utilities
// ============================================================================

export {
  // Factory functions
  createEngine,
  getEngine,
  
  // Execution
  executeWithEngine,
  
  // Health & Info
  checkEngineHealth,
  getEngineInfo,
  printEngineStatus,
  
  // Configuration
  loadEngineConfig,
  parseEngineFlags,
  
  // Translation
  decisionInputToExecRequest,
  execResultToDecisionOutput,
};

// Export types
export type {
  EngineAdapter,
  ExecRequest,
  ExecResult,
  EngineType,
  EngineHealth,
  EngineCapabilities,
};
