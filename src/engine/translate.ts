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
  ExecutionTrace,
  EngineType,
} from './contract';
import { DecisionInput, DecisionOutput } from '../lib/fallback';

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
      temperature: input.temperature,
      optimism: input.optimism,
      confidence: input.confidence,
      iterations: input.iterations,
      epsilon: input.epsilon,
    },
  };
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
      // Normalize NaN/Infinity to 0
      const value = stateMap[state];
      normalizedStates[state] = Number.isFinite(value) ? value : 0;
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
      regret_table: result.trace.regretTable,
      max_regret: result.trace.maxRegret,
      min_utility: result.trace.minUtility,
      weighted_scores: result.trace.weightedScores,
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
    return Math.round(value * 1e10) / 1e10;
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
  const { createHash } = require('crypto');
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
  const requiemRequest = {
    request_id: request.requestId,
    timestamp: request.timestamp,
    algorithm: request.params.algorithm,
    actions: request.params.actions,
    states: request.params.states,
    outcomes: request.params.outcomes,
    weights: request.params.weights,
    strict: request.params.strict,
    temperature: request.params.temperature,
    optimism: request.params.optimism,
    confidence: request.params.confidence,
    iterations: request.params.iterations,
    epsilon: request.params.epsilon,
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
      regretTable: parsed.trace?.regret_table || parsed.trace?.regretTable,
      maxRegret: parsed.trace?.max_regret || parsed.trace?.maxRegret,
      minUtility: parsed.trace?.min_utility || parsed.trace?.minUtility,
      weightedScores: parsed.trace?.weighted_scores || parsed.trace?.weightedScores,
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
  // Rust engine uses snake_case
  const rustRequest = {
    actions: request.params.actions,
    states: request.params.states,
    outcomes: request.params.outcomes,
    algorithm: request.params.algorithm,
    weights: request.params.weights,
    strict: request.params.strict,
    temperature: request.params.temperature,
    optimism: request.params.optimism,
    confidence: request.params.confidence,
    iterations: request.params.iterations,
    epsilon: request.params.epsilon,
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
      regretTable: parsed.trace?.regret_table,
      maxRegret: parsed.trace?.max_regret,
      minUtility: parsed.trace?.min_utility,
      weightedScores: parsed.trace?.weighted_scores,
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
 * Generate a unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `req_${timestamp}_${random}`;
}

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
