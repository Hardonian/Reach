#!/usr/bin/env node
import { stableStringify, sha256Hex } from './packages/core/src/nl-compiler/deterministic';

// Test function to compute TS fingerprint
function computeTsFingerprint(input: unknown): string {
    const canonical = stableStringify(input);
    return sha256Hex(canonical);
}

// Test cases
const testCases = [
    { name: 'simple_object', input: { a: 1, b: 2 } },
    { name: 'object_different_key_order', input: { b: 2, a: 1 } },
    { name: 'object_with_float', input: { x: 0.1, y: 0.2 } },
    { name: 'object_with_noisy_float', input: { z: 0.1 + 0.2 } }, // Should be ~0.3000000001490116
    { name: 'simple_array', input: [1, 2, 3] },
    { name: 'nested_object', input: { foo: { bar: 'baz', qux: 123 } } },
    { name: 'null_boolean_string', input: { null: null, bool: true, str: 'test' } },
    { name: 'empty_object', input: {} },
    { name: 'empty_array', input: [] },
];

// Run TS tests
console.log('=== TypeScript Fingerprints ===');
for (const test of testCases) {
    const tsFp = computeTsFingerprint(test.input);
    const canonical = stableStringify(test.input);
    console.log(`${test.name}: ${tsFp}`);
    console.log(`  Canonical: ${canonical}`);
}
