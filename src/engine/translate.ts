/**
 * Engine Contract Translation
 * 
 * Normalizes request/response formats between Reach and different engines.
 * Ensures canonical JSON formatting for deterministic hashing.
 * 
 * @module engine/translate
 */

import {
  ExecRequest,
  ExecResult,
  ExecutionParams,
} from './contract';
import { createHash } from 'crypto';
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
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      result[key] = clampObjectPrecision((obj as Record<string, unknown>)[key]);
    }
    return result as T;
  }
  
  return obj;
}

// ============================================================================
// DecisionInput/Output Types (from fallback.ts)
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
      actions: input.actions,
      states: input.states,
      outcomes: normalizeOutcomes(input.outcomes),
      weights: input.weights,
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
      return 'maximin';
    case 'weighted_sum':
    case 'weighted':
      return 'weighted_sum';
    case 'adaptive':
      return 'adaptive';
    default:
      return 'minimax_regret';
  }
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
      regret_table: clampObjectPrecision(result.trace.regretTable),
      max_regret: clampObjectPrecision(result.trace.maxRegret),
      min_utility: clampObjectPrecision(result.trace.minUtility),
      weighted_scores: clampObjectPrecision(result.trace.weightedScores),
      fingerprint: result.fingerprint,
    },
  };
}

// ============================================================================
// Canonical JSON Normalization
// ============================================================================

/**
 * Convert any value to canonical JSON string for deterministic hashing.
 * Ensures consistent key ordering and number formatting.
 */
export function toCanonicalJson(obj: unknown): string {
  return JSON.stringify(obj, canonicalReplacer, 0);
}

/**
 * JSON replacer for canonical formatting
 */
function canonicalReplacer(key: string, value: unknown): unknown {
  // Handle numbers - ensure consistent precision
  if (typeof value === 'number') {
    // Round to 10 decimal places to avoid floating point inconsistencies
    // while maintaining sufficient precision
    return clampPrecision(value);
  }
  
  // Handle objects - sort keys for determinism
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  
  return value;
}

/**
 * Compute deterministic hash of an object
 */
export function computeDeterministicHash(obj: unknown): string {
  const canonical = toCanonicalJson(obj);
  
  // Use Node.js crypto for hashing
  return createHash('sha256').update(canonical).digest('hex').substring(0, 32);
}

// ============================================================================
// Requiem Format Translation (Future)
// ============================================================================

/**
 * Convert ExecRequest to Requiem CLI format
 */
export function toRequiemFormat(request: ExecRequest): string {
  // Requiem expects a JSON object with specific field names
  // Apply precision clamping to all numeric values
  const requiemRequest = {
    request_id: request.requestId,
    timestamp: request.timestamp,
    algorithm: request.params.algorithm,
    actions: request.params.actions,
    states: request.params.states,
    outcomes: clampObjectPrecision(request.params.outcomes),
    weights: clampObjectPrecision(request.params.weights),
    strict: request.params.strict,
    temperature: clampPrecisionOpt(request.params.temperature),
    optimism: clampPrecisionOpt(request.params.optimism),
    confidence: clampPrecisionOpt(request.params.confidence),
    iterations: request.params.iterations,
    epsilon: clampPrecisionOpt(request.params.epsilon),
    // Pass the deterministic seed for RNG/Adaptive algorithm
    seed: request.params.seed,
  };
  
  return JSON.stringify(requiemRequest);
}

/**
 * Parse Requiem CLI output to ExecResult
 */
export function fromRequiemFormat(jsonString: string, requestId: string): ExecResult {
  const parsed = JSON.parse(jsonString);
  
  return {
    requestId: parsed.request_id || requestId,
    status: parsed.status || 'success',
    recommendedAction: parsed.recommended_action || parsed.recommendedAction,
    ranking: parsed.ranking || [],
    trace: {
      algorithm: parsed.trace?.algorithm || 'unknown',
      regretTable: clampObjectPrecision(parsed.trace?.regret_table || parsed.trace?.regretTable),
      maxRegret: clampObjectPrecision(parsed.trace?.max_regret || parsed.trace?.maxRegret),
      minUtility: clampObjectPrecision(parsed.trace?.min_utility || parsed.trace?.minUtility),
      weightedScores: clampObjectPrecision(parsed.trace?.weighted_scores || parsed.trace?.weightedScores),
    },
    fingerprint: parsed.fingerprint || computeDeterministicHash(parsed),
    meta: {
      engine: 'requiem',
      engineVersion: parsed.meta?.engine_version || parsed.meta?.engineVersion || 'unknown',
      durationMs: parsed.meta?.duration_ms || parsed.meta?.durationMs || 0,
      completedAt: parsed.meta?.completed_at || parsed.meta?.completedAt || new Date().toISOString(),
    },
  };
}

// ============================================================================
// Rust/WASM Format Translation
// ============================================================================

/**
 * Convert ExecRequest to Rust/WASM format
 */
export function toRustFormat(request: ExecRequest): string {
  // Rust engine uses snake_case - apply precision clamping
  const rustRequest = {
    actions: request.params.actions,
    states: request.params.states,
    outcomes: clampObjectPrecision(request.params.outcomes),
    algorithm: request.params.algorithm,
    weights: clampObjectPrecision(request.params.weights),
    strict: request.params.strict,
    temperature: clampPrecisionOpt(request.params.temperature),
    optimism: clampPrecisionOpt(request.params.optimism),
    confidence: clampPrecisionOpt(request.params.confidence),
    iterations: request.params.iterations,
    epsilon: clampPrecisionOpt(request.params.epsilon),
    // Pass the deterministic seed for RNG/Adaptive algorithm
    seed: request.params.seed,
  };
  
  return JSON.stringify(rustRequest);
}

/**
 * Parse Rust/WASM output to ExecResult
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
      regretTable: clampObjectPrecision(parsed.trace?.regret_table),
      maxRegret: clampObjectPrecision(parsed.trace?.max_regret),
      minUtility: clampObjectPrecision(parsed.trace?.min_utility),
      weightedScores: clampObjectPrecision(parsed.trace?.weighted_scores),
    },
    fingerprint: parsed.trace?.fingerprint || computeDeterministicHash(parsed),
    meta: {
      engine: 'rust',
      engineVersion: '0.3.1',
      durationMs,
      completedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Utilities
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
      weights: clampObjectPrecision(request.params.weights),
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
