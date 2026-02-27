/**
 * Canonical JSON Module
 *
 * This module provides a centralized implementation of canonical JSON serialization.
 * This ensures that the same logical object always serializes to the same byte
 * string, which is critical for deterministic hashing and fingerprinting.
 *
 * @module lib/canonical
 */

/**
 * Convert value to canonical JSON string for deterministic hashing
 *
 * SECURITY: Ensures consistent ordering of keys for deterministic fingerprints.
 * Handles circular references by throwing (they indicate potential issues).
 *
 * @param value - The value to canonicalize
 * @returns Canonical JSON string
 */
export function toCanonicalJson(value: unknown): string {
  // Use deterministic sorting of keys
  const sorted = sortKeysDeep(value);
  return JSON.stringify(sorted);
}

/**
 * Recursively sort object keys for canonical representation
 */
function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  // Handle objects - sort keys alphabetically
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(value).sort();

  for (const key of keys) {
    sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
  }

  return sorted;
}
