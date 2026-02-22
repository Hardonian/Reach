/**
 * Decision Engine WASM Wrapper
 *
 * This module provides a TypeScript interface to the decision-engine WASM module
 * with automatic fallback to a pure TypeScript implementation when WASM is not available.
 *
 * @packageDocumentation
 */

import type {
  DecisionInput,
  DecisionOutput,
  DecisionResult,
  WasmResponse,
  EngineVersion,
  FingerprintResult,
} from './types';

export * from './types';

// Fallback implementation
import * as fallback from './fallback';

/** WASM module instance (lazy loaded) */
let wasmModule: WasmModule | null = null;

/** Whether WASM loading has been attempted */
let wasmLoadAttempted = false;

/** Whether to use fallback mode */
let useFallback = false;

/** Configuration options */
export interface DecisionEngineOptions {
  /** Force use of fallback implementation */
  forceFallback?: boolean;
  /** Path to WASM module (default: auto-detect) */
  wasmPath?: string;
}

/** WASM module interface */
interface WasmModule {
  evaluate_decision_json(input: string): string;
  compute_fingerprint_json(input: string): string;
  get_engine_version(): string;
}

/**
 * Decision engine error with code and details.
 */
export class DecisionEngineError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'DecisionEngineError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Parse a WASM response and handle errors.
 */
function parseWasmResponse<T>(response: string): T {
  const parsed: WasmResponse<T> = JSON.parse(response);

  if (!parsed.ok) {
    throw new DecisionEngineError(
      parsed.error.code,
      parsed.error.message,
      parsed.error.details
    );
  }

  return parsed.data;
}

/**
 * Convert snake_case to camelCase for JSON keys.
 */
function snakeToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = snakeToCamel(value);
    }
    return result;
  }
  return obj;
}

/**
 * Convert camelCase to snake_case for JSON keys.
 */
function camelToSnake(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(camelToSnake);
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = camelToSnake(value);
    }
    return result;
  }
  return obj;
}

/**
 * Try to load the WASM module.
 */
async function loadWasmModule(): Promise<WasmModule | null> {
  if (typeof window !== 'undefined') {
    // Browser environment
    try {
      const wasm = await import('../wasm/decision_engine.js');
      return wasm;
    } catch {
      return null;
    }
  } else {
    // Node.js environment
    try {
      const wasm = require('../wasm/decision_engine.js');
      return wasm;
    } catch {
      return null;
    }
  }
}

/**
 * Initialize the decision engine.
 *
 * This should be called before using the engine. It attempts to load the WASM
 * module and falls back to the TypeScript implementation if WASM is not available.
 *
 * @param options - Configuration options
 * @returns true if WASM is available, false if using fallback
 */
export async function init(options: DecisionEngineOptions = {}): Promise<boolean> {
  if (options.forceFallback) {
    useFallback = true;
    wasmLoadAttempted = true;
    return false;
  }

  if (wasmLoadAttempted) {
    return !useFallback;
  }

  wasmLoadAttempted = true;

  try {
    wasmModule = await loadWasmModule();
    if (wasmModule) {
      useFallback = false;
      return true;
    }
  } catch {
    // WASM not available
  }

  useFallback = true;
  return false;
}

/**
 * Check if the engine is using WASM or fallback.
 */
export function isWasmEnabled(): boolean {
  return !useFallback && wasmModule !== null;
}

/**
 * Get the engine version.
 */
export function getEngineVersion(): string {
  if (useFallback || !wasmModule) {
    return fallback.getEngineVersion();
  }

  try {
    const response = wasmModule.get_engine_version();
    const data = parseWasmResponse<EngineVersion>(response);
    return data.version;
  } catch {
    return fallback.getEngineVersion();
  }
}

/**
 * Evaluate a decision problem.
 *
 * This is the main entry point for the decision engine. It accepts a DecisionInput
 * and returns a DecisionResult with ranked actions and computation trace.
 *
 * @param input - The decision input
 * @returns The decision result with ranked actions
 * @throws DecisionEngineError if the input is invalid
 *
 * @example
 * ```typescript
 * import { evaluateDecision, init } from '@reach/decision-engine-wasm';
 *
 * // Initialize (optional, but recommended)
 * await init();
 *
 * const result = evaluateDecision({
 *   actions: [{ id: 'buy', label: 'Buy' }],
 *   scenarios: [{ id: 'bull', probability: 1.0, adversarial: false }],
 *   outcomes: [['buy', 'bull', 100]]
 * });
 *
 * console.log('Recommended:', result.rankedActions[0].actionId);
 * console.log('Engine:', result.engine);
 * ```
 */
export function evaluateDecision(input: DecisionInput): DecisionResult {
  // Ensure initialization has been attempted
  if (!wasmLoadAttempted) {
    // Synchronous fallback - init() should be called explicitly for WASM
    useFallback = true;
    wasmLoadAttempted = true;
  }

  if (useFallback || !wasmModule) {
    const output = fallback.evaluateDecision(input);
    return {
      ...output,
      engine: 'fallback',
      engineVersion: fallback.getEngineVersion(),
    };
  }

  try {
    // Convert input to snake_case for WASM
    const snakeInput = camelToSnake(input);
    const inputJson = JSON.stringify(snakeInput);

    const response = wasmModule.evaluate_decision_json(inputJson);
    const data = parseWasmResponse<DecisionOutput>(response);

    // Convert output to camelCase
    const output = snakeToCamel(data) as DecisionOutput;

    return {
      ...output,
      engine: 'wasm',
      engineVersion: getEngineVersion(),
    };
  } catch (error) {
    // If WASM fails, fall back to TypeScript
    const output = fallback.evaluateDecision(input);
    return {
      ...output,
      engine: 'fallback',
      engineVersion: fallback.getEngineVersion(),
    };
  }
}

/**
 * Compute the fingerprint for a decision input.
 *
 * The fingerprint is a SHA-256 hash of the canonical JSON representation
 * of the input. It can be used to verify that the same input produces
 * the same output.
 *
 * @param input - The decision input
 * @returns The 64-character hex fingerprint
 */
export function computeFingerprint(input: DecisionInput): string {
  // Ensure initialization has been attempted
  if (!wasmLoadAttempted) {
    useFallback = true;
    wasmLoadAttempted = true;
  }

  if (useFallback || !wasmModule) {
    return fallback.computeFingerprint(input);
  }

  try {
    // Convert input to snake_case for WASM
    const snakeInput = camelToSnake(input);
    const inputJson = JSON.stringify(snakeInput);

    const response = wasmModule.compute_fingerprint_json(inputJson);
    const data = parseWasmResponse<FingerprintResult>(response);

    return data.fingerprint;
  } catch {
    // If WASM fails, fall back to TypeScript
    return fallback.computeFingerprint(input);
  }
}

/**
 * Evaluate a decision from a JSON string.
 *
 * This is a convenience function for evaluating decisions from JSON strings.
 * It is useful when the input is already serialized as JSON.
 *
 * @param inputJson - JSON string representing a DecisionInput
 * @returns JSON string with the result
 */
export function evaluateDecisionJson(inputJson: string): string {
  const input: DecisionInput = JSON.parse(inputJson);
  const result = evaluateDecision(input);
  return JSON.stringify(result);
}

/**
 * Compute the fingerprint from a JSON string.
 *
 * @param inputJson - JSON string representing a DecisionInput
 * @returns JSON string with the fingerprint
 */
export function computeFingerprintJson(inputJson: string): string {
  const input: DecisionInput = JSON.parse(inputJson);
  const fingerprint = computeFingerprint(input);
  return JSON.stringify({ ok: true, data: { fingerprint } });
}

// Re-export fallback functions for testing
export { fallback };
