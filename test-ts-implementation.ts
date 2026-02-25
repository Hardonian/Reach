#!/usr/bin/env node
import { stableStringify, sha256Hex } from './packages/core/src/nl-compiler/deterministic';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestVector {
  name: string;
  input: unknown;
  expected_ts_fingerprint: string;
  expected_rust_fingerprint: string | null;
  notes: string;
}

console.log('=== Testing nl-compiler/deterministic Implementation ===\n');

try {
  // Load test vectors
  const vectorsPath = path.resolve(__dirname, 'determinism.vectors.json');
  const content = fs.readFileSync(vectorsPath, 'utf8');
  const vectors: TestVector[] = JSON.parse(content);
  
  console.log(`Loaded ${vectors.length} test vectors\n`);
  
  let passed = 0;
  let failed = 0;
  
  // Test each vector
  for (const vector of vectors) {
    const canonical = stableStringify(vector.input);
    const fingerprint = sha256Hex(canonical);
    
    if (fingerprint === vector.expected_ts_fingerprint) {
      console.log(`✅ ${vector.name}`);
      passed++;
    } else {
      console.log(`❌ ${vector.name}`);
      console.log(`   Expected: ${vector.expected_ts_fingerprint}`);
      console.log(`   Got:      ${fingerprint}`);
      failed++;
    }
  }
  
  console.log(`\n=== Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log(`\n❌ ${failed} tests failed!`);
    process.exit(1);
  }
  
} catch (error) {
  console.error(`❌ Error: ${(error as Error).message}`);
  process.exit(1);
}
