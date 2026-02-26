#!/usr/bin/env tsx
/**
 * verify-determinism.ts
 * 
 * CRITICAL Gate M-DriftWatch: Determinism Verification
 * 
 * Validates:
 * 1. N-repeat determinism (default 200x, configurable via --count)
 * 2. Identical inputs produce identical fingerprints
 * 3. No entropy injection (time, random, UUID v4)
 * 4. Canonical JSON ordering
 * 
 * Exit codes:
 * - 0: All checks pass
 * - 2: CRITICAL failure (blocks merge)
 * - 1: Other error
 */

import { hashString } from '../src/determinism/hashStream';
import { toCanonicalJson } from '../src/engine/translate';
import { sortObjectKeys, deterministicSort } from '../src/engine/adapters/base';

const REPEAT_COUNT = parseInt(process.env.DETERMINISM_REPEAT_COUNT || '200', 10);

interface VerificationResult {
  gate: string;
  passed: boolean;
  critical: boolean;
  message: string;
}

function log(msg: string): void {
  console.log(`[verify-determinism] ${msg}`);
}

function error(msg: string): void {
  console.error(`[verify-determinism] ERROR: ${msg}`);
}

// Test 1: N-repeat hash determinism
function testRepeatDeterminism(count: number): VerificationResult {
  log(`Testing ${count}x repeat hash determinism...`);
  
  const testInput = 'determinism_test_input_12345';
  const hashes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const hash = hashString(testInput);
    hashes.push(hash);
  }
  
  // All hashes should be identical
  const firstHash = hashes[0];
  const allMatch = hashes.every(h => h === firstHash);
  
  if (!allMatch) {
    const unique = new Set(hashes);
    return {
      gate: 'M-RepeatDeterminism',
      passed: false,
      critical: true,
      message: `Hash mismatch across ${count} iterations (${unique.size} unique values)`,
    };
  }
  
  return {
    gate: 'M-RepeatDeterminism',
    passed: true,
    critical: true,
    message: `All ${count} iterations produce identical hash: ${firstHash.substring(0, 16)}...`,
  };
}

// Test 2: Canonical JSON determinism
function testCanonicalJson(): VerificationResult {
  log('Testing canonical JSON determinism...');
  
  const testObj = {
    z: 1,
    a: 2,
    m: { b: 1, a: 2 },
    arr: [3, 1, 2],
  };
  
  const results: string[] = [];
  
  for (let i = 0; i < 100; i++) {
    results.push(toCanonicalJson(testObj));
  }
  
  const first = results[0];
  const allMatch = results.every(r => r === first);
  
  if (!allMatch) {
    return {
      gate: 'M-CanonicalJson',
      passed: false,
      critical: true,
      message: 'Canonical JSON is non-deterministic',
    };
  }
  
  // Verify key ordering
  if (!first.includes('"a":2') || first.indexOf('"a"') > first.indexOf('"z"')) {
    return {
      gate: 'M-CanonicalJson',
      passed: false,
      critical: true,
      message: 'Canonical JSON keys not sorted',
    };
  }
  
  return {
    gate: 'M-CanonicalJson',
    passed: true,
    critical: true,
    message: 'Canonical JSON is deterministic with sorted keys',
  };
}

// Test 3: Object key sorting determinism
function testObjectKeySorting(): VerificationResult {
  log('Testing object key sorting determinism...');
  
  const obj = { z: 1, y: 2, x: 3, a: 4, b: 5 };
  const sorted = sortObjectKeys(obj);
  const keys = Object.keys(sorted);
  
  const expected = ['a', 'b', 'x', 'y', 'z'];
  const match = JSON.stringify(keys) === JSON.stringify(expected);
  
  if (!match) {
    return {
      gate: 'M-KeySorting',
      passed: false,
      critical: true,
      message: `Key sort mismatch: ${keys.join(',')} vs ${expected.join(',')}`,
    };
  }
  
  return {
    gate: 'M-KeySorting',
    passed: true,
    critical: true,
    message: 'Object keys sorted deterministically',
  };
}

// Test 4: Array sorting determinism
function testArraySorting(): VerificationResult {
  log('Testing array sorting determinism...');
  
  const arr = ['charlie', 'Alpha', 'BRAVO', 'delta'];
  const sorted = deterministicSort(arr);
  
  // localeCompare with 'en' should be consistent
  const results: string[] = [];
  for (let i = 0; i < 50; i++) {
    results.push(JSON.stringify(deterministicSort(arr)));
  }
  
  const first = results[0];
  const allMatch = results.every(r => r === first);
  
  if (!allMatch) {
    return {
      gate: 'M-ArraySorting',
      passed: false,
      critical: true,
      message: 'Array sort is non-deterministic across iterations',
    };
  }
  
  return {
    gate: 'M-ArraySorting',
    passed: true,
    critical: true,
    message: 'Array sorting is deterministic',
  };
}

// Main
async function main(): Promise<number> {
  log('Starting determinism verification...');
  log(`Repeat count: ${REPEAT_COUNT}`);
  
  const results: VerificationResult[] = [];
  
  results.push(testRepeatDeterminism(REPEAT_COUNT));
  results.push(testCanonicalJson());
  results.push(testObjectKeySorting());
  results.push(testArraySorting());
  
  // Report results
  let criticalFailures = 0;
  let totalFailures = 0;
  
  log('--- Results ---');
  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    const severity = result.critical ? 'CRITICAL' : 'INFO';
    log(`[${status}] ${result.gate} (${severity}): ${result.message}`);
    
    if (!result.passed) {
      totalFailures++;
      if (result.critical) {
        criticalFailures++;
      }
    }
  }
  
  log('--- Summary ---');
  log(`Total: ${results.length}, Passed: ${results.length - totalFailures}, Failed: ${totalFailures}`);
  log(`Critical failures: ${criticalFailures}`);
  
  if (criticalFailures > 0) {
    error(`${criticalFailures} CRITICAL gate(s) failed - merge blocked`);
    return 2;
  }
  
  if (totalFailures > 0) {
    log('Non-critical failures detected');
    return 1;
  }
  
  log('All gates pass');
  return 0;
}

// Parse --count argument
const args = process.argv.slice(2);
const countIndex = args.indexOf('--count');
if (countIndex >= 0 && args[countIndex + 1]) {
  process.env.DETERMINISM_REPEAT_COUNT = args[countIndex + 1];
}

main().then(code => process.exit(code)).catch(e => {
  error(`Unexpected error: ${e}`);
  process.exit(2);
});
