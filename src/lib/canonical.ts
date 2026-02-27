/**
 * Canonical JSON utility module
 *
 * Re-exports canonical JSON functions from the determinism layer.
 * This is the canonical import path for canonical JSON in Reach.
 *
 * @module lib/canonical
 */

export {
  canonicalJson,
  canonicalJsonPretty,
  canonicalEqual,
  type JsonValue,
  type JsonObject,
  type JsonArray,
} from '../determinism/canonicalJson.js';

import { canonicalJson } from '../determinism/canonicalJson.js';

/**
 * Convert a value to canonical JSON string
 * @param value - Value to convert
 * @returns Canonical JSON string
 */
export function toCanonicalJson(value: unknown): string {
  return canonicalJson(value);
}
