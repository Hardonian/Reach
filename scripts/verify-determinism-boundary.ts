#!/usr/bin/env node
/**
 * Determinism Boundary Verification Script
 * 
 * Verifies that the deterministic boundary is intact and that
 * no entropy sources have leaked into the fingerprint path.
 * 
 * Run: npx tsx scripts/verify-determinism-boundary.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

function runCheck(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ check: name, status: 'PASS', message: 'Check passed' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    results.push({ check: name, status: 'FAIL', message: msg });
  }
}

// Check 1: Verify no duplicate hash implementations
runCheck('Single Hash Authority', () => {
  const patterns = [
    'crypto/sha256',
    'blake3',
    'crypto.createHash',
  ];
  
  const hashFiles: string[] = [];
  
  for (const pattern of patterns) {
    try {
      const output = execSync(
        `rg -l "${pattern}" services/runner/internal --type go`,
        { encoding: 'utf8' }
      );
      hashFiles.push(...output.trim().split('\n').filter(Boolean));
    } catch {
      // No matches
    }
  }
  
  // Should only be determinism.go and pack/merkle.go (merkle is for trees, not general hashing)
  const uniqueFiles = [...new Set(hashFiles)];
  const nonAuthority = uniqueFiles.filter(f => 
    !f.includes('determinism.go') && 
    !f.includes('merkle.go')
  );
  
  if (nonAuthority.length > 0) {
    throw new Error(`Hash implementations found outside authority: ${nonAuthority.join(', ')}`);
  }
});

// Check 2: Verify fallback.ts is archived
runCheck('Fallback Archived', () => {
  if (fs.existsSync('fallback.ts')) {
    throw new Error('fallback.ts still exists (should be archived)');
  }
  
  if (!fs.existsSync('fallback.ts.deprecated')) {
    throw new Error('fallback.ts.deprecated not found');
  }
});

// Check 3: Verify boundary.go exists
runCheck('Boundary Authority Exists', () => {
  const boundaryPath = 'services/runner/internal/determinism/boundary.go';
  if (!fs.existsSync(boundaryPath)) {
    throw new Error('boundary.go not found');
  }
  
  const content = fs.readFileSync(boundaryPath, 'utf8');
  if (!content.includes('DigestAuthority')) {
    throw new Error('DigestAuthority not found in boundary.go');
  }
});

// Check 4: Verify manifest files exist
runCheck('Determinism Manifest Exists', () => {
  const manifestPath = 'docs/DETERMINISM_MANIFEST.md';
  if (!fs.existsSync(manifestPath)) {
    throw new Error('DETERMINISM_MANIFEST.md not found');
  }
  
  const content = fs.readFileSync(manifestPath, 'utf8');
  if (!content.includes('Version: 1.0.0')) {
    throw new Error('Manifest version not found');
  }
});

// Check 5: Verify no time.Now in determinism package (except tests)
runCheck('No Wall-Clock in Determinism', () => {
  try {
    const output = execSync(
      'rg "time\\.Now" services/runner/internal/determinism --type go',
      { encoding: 'utf8' }
    );
    // Allow in test files
    const nonTestMatches = output
      .split('\n')
      .filter(line => line && !line.includes('_test.go'));
    
    if (nonTestMatches.length > 0) {
      throw new Error(`time.Now found: ${nonTestMatches.join(', ')}`);
    }
  } catch (e) {
    // rg returns exit code 1 if no matches found - that's what we want
    if ((e as any).status !== 1) {
      throw e;
    }
  }
});

// Check 6: Verify API contract exists
runCheck('API Surface Contract Exists', () => {
  const contractPath = 'docs/API_SURFACE_CONTRACT.md';
  if (!fs.existsSync(contractPath)) {
    throw new Error('API_SURFACE_CONTRACT.md not found');
  }
});

// Check 7: Run Go boundary tests
runCheck('Go Boundary Tests', () => {
  try {
    execSync(
      'go test ./services/runner/internal/determinism/... -run "TestEntropy|TestCompute|TestIsolation" -v',
      { encoding: 'utf8', stdio: 'pipe' }
    );
  } catch (e) {
    const msg = (e as any).stdout || (e as any).message;
    throw new Error(`Go tests failed: ${msg}`);
  }
});

// Check 8: Verify import boundaries
runCheck('Import Boundaries', () => {
  try {
    execSync('npm run validate:boundaries', { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    throw new Error('Import boundary validation failed');
  }
});

// Print results
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  DETERMINISM BOUNDARY VERIFICATION');
console.log('═══════════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

for (const result of results) {
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${result.check}`);
  console.log(`   ${result.status}: ${result.message}`);
  if (result.details) {
    console.log(`   Details: ${result.details}`);
  }
  console.log();
  
  if (result.status === 'PASS') passed++;
  else if (result.status === 'FAIL') failed++;
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${results.length - passed - failed} skipped`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  console.log('❌ VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('✅ ALL CHECKS PASSED');
  console.log('\nThe deterministic boundary is intact and frozen.');
  console.log('No entropy sources detected in fingerprint path.\n');
  process.exit(0);
}
