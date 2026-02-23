import { canonicalJson, canonicalEqual } from "../../src/determinism/canonicalJson";
import { describe, it, expect } from "vitest";

export function assertCanonicalEqual(actual: any, expected: any, message?: string): void {
  const result = canonicalEqual(actual, expected);
  if (!result) {
    const actualCanonical = canonicalJson(actual);
    const expectedCanonical = canonicalJson(expected);
    const error = message 
      ? `${message}\nActual: ${actualCanonical}\nExpected: ${expectedCanonical}`
      : `Canonical JSON mismatch\nActual: ${actualCanonical}\nExpected: ${expectedCanonical}`;
    throw new Error(error);
  }
}

export function assertFingerprint(expected: string, actual: string): void {
  expect(actual).toBe(expected);
}

export function assertMetrics(
  expected: { counters: Record<string, number>; gauges: Record<string, number> },
  actual: { counters: Record<string, number>; gauges: Record<string, number> },
  tolerance: number = 0.01
): void {
  Object.entries(expected.counters).forEach(([name, value]) => {
    expect(actual.counters[name]).toBeDefined();
    const actualValue = actual.counters[name];
    const diff = Math.abs(actualValue - value);
    const percentageDiff = diff / value;
    if (percentageDiff > tolerance) {
      throw new Error(`Counter ${name}: expected ${value}, got ${actualValue} (${(percentageDiff * 100).toFixed(2)}% difference)`);
    }
  });

  Object.entries(expected.gauges).forEach(([name, value]) => {
    expect(actual.gauges[name]).toBeDefined();
    const actualValue = actual.gauges[name];
    const diff = Math.abs(actualValue - value);
    const percentageDiff = diff / value;
    if (percentageDiff > tolerance) {
      throw new Error(`Gauge ${name}: expected ${value}, got ${actualValue} (${(percentageDiff * 100).toFixed(2)}% difference)`);
    }
  });
}

export function assertEntityCount(expected: number, actual: number): void {
  expect(actual).toBe(expected);
}

export function assertEventTypes(expected: string[], actual: string[]): void {
  expect(actual.sort()).toEqual(expected.sort());
}
