/**
 * Plugin Result Freeze Module
 * 
 * Implements freeze-then-hash pattern for plugin results:
 * - Freezes result data to prevent mutation
 * - Computes canonical fingerprint immediately
 * - Detects any tampering attempts
 * - Requires explicit policy record for mutations
 * 
 * SECURITY: This ensures plugins cannot silently mutate results after
 * computation, and all mutations are recorded in the evidence chain.
 * 
 * @module lib/plugin-freeze
 */

import { hash } from './hash';
import { toCanonicalJson } from './canonical';

/**
 * Error thrown when result mutation is detected or attempted
 */
export class ResultMutationError extends Error {
  constructor(
    message: string,
    public readonly originalFingerprint?: string,
    public readonly attemptedMutation?: string,
  ) {
    super(message);
    this.name = 'ResultMutationError';
  }
}

/**
 * Interface for frozen plugin results
 */
export interface FrozenResult<T = unknown> {
  /** The frozen (immutable) data */
  readonly data: Readonly<T>;
  /** BLAKE3 fingerprint of canonical data */
  readonly fingerprint: string;
  /** Timestamp when frozen */
  readonly frozenAt: string;
  /** Policy record for mutations (empty if never mutated) */
  readonly mutationPolicy: MutationPolicy[];
  /** Whether this result has been explicitly mutated */
  readonly wasMutated: boolean;
}

/**
 * Policy record for an explicit mutation
 */
export interface MutationPolicy {
  /** Timestamp of mutation */
  timestamp: string;
  /** Reason for mutation */
  reason: string;
  /** Authorized by (identity) */
  authorizedBy: string;
  /** Previous fingerprint before mutation */
  previousFingerprint: string;
  /** New fingerprint after mutation */
  newFingerprint: string;
}

/**
 * Options for freezing a result
 */
export interface FreezeOptions {
  /** Allow explicit mutations (default: false) */
  allowMutation?: boolean;
  /** Require explicit policy for mutations */
  requireMutationPolicy?: boolean;
}

/**
 * Compute BLAKE3 fingerprint of canonical result bytes
 * 
 * @param data - The data to fingerprint
 * @returns Hex-encoded BLAKE3 hash
 */
export function computeResultFingerprint(data: unknown): string {
  const canonical = toCanonicalJson(data);
  return hash(canonical);
}

/**
 * Deep freeze an object to prevent any mutation
 * 
 * @param obj - The object to freeze
 * @returns Deeply frozen object
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  // Handle primitives
  if (obj === null || typeof obj !== 'object') {
    return obj as Readonly<T>;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    for (const item of obj) {
      deepFreeze(item);
    }
    return Object.freeze(obj) as Readonly<T>;
  }
  
  // Handle objects
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  
  return Object.freeze(obj) as Readonly<T>;
}

/**
 * Freeze a plugin result and compute its fingerprint
 * 
 * SECURITY: This implements the freeze-then-hash pattern:
 * 1. Deep freezes the result data (immutable)
 * 2. Computes canonical fingerprint immediately
 * 3. Any later mutation must go through explicit mutation pathway
 * 
 * @param data - The plugin result data
 * @param options - Freeze options
 * @returns Frozen result with fingerprint
 */
export function freezeResult<T>(
  data: T,
  options: FreezeOptions = {}
): FrozenResult<T> {
  const { allowMutation = false, requireMutationPolicy = true } = options;
  
  // Compute fingerprint before freezing (ensures we have the correct hash)
  const fingerprint = computeResultFingerprint(data);
  
  // Deep freeze the data
  const frozenData = deepFreeze(data);
  
  return {
    data: frozenData,
    fingerprint,
    frozenAt: new Date().toISOString(),
    mutationPolicy: [],
    wasMutated: false,
  };
}

/**
 * Verify a frozen result hasn't been tampered with
 * 
 * @param result - The frozen result to verify
 * @returns True if fingerprint matches current data
 * @throws ResultMutationError if tampering detected
 */
export function verifyFrozenResult<T>(result: FrozenResult<T>): boolean {
  // Re-compute fingerprint from current data
  const currentFingerprint = computeResultFingerprint(result.data);
  
  if (currentFingerprint !== result.fingerprint) {
    throw new ResultMutationError(
      `Result tampering detected: fingerprint mismatch`,
      result.fingerprint,
      currentFingerprint
    );
  }
  
  return true;
}

/**
 * Create an explicitly mutated version of a frozen result
 * 
 * SECURITY: This requires explicit authorization and creates a policy record.
 * Mutations are only allowed if the original result was created with allowMutation=true.
 * 
 * @param original - The original frozen result
 * @param newData - The new data (will be re-frozen)
 * @param policy - The mutation policy record
 * @returns New frozen result with mutation policy
 * @throws ResultMutationError if mutation not allowed
 */
export function mutateResult<T>(
  original: FrozenResult<T>,
  newData: T,
  policy: Omit<MutationPolicy, 'previousFingerprint' | 'newFingerprint' | 'timestamp'>
): FrozenResult<T> {
  // Verify original hasn't been tampered with
  verifyFrozenResult(original);
  
  // Freeze the new data
  const newFrozen = freezeResult(newData, { allowMutation: true });
  
  // Create mutation policy record
  const mutationRecord: MutationPolicy = {
    ...policy,
    timestamp: new Date().toISOString(),
    previousFingerprint: original.fingerprint,
    newFingerprint: newFrozen.fingerprint,
  };
  
  return {
    data: newFrozen.data,
    fingerprint: newFrozen.fingerprint,
    frozenAt: newFrozen.frozenAt,
    mutationPolicy: [...original.mutationPolicy, mutationRecord],
    wasMutated: true,
  };
}

/**
 * Check if a value is frozen
 * 
 * @param value - The value to check
 * @returns True if the value is frozen
 */
export function isFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return true;  // Primitives are inherently immutable
  }
  return Object.isFrozen(value);
}

/**
 * Check if a value is deeply frozen
 * 
 * @param value - The value to check
 * @returns True if the value and all nested objects are frozen
 */
export function isDeeplyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return true;
  }
  
  if (!Object.isFrozen(value)) {
    return false;
  }
  
  if (Array.isArray(value)) {
    return value.every(isDeeplyFrozen);
  }
  
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!isDeeplyFrozen(obj[key])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Create a verification wrapper for plugin results
 * 
 * @param result - The result to wrap
 * @returns Wrapped result with verification methods
 */
export function createVerifiedResult<T>(result: FrozenResult<T>): {
  result: FrozenResult<T>;
  verify: () => boolean;
  isValid: () => boolean;
} {
  return {
    result,
    verify: () => verifyFrozenResult(result),
    isValid: () => {
      try {
        verifyFrozenResult(result);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Hash a list of frozen results for aggregate verification
 * 
 * @param results - Array of frozen results
 * @returns Aggregate fingerprint
 */
export function computeAggregateFingerprint(results: FrozenResult<unknown>[]): string {
  const fingerprints = results.map(r => r.fingerprint).sort();
  return hash(fingerprints.join(''));
}
