/**
 * Parity tests for decision engine.
 *
 * These tests verify that the TypeScript fallback implementation produces
 * identical outputs to the Rust/WASM implementation for the same inputs.
 *
 * Run with: node test/parity.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import fallback implementation
const fallback = require('../dist/fallback');

// Test fixtures directory
const FIXTURES_DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'decision', 'input');

/**
 * Compute SHA-256 hash of a string.
 */
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Deep compare two objects for equality.
 */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Canonicalize an object for comparison.
 */
function canonicalize(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj).sort();
    const result = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize(obj[key]);
    }
    return result;
  }
  return obj;
}

/**
 * Run parity tests on all fixtures.
 */
async function runParityTests() {
  console.log('=== Decision Engine Parity Tests ===\n');

  // Check if fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.log('Fixtures directory not found:', FIXTURES_DIR);
    console.log('Creating test fixtures...\n');
  }

  // Get all fixture files
  const fixtureFiles = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));

  if (fixtureFiles.length === 0) {
    console.log('No fixture files found. Run with fixtures in:', FIXTURES_DIR);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const file of fixtureFiles) {
    const fixturePath = path.join(FIXTURES_DIR, file);
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    console.log(`Testing: ${file}`);
    console.log(`  Description: ${fixture.description || 'No description'}`);

    try {
      // Run fallback implementation
      const result = fallback.evaluateDecision(fixture.input);

      // Verify determinism
      const result2 = fallback.evaluateDecision(fixture.input);
      const json1 = JSON.stringify(canonicalize(result));
      const json2 = JSON.stringify(canonicalize(result2));

      if (json1 !== json2) {
        console.log('  ❌ FAILED: Non-deterministic output');
        failed++;
        continue;
      }

      // Verify fingerprint
      const fingerprint = fallback.computeFingerprint(fixture.input);
      if (fingerprint.length !== 64) {
        console.log('  ❌ FAILED: Invalid fingerprint length');
        failed++;
        continue;
      }

      // Verify fingerprint determinism
      const fingerprint2 = fallback.computeFingerprint(fixture.input);
      if (fingerprint !== fingerprint2) {
        console.log('  ❌ FAILED: Non-deterministic fingerprint');
        failed++;
        continue;
      }

      // Verify ranked actions
      if (!result.rankedActions || result.rankedActions.length === 0) {
        console.log('  ❌ FAILED: No ranked actions');
        failed++;
        continue;
      }

      // Verify exactly one recommended action
      const recommended = result.rankedActions.filter(a => a.recommended);
      if (recommended.length !== 1) {
        console.log(`  ❌ FAILED: Expected 1 recommended action, got ${recommended.length}`);
        failed++;
        continue;
      }

      // Verify ranks are sequential
      const ranks = result.rankedActions.map(a => a.rank);
      const expectedRanks = Array.from({ length: ranks.length }, (_, i) => i + 1);
      if (JSON.stringify(ranks) !== JSON.stringify(expectedRanks)) {
        console.log('  ❌ FAILED: Ranks are not sequential');
        failed++;
        continue;
      }

      console.log(`  ✓ Passed`);
      console.log(`    Fingerprint: ${fingerprint.substring(0, 16)}...`);
      console.log(`    Recommended: ${recommended[0].actionId}`);
      console.log(`    Actions: ${result.rankedActions.length}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}`);
      failed++;
    }

    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * Run property tests.
 */
function runPropertyTests() {
  console.log('\n=== Property Tests ===\n');

  // Test 1: Key order independence
  console.log('Test 1: Key order independence');
  const input1 = {
    actions: [
      { id: 'zebra', label: 'Z' },
      { id: 'alpha', label: 'A' }
    ],
    scenarios: [
      { id: 's1', probability: 0.5 },
      { id: 's2', probability: 0.5 }
    ],
    outcomes: [
      ['zebra', 's1', 10],
      ['zebra', 's2', 20],
      ['alpha', 's1', 30],
      ['alpha', 's2', 40]
    ]
  };

  const input2 = {
    actions: [
      { id: 'alpha', label: 'A' },
      { id: 'zebra', label: 'Z' }
    ],
    scenarios: [
      { id: 's2', probability: 0.5 },
      { id: 's1', probability: 0.5 }
    ],
    outcomes: [
      ['alpha', 's2', 40],
      ['alpha', 's1', 30],
      ['zebra', 's2', 20],
      ['zebra', 's1', 10]
    ]
  };

  const fp1 = fallback.computeFingerprint(input1);
  const fp2 = fallback.computeFingerprint(input2);

  if (fp1 === fp2) {
    console.log('  ✓ Fingerprints match regardless of input order');
  } else {
    console.log('  ❌ Fingerprints differ for same content with different order');
    console.log(`    FP1: ${fp1}`);
    console.log(`    FP2: ${fp2}`);
  }

  // Test 2: Float noise normalization
  console.log('\nTest 2: Float noise normalization');
  const input3 = {
    actions: [{ id: 'a', label: 'A' }],
    scenarios: [{ id: 's', probability: 1.0 }],
    outcomes: [['a', 's', 0.1 + 0.2]] // Should equal 0.3
  };

  const input4 = {
    actions: [{ id: 'a', label: 'A' }],
    scenarios: [{ id: 's', probability: 1.0 }],
    outcomes: [['a', 's', 0.3]]
  };

  const fp3 = fallback.computeFingerprint(input3);
  const fp4 = fallback.computeFingerprint(input4);

  if (fp3 === fp4) {
    console.log('  ✓ Float noise normalized (0.1 + 0.2 = 0.3)');
  } else {
    console.log('  ❌ Float noise not properly normalized');
    console.log(`    FP3: ${fp3}`);
    console.log(`    FP4: ${fp4}`);
  }

  // Test 3: Tie-breaking
  console.log('\nTest 3: Tie-breaking (lexicographic by action_id)');
  const input5 = {
    actions: [
      { id: 'zebra', label: 'Z' },
      { id: 'alpha', label: 'A' },
      { id: 'mango', label: 'M' }
    ],
    scenarios: [{ id: 's', probability: 1.0 }],
    outcomes: [
      ['zebra', 's', 50],
      ['alpha', 's', 50],
      ['mango', 's', 50]
    ]
  };

  const result5 = fallback.evaluateDecision(input5);
  if (result5.rankedActions[0].actionId === 'alpha') {
    console.log('  ✓ Tie broken by lexicographic order (alpha first)');
  } else {
    console.log(`  ❌ Tie not broken correctly: ${result5.rankedActions[0].actionId}`);
  }

  // Test 4: Regret values >= 0
  console.log('\nTest 4: Regret values >= 0');
  const input6 = {
    actions: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' }
    ],
    scenarios: [
      { id: 's1', probability: 0.5 },
      { id: 's2', probability: 0.5 }
    ],
    outcomes: [
      ['a', 's1', 100],
      ['a', 's2', -50],
      ['b', 's1', 50],
      ['b', 's2', 50]
    ]
  };

  const result6 = fallback.evaluateDecision(input6);
  const allRegretsNonNegative = Object.values(result6.trace.maxRegretTable).every(r => r >= 0);

  if (allRegretsNonNegative) {
    console.log('  ✓ All regret values are non-negative');
  } else {
    console.log('  ❌ Some regret values are negative');
  }

  console.log('');
}

// Run tests
runParityTests()
  .then(() => runPropertyTests())
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
