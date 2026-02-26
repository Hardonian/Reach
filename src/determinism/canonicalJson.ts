/**
 * canonicalJson — deterministic JSON serialization
 *
 * Produces a stable JSON string by recursively sorting all object keys.
 * This is the single source of truth for canonical serialization in TypeScript
 * components of the Reach system.
 *
 * Design invariants:
 * - Does NOT modify input values
 * - Produces identical output for identical inputs across platforms
 * - Does NOT use Date.now(), Math.random(), or locale-sensitive operations
 * - Handles nested objects, arrays, and primitives
 * - Normalizes numeric edge cases (-0, NaN, Infinity)
 * - Uses code-point sorting (not locale-sensitive)
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

/**
 * Maximum safe integer for deterministic serialization.
 * Values beyond this may lose precision in JSON.
 */
export const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER; // 9007199254740991

/**
 * Normalize a number for deterministic serialization.
 * Handles edge cases: -0, NaN, Infinity, large integers
 */
function normalizeNumber(n: number): number | string {
  // Normalize -0 to +0 (Object.is(-0, 0) is false, but -0 === 0 is true)
  if (n === 0) return 0;
  // Normalize NaN to null (JSON.stringify converts NaN to null)
  if (Number.isNaN(n)) return null as unknown as number;
  // Check for large integers that may lose precision
  if (Number.isInteger(n) && Math.abs(n) > MAX_SAFE_INTEGER) {
    // Return as string to preserve precision
    return String(n);
  }
  return n;
}

/**
 * Recursively canonicalizes a value by sorting object keys alphabetically.
 * Arrays preserve their element order (order is meaningful in arrays).
 * 
 * Uses code-point sorting for cross-platform consistency.
 */
function canonicalize(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    // Normalize numbers
    if (typeof value === "number") {
      return normalizeNumber(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  // Sort keys by code-point order (not locale-sensitive)
  // This ensures consistent ordering across platforms
  const sortedKeys = Object.keys(value).sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
  
  const result: JsonObject = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize((value as JsonObject)[key]);
  }
  return result;
}

/**
 * Returns a deterministic JSON string for any JSON-serializable value.
 * Object keys are sorted alphabetically at every nesting level.
 *
 * @example
 * canonicalJson({ b: 2, a: 1 }) === '{"a":1,"b":2}'
 * canonicalJson({ b: 2, a: 1 }) === canonicalJson({ a: 1, b: 2 }) // always true
 */
export function canonicalJson(value: unknown): string {
  // Serialize through JSON round-trip to normalize the value to JsonValue,
  // then canonicalize for stable key ordering.
  const jsonSafe = JSON.parse(JSON.stringify(value)) as JsonValue;
  return JSON.stringify(canonicalize(jsonSafe));
}

/**
 * Returns a prettified canonical JSON string (2-space indent).
 * Useful for human-readable output while preserving determinism.
 */
export function canonicalJsonPretty(value: unknown): string {
  const jsonSafe = JSON.parse(JSON.stringify(value)) as JsonValue;
  return JSON.stringify(canonicalize(jsonSafe), null, 2);
}

/**
 * Returns true if two values have identical canonical JSON representations.
 * This is the correct equality check for proof-contributing comparisons.
 */
export function canonicalEqual(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
