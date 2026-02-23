/**
 * test/harness/asserts.ts
 * Stable assertion helpers for system tests.
 * Uses canonical JSON for deterministic comparisons.
 */

import { expect } from "vitest";
import { canonicalJson, canonicalEqual } from "../../src/determinism/canonicalJson.js";

export function assertCanonicalEqual(actual: unknown, expected: unknown, message?: string): void {
  const result = canonicalEqual(actual, expected);
  if (!result) {
    const actualCanonical = canonicalJson(actual);
    const expectedCanonical = canonicalJson(expected);
    const error = message
      ? `${message}\nActual:   ${actualCanonical}\nExpected: ${expectedCanonical}`
      : `Canonical JSON mismatch\nActual:   ${actualCanonical}\nExpected: ${expectedCanonical}`;
    throw new Error(error);
  }
}

export function assertFingerprint(expected: string, actual: string, label = "fingerprint"): void {
  expect(actual, `${label} mismatch`).toBe(expected);
}

export function assertFingerprintStable(fp1: string, fp2: string, label = "fingerprint"): void {
  expect(fp1, `${label} must be stable across runs`).toBe(fp2);
}

export function assertFingerprintChanged(fp1: string, fp2: string, label = "fingerprint"): void {
  expect(fp1, `${label} must differ for different inputs`).not.toBe(fp2);
}

export function assertMetrics(
  expected: Record<string, number>,
  actual: Record<string, number>,
  tolerance = 0.01,
): void {
  for (const [name, value] of Object.entries(expected)) {
    expect(actual[name], `metric '${name}' must be defined`).toBeDefined();
    const actualValue = actual[name];
    if (value === 0) {
      expect(actualValue, `metric '${name}' must be 0`).toBe(0);
    } else {
      const diff = Math.abs(actualValue - value) / Math.abs(value);
      if (diff > tolerance) {
        throw new Error(
          `Metric '${name}': expected ${value}, got ${actualValue} (${(diff * 100).toFixed(2)}% difference, tolerance ${(tolerance * 100).toFixed(0)}%)`,
        );
      }
    }
  }
}

export function assertEntityCount(expected: number, actual: number, label = "entity count"): void {
  expect(actual, label).toBe(expected);
}

export function assertEventTypes(expected: string[], actual: string[]): void {
  expect([...actual].sort(), "event types").toEqual([...expected].sort());
}

export function assertOkResponse(result: { ok: boolean; data: unknown; stderr: string }, label = "CLI response"): void {
  if (!result.ok) {
    throw new Error(`${label} failed.\nstderr: ${result.stderr}\ndata: ${JSON.stringify(result.data)}`);
  }
  expect(result.ok, `${label} ok`).toBe(true);
}

export function assertSchemaVersion(data: unknown, expectedVersion: string): void {
  const obj = data as Record<string, unknown>;
  expect(obj.schemaVersion ?? obj.schema_version, `schemaVersion must be '${expectedVersion}'`).toBe(expectedVersion);
}

export function assertNoTimestampDrift(ts1: string, ts2: string): void {
  // Both timestamps must be identical (deterministic) or both be the fixed epoch
  expect(ts1, "timestamps must be deterministic").toBe(ts2);
}
