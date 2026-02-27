/**
 * Engine Contract Translation
 * 
 * Normalizes request/response formats between Reach and different engines.
 * All hashing is delegated to the Rust/WASM deterministic engine core.
 * 
 * NOTE: This module does NOT implement hashing locally.
 * The single source of truth for hashing is:
 *   Go: services/runner/internal/determinism/determinism.go
 *   Rust: crates/engine-core/src/digest.rs
 * 
 * @module engine/translate
 */

import {
  ExecRequest,
  ExecResult,
  ExecutionParams,
} from './contract';
import { WorkflowStep, ExecResultPayload, Duration } from '../protocol/messages';

// ============================================================================
// Precision Clamping for Determinism
// ============================================================================

/**
 * Clamp a floating-point value to exactly 10 decimal places
 * for deterministic fingerprinting and JSON serialization.
 * 
 * This ensures that floating-point numbers are consistently rounded
 * to prevent floating-point precision issues from affecting hashes.
 * 
 * @param value - The floating-point value to clamp
 * @returns The value rounded to exactly 10 decimal places
 */
export function clampPrecision(value: number): number {
  return Math.round(value * 1e10) / 1e10;
}

/**
 * Recursively clamp all number values in an object to 10 decimal places
 * for deterministic serialization.
 * 
 * @param obj - The object to process
 * @returns A new object with all numbers clamped
 */
export function clampObjectPrecision<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'number') {
    return clampPrecision(obj) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => clampObjectPrecision(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      result[key] = clampObjectPrecision((obj as Record<string, unknown>)[key]);
    }
    return result as T;
  }
  
  return obj;
}

// ============================================================================
// DecisionInput/Output Types
// ============================================================================

export interface DecisionInputLegacy {
  actions: string[];
  states: string[];
  outcomes: Record<string, Record<string, number>>;
  algorithm?: string;
  weights?: Record<string, number>;
  strict?: boolean;
  temperature?: number;
  optimism?: number;
  confidence?: number;
  iterations?: number;
  epsilon?: number;
}

export interface DecisionOutputLegacy {
  recommended_action: string;
  ranking: string[];
  trace: {
    algorithm: string;
    regret_table?: Record<string, Record<string, number>>;
    max_regret?: Record<string, number>;
    min_utility?: Record<string, number>;
    weighted_scores?: Record<string, number>;
    fingerprint?: string;
  };
}

// ============================================================================
// Reach -> Engine Request Translation
// ============================================================================

/**
 * Convert Reach-style DecisionInput to canonical ExecRequest
 */
export function decisionInputToExecRequest(
  input: DecisionInputLegacy,
  options?: {
    requestId?: string;
    algorithm?: string;
  },
): ExecRequest {
  return {
    requestId: options?.requestId || generateRequestId(),
    timestamp: new Date().toISOString(),
    params: {
      algorithm: normalizeAlgorithm(options?.algorithm || input.algorithm || 'minimax_regret'),
      actions: [...input.actions].sort(), // Deterministic ordering
      states: [...input.states].sort(),   // Deterministic ordering
      outcomes: normalizeOutcomes(input.outcomes),
      weights: input.weights ? normalizeWeights(input.weights) : undefined,
      strict: input.strict,
      temperature: clampPrecisionOpt(input.temperature),
      optimism: clampPrecisionOpt(input.optimism),
      confidence: clampPrecisionOpt(input.confidence),
      iterations: input.iterations,
      epsilon: clampPrecisionOpt(input.epsilon),
    },
  };
}

/**
 * Clamp precision for optional number values
 */
export function clampPrecisionOpt(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return clampPrecision(value);
}

/**
 * Normalize algorithm name to canonical form
 */
function normalizeAlgorithm(alg: string): ExecutionParams['algorithm'] {
  const normalized = alg.toLowerCase().replace(/[-_]/g, '_');
  
  switch (normalized) {
    case 'minimax_regret':
    case 'minimax':
      return 'minimax_regret';
    case 'maximin':
    case 'worst_case':
    case 'wald':
      return 'maximin';
    case 'weighted_sum':
    case 'weighted':
      return 'weighted_sum';
    case 'softmax':
      return 'softmax';
    case 'hurwicz':
      return 'hurwicz';
    case 'laplace':
      return 'laplace';
    case 'adaptive':
      return 'adaptive';
    default:
      return 'minimax_regret';
  }
}

/**
 * Normalize weights to ensure deterministic ordering
 */
function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const sorted: Record<string, number> = {};
  for (const key of Object.keys(weights).sort()) {
    sorted[key] = clampPrecision(weights[key]);
  }
  return sorted;
}

/**
 * Normalize outcomes to ensure deterministic ordering
 */
function normalizeOutcomes(
  outcomes: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  const normalized: Record<string, Record<string, number>> = {};
  
  // Sort actions for determinism
  const sortedActions = Object.keys(outcomes).sort();
  
  for (const action of sortedActions) {
    const stateMap = outcomes[action];
    const normalizedStates: Record<string, number> = {};
    
    // Sort states for determinism
    const sortedStates = Object.keys(stateMap).sort();
    
    for (const state of sortedStates) {
      // Normalize NaN/Infinity to 0 and clamp precision
      const value = stateMap[state];
      const clampedValue = Number.isFinite(value) ? clampPrecision(value) : 0;
      normalizedStates[state] = clampedValue;
    }
    
    normalized[action] = normalizedStates;
  }
  
  return normalized;
}

// ============================================================================
// Engine Response -> Reach Output Translation
// ============================================================================

/**
 * Convert ExecResult to Reach-style DecisionOutput
 */
export function execResultToDecisionOutput(result: ExecResult): DecisionOutputLegacy {
  return {
    recommended_action: result.recommendedAction,
    ranking: result.ranking,
    trace: {
      algorithm: result.trace.algorithm,
      regret_table: result.trace.regretTable ? clampObjectPrecision(result.trace.regretTable) : undefined,
      max_regret: result.trace.maxRegret ? clampObjectPrecision(result.trace.maxRegret) : undefined,
      min_utility: result.trace.minUtility ? clampObjectPrecision(result.trace.minUtility) : undefined,
      weighted_scores: result.trace.weightedScores ? clampObjectPrecision(result.trace.weightedScores) : undefined,
      fingerprint: result.fingerprint,
    },
  };
}

// ============================================================================
// Rust/WASM Format Translation
// ============================================================================

/**
 * Convert ExecRequest to Rust/WASM format
 * 
 * NOTE: Hashing is performed by the Rust engine, not here.
 */
export function toRustFormat(request: ExecRequest): string {
  // Rust engine uses snake_case - apply precision clamping
  const rustRequest = {
    actions: request.params.actions,
    states: request.params.states,
    outcomes: clampObjectPrecision(request.params.outcomes),
    algorithm: request.params.algorithm,
    weights: request.params.weights ? clampObjectPrecision(request.params.weights) : undefined,
    strict: request.params.strict,
    temperature: clampPrecisionOpt(request.params.temperature),
    optimism: clampPrecisionOpt(request.params.optimism),
    confidence: clampPrecisionOpt(request.params.confidence),
    iterations: request.params.iterations,
    epsilon: clampPrecisionOpt(request.params.epsilon),
    seed: request.params.seed,
  };
  
  return JSON.stringify(rustRequest);
}

/**
 * Parse Rust/WASM output to ExecResult
 * 
 * The fingerprint is computed by the Rust engine and returned in the result.
 */
export function fromRustFormat(jsonString: string, requestId: string, durationMs: number): ExecResult {
  const parsed = JSON.parse(jsonString);
  
  return {
    requestId,
    status: 'success',
    recommendedAction: parsed.recommended_action,
    ranking: parsed.ranking,
    trace: {
      algorithm: parsed.trace?.algorithm || 'unknown',
      regretTable: parsed.trace?.regret_table ? clampObjectPrecision(parsed.trace.regret_table) : undefined,
      maxRegret: parsed.trace?.max_regret ? clampObjectPrecision(parsed.trace.max_regret) : undefined,
      minUtility: parsed.trace?.min_utility ? clampObjectPrecision(parsed.trace.min_utility) : undefined,
      weightedScores: parsed.trace?.weighted_scores ? clampObjectPrecision(parsed.trace?.weighted_scores) : undefined,
    },
    // Fingerprint comes from the Rust engine - single source of truth
    fingerprint: parsed.trace?.fingerprint || '',
    meta: {
      engine: 'rust',
      engineVersion: parsed.meta?.engine_version || '0.3.1',
      durationMs,
      completedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Protocol Translation
// ============================================================================

/**
 * Convert ExecRequest to a Protocol WorkflowStep
 */
export function decisionToWorkflowStep(request: ExecRequest): WorkflowStep {
  return {
    id: 'decision_step',
    step_type: 'decision',
    config: {
      algorithm: request.params.algorithm,
      actions: request.params.actions,
      states: request.params.states,
      outcomes: clampObjectPrecision(request.params.outcomes),
      weights: request.params.weights ? clampObjectPrecision(request.params.weights) : undefined,
      strict: request.params.strict,
      temperature: clampPrecisionOpt(request.params.temperature),
      optimism: clampPrecisionOpt(request.params.optimism),
      confidence: clampPrecisionOpt(request.params.confidence),
      iterations: request.params.iterations,
      epsilon: clampPrecisionOpt(request.params.epsilon),
      seed: request.params.seed,
    },
    depends_on: [],
  };
}

/**
 * Convert Protocol ExecResultPayload to ExecResult contract
 */
export function resultFromProtocol(result: ExecResultPayload, requestId: string): ExecResult {
  const status = result.status.type === 'failed' ? 'error' : 'success';
  const error = result.status.type === 'failed' ? result.status.reason : undefined;

  return {
    requestId: result.run_id || requestId,
    status,
    recommendedAction: '', // Will be populated from events in a real impl
    ranking: [],
    trace: {
      algorithm: 'unknown',
    },
    fingerprint: result.result_digest,
    meta: {
      engine: 'requiem',
      engineVersion: 'unknown',
      durationMs: Number(Duration.toMillis(result.metrics.elapsed_us)),
      completedAt: new Date().toISOString(),
    },
    error,
  };
}

// ============================================================================
// Request ID Generation (Non-Deterministic, Metadata Only)
// ============================================================================

let requestCounter = 0;

/**
 * Generate a unique request ID.
 * 
 * NOTE: This is NOT used for fingerprinting. It's for request correlation
 * in logs and metrics only. The fingerprint is computed from content only.
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (requestCounter++).toString(36).padStart(4, '0');
  return `req_${timestamp}_${counter}`;
}

/**
 * Generate a deterministic request ID for testing purposes.
 */
export function generateDeterministicRequestId(seed: string): string {
  return `req_det_${seed.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16)}`;
}

// ============================================================================
// Result Comparison
// ============================================================================

/**
 * Compare two ExecResults for equality (for dual-run mode)
 */
export function compareExecResults(a: ExecResult, b: ExecResult): {
  match: boolean;
  differences: string[];
} {
  const differences: string[] = [];
  
  if (a.status !== b.status) {
    differences.push(`status: ${a.status} vs ${b.status}`);
  }
  
  if (a.recommendedAction !== b.recommendedAction) {
    differences.push(`recommendedAction: ${a.recommendedAction} vs ${b.recommendedAction}`);
  }
  
  if (a.fingerprint !== b.fingerprint) {
    differences.push(`fingerprint: ${a.fingerprint} vs ${b.fingerprint}`);
  }
  
  // Check ranking order
  if (a.ranking.length !== b.ranking.length) {
    differences.push(`ranking.length: ${a.ranking.length} vs ${b.ranking.length}`);
  } else {
    for (let i = 0; i < a.ranking.length; i++) {
      if (a.ranking[i] !== b.ranking[i]) {
        differences.push(`ranking[${i}]: ${a.ranking[i]} vs ${b.ranking[i]}`);
        break;
      }
    }
  }
  
  return {
    match: differences.length === 0,
    differences,
  };
}
