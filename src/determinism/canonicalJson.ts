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
 */

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

/**
 * Recursively canonicalizes a value by sorting object keys alphabetically.
 * Arrays preserve their element order (order is meaningful in arrays).
 */
function canonicalize(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  // Sort keys alphabetically for deterministic output
  const sortedKeys = Object.keys(value).sort();
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
