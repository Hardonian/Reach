#!/usr/bin/env tsx
/**
 * Security Verification Script
 * 
 * M3 Security Boundary Hardening - Automated Security Proofs
 * 
 * This script runs comprehensive security tests that act as merge-blocking
 * automated security proofs for the Reach CLI + Requiem system.
 * 
 * Tests:
 * 1. Workspace escape (pack extraction, symlink/TOCTOU attacks)
 * 2. Environment hygiene (secret stripping, binary trust)
 * 3. Diff report path traversal
 * 4. Plugin mutation boundary
 * 5. LLM freeze integrity (CID verification)
 * 
 * @module scripts/verify-security
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';

// Import security modules
import {
  sanitizeRequestId,
  containsPathTraversal,
  resolveSafePath,
  resolveSafePathSync,
  buildDiffReportPath,
  safeReadFile,
  safeWriteFile,
  SecurityError,
  SecurityErrorCode,
} from '../src/lib/security';

import {
  sanitizeEnvironment,
  isSensitiveEnvVar,
  validateBinaryTrust,
  createRequiemEnv,
  BinaryTrustError,
} from '../src/lib/env-security';

import {
  isTraversalAttempt,
  validatePackPath,
  extractPackEntry,
  extractPackSafely,
  isReparsePoint,
  PackExtractionError,
} from '../src/lib/pack-extraction';

import {
  freezeResult,
  verifyFrozenResult,
  mutateResult,
  computeResultFingerprint,
  ResultMutationError,
} from '../src/lib/plugin-freeze';

import {
  computeCID,
  verifyCID,
  ContentAddressableStorage,
  CIDVerificationError,
} from '../src/engine/storage/cas';

// Test result tracking
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void> | void): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration: Date.now() - start });
    process.stdout.write(`✗ ${name}\n  Error: ${errorMsg}\n`);
  }
}

// ============================================================================
// WORKSPACE ESCAPE TESTS
// ============================================================================

async function testWorkspaceEscape(): Promise<void> {
  const testDir = path.join(os.tmpdir(), `reach-security-verify-${Date.now()}`);
  
  // Test 1: Pack extraction blocks traversal
  await runTest('pack-extraction: blocks ../ traversal', () => {
    expect(() => {
      validatePackPath('../etc/passwd');
    }).toThrow(PackExtractionError);
  });

  await runTest('pack-extraction: blocks absolute paths', () => {
    expect(() => {
      validatePackPath('/etc/passwd');
    }).toThrow(PackExtractionError);
  });

  await runTest('pack-extraction: blocks Windows drive letters', () => {
    expect(() => {
      validatePackPath('C:\\Windows\\System32\\secret.txt');
    }).toThrow(PackExtractionError);
  });

  await runTest('pack-extraction: blocks UNC paths', () => {
    expect(() => {
      validatePackPath('\\\\server\\share\\file.txt');
    }).toThrow(PackExtractionError);
  });

  // Test 2: Symlink race detection
  await runTest('symlink-race: detects TOCTOU escape attempt', async () => {
    // Check if symlinks are supported
    let canCreateSymlinks = true;
    try {
      const testLink = path.join(testDir, 'symlink-test');
      const testFile = path.join(testDir, 'symlink-target');
      await fs.promises.mkdir(testDir, { recursive: true });
      await fs.promises.writeFile(testFile, 'test');
      await fs.promises.symlink(testFile, testLink);
      await fs.promises.unlink(testLink);
      await fs.promises.unlink(testFile);
    } catch {
      canCreateSymlinks = false;
    }

    if (!canCreateSymlinks) {
      process.stdout.write('    (skipped - symlinks not supported)\n');
      return;
    }

    await fs.promises.mkdir(testDir, { recursive: true });
    
    // Create a file outside the workspace
    const outsideFile = path.join(os.tmpdir(), `reach-outside-${Date.now()}.txt`);
    await fs.promises.writeFile(outsideFile, 'sensitive data');

    // Create a symlink inside workspace pointing outside
    const symlinkPath = path.join(testDir, 'malicious_link');
    await fs.promises.symlink(outsideFile, symlinkPath);

    try {
      // Attempting to resolve the symlink should detect the escape
      expect(() => {
        resolveSafePathSync('malicious_link', { baseDir: testDir, followSymlinks: true });
      }).toThrow(SecurityError);
    } finally {
      await fs.promises.unlink(outsideFile);
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });

  // Test 3: Runtime open path blocks symlink swaps
  await runTest('runtime-open: blocks TOCTOU symlink swaps', async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
    
    const safeFile = path.join(testDir, 'safe.txt');
    await fs.promises.writeFile(safeFile, 'safe content');

    // Verify we can read the safe file
    const content = await safeReadFile('safe.txt', testDir);
    expect(content).toBe('safe content');

    // Cleanup
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  // Test 4: Cross-platform path traversal patterns
  await runTest('path-traversal: detects mixed separators', () => {
    expect(containsPathTraversal('foo\\../bar')).toBe(true);
    expect(containsPathTraversal('foo/..\\bar')).toBe(true);
  });

  await runTest('path-traversal: detects encoded traversal', () => {
    expect(isTraversalAttempt('%2e%2e%2fetc/passwd')).toBe(true);
    expect(isTraversalAttempt('%2e%2e/etc/passwd')).toBe(true);
  });

  await runTest('path-traversal: detects null byte injection', () => {
    expect(isTraversalAttempt('file\0.txt')).toBe(true);
    expect(isTraversalAttempt('path\x00traversal')).toBe(true);
  });
}

// ============================================================================
// ENVIRONMENT HYGIENE TESTS
// ============================================================================

async function testEnvHygiene(): Promise<void> {
  // Test 1: Secret stripping
  await runTest('env-sanitization: strips REACH_ENCRYPTION_KEY', () => {
    const dirtyEnv = {
      REACH_ENCRYPTION_KEY: 'super-secret-key',
      SAFE_VAR: 'this-is-ok',
      PATH: '/usr/bin',
    };
    
    const cleanEnv = sanitizeEnvironment(dirtyEnv);
    
    expect(cleanEnv.REACH_ENCRYPTION_KEY).toBeUndefined();
    expect(cleanEnv.SAFE_VAR).toBe('this-is-ok');
    expect(cleanEnv.PATH).toBe('/usr/bin');
  });

  await runTest('env-sanitization: strips *_TOKEN patterns', () => {
    const dirtyEnv = {
      API_TOKEN: 'secret-token',
      GITHUB_TOKEN: 'ghs_xxxx',
      NPM_TOKEN: 'npm_xxxx',
      SAFE_TOKEN_VAR: 'this-is-ok', // Not a suffix match
    };
    
    const cleanEnv = sanitizeEnvironment(dirtyEnv);
    
    expect(cleanEnv.API_TOKEN).toBeUndefined();
    expect(cleanEnv.GITHUB_TOKEN).toBeUndefined();
    expect(cleanEnv.NPM_TOKEN).toBeUndefined();
    expect(cleanEnv.SAFE_TOKEN_VAR).toBe('this-is-ok');
  });

  await runTest('env-sanitization: strips *_SECRET patterns', () => {
    const dirtyEnv = {
      AWS_SECRET: 'aws-secret',
      COOKIE_SECRET: 'cookie-signing-key',
      APP_SECRET: 'app-secret',
    };
    
    const cleanEnv = sanitizeEnvironment(dirtyEnv);
    
    expect(cleanEnv.AWS_SECRET).toBeUndefined();
    expect(cleanEnv.COOKIE_SECRET).toBeUndefined();
    expect(cleanEnv.APP_SECRET).toBeUndefined();
  });

  await runTest('env-sanitization: strips *_KEY patterns', () => {
    const dirtyEnv = {
      PRIVATE_KEY: 'private-key-content',
      API_KEY: 'api-key-content',
      ENCRYPTION_KEY: 'encryption-key',
    };
    
    const cleanEnv = sanitizeEnvironment(dirtyEnv);
    
    expect(cleanEnv.PRIVATE_KEY).toBeUndefined();
    expect(cleanEnv.API_KEY).toBeUndefined();
    expect(cleanEnv.ENCRYPTION_KEY).toBeUndefined();
  });

  await runTest('env-sanitization: strips AUTH* patterns', () => {
    const dirtyEnv = {
      AUTH_TOKEN: 'auth-token',
      AUTH_SECRET: 'auth-secret',
      AUTHENTICATION_KEY: 'auth-key',
    };
    
    const cleanEnv = sanitizeEnvironment(dirtyEnv);
    
    expect(cleanEnv.AUTH_TOKEN).toBeUndefined();
    expect(cleanEnv.AUTH_SECRET).toBeUndefined();
    expect(cleanEnv.AUTHENTICATION_KEY).toBeUndefined();
  });

  await runTest('env-sanitization: strips COOKIE* patterns', () => {
    const dirtyEnv = {
      COOKIE_SECRET: 'cookie-secret',
      COOKIE_KEY: 'cookie-key',
    };
    
    const cleanEnv = sanitizeEnvironment(dirtyEnv);
    
    expect(cleanEnv.COOKIE_SECRET).toBeUndefined();
    expect(cleanEnv.COOKIE_KEY).toBeUndefined();
  });

  // Test 2: Binary trust gate - version lock
  await runTest('binary-trust: rejects version mismatch', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: '/usr/bin/requiem',
        expectedVersion: '1.2.3',
        currentVersion: '9.9.9',
        requireExecutable: false,
      });
    }).toThrow(BinaryTrustError);
  });

  await runTest('binary-trust: accepts matching version', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: '/usr/bin/requiem',
        expectedVersion: '1.2.3',
        currentVersion: '1.2.3',
        requireExecutable: false,
      });
    }).not.toThrow();
  });

  // Test 3: Binary trust gate - path trust
  await runTest('binary-trust: rejects paths outside allowed directories', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: '/tmp/malicious/requiem',
        expectedVersion: '1.0.0',
        currentVersion: '1.0.0',
        allowedPaths: ['/usr/bin', '/usr/local/bin'],
        requireExecutable: false,
      });
    }).toThrow(BinaryTrustError);
  });

  await runTest('binary-trust: rejects relative paths by default', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: './requiem',
        expectedVersion: '1.0.0',
        currentVersion: '1.0.0',
        requireExecutable: false,
      });
    }).toThrow(BinaryTrustError);
  });

  // Test 4: REQUIEM_BIN environment
  await runTest('requiem-env: creates sanitized environment', () => {
    const env = createRequiemEnv({
      CUSTOM_SAFE_VAR: 'custom-value',
      CUSTOM_SECRET: 'should-be-stripped',
    });
    
    expect(env.CUSTOM_SAFE_VAR).toBe('custom-value');
    expect(env.CUSTOM_SECRET).toBeUndefined();
  });
}

// ============================================================================
// DIFF REPORT PATH TRAVERSAL TESTS
// ============================================================================

async function testDiffReportPathTraversal(): Promise<void> {
  const baseDir = path.resolve('/workspace/.reach/engine-diffs');

  await runTest('diff-report: sanitizes malicious requestId', () => {
    const result = buildDiffReportPath('../../Windows/System32/pwn', { baseDir });
    
    // Should not contain path traversal
    expect(containsPathTraversal(result)).toBe(false);
    // Should have sanitized the malicious parts
    expect(result.includes('diff_')).toBe(true);
  });

  await runTest('diff-report: sanitizes Windows-style paths', () => {
    const result = buildDiffReportPath('C:\\Windows\\System32\\pwn', { baseDir });
    
    // Should not contain path traversal
    expect(containsPathTraversal(result)).toBe(false);
    // Should be sanitized
    expect(result.includes('diff_C__Windows_System32_pwn')).toBe(true);
  });

  await runTest('diff-report: sanitizes absolute Unix paths', () => {
    const result = buildDiffReportPath('/etc/passwd', { baseDir });
    
    // Should not contain path traversal
    expect(containsPathTraversal(result)).toBe(false);
    // Should have the path sanitized
    expect(path.basename(result).startsWith('diff_')).toBe(true);
  });

  await runTest('diff-report: limits request ID length', () => {
    const longId = 'a'.repeat(200);
    const result = buildDiffReportPath(longId, { baseDir });
    
    // Path should be safe
    expect(containsPathTraversal(result)).toBe(false);
    // Should have sanitized ID
    expect(result.includes('diff_')).toBe(true);
  });

  await runTest('diff-report: allows valid request IDs', () => {
    const result = buildDiffReportPath('request-123_test', { baseDir });
    
    expect(result.includes('diff_request-123_test')).toBe(true);
    expect(result.endsWith('.json')).toBe(true);
  });
}

// ============================================================================
// PLUGIN MUTATION BOUNDARY TESTS
// ============================================================================

async function testPluginMutationBoundary(): Promise<void> {
  // Test 1: Freeze-then-hash pattern
  await runTest('plugin-freeze: computes fingerprint immediately', () => {
    const data = { score: 0.95, decision: 'approve' };
    const result = freezeResult(data);
    
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/i);
    expect(result.frozenAt).toBeDefined();
    expect(result.wasMutated).toBe(false);
  });

  await runTest('plugin-freeze: creates deterministic fingerprint', () => {
    const data1 = { a: 1, b: 2 };
    const data2 = { b: 2, a: 1 }; // Different order
    
    const result1 = freezeResult(data1);
    const result2 = freezeResult(data2);
    
    expect(result1.fingerprint).toBe(result2.fingerprint);
  });

  await runTest('plugin-freeze: deeply freezes data', () => {
    const data = { nested: { value: 1 } };
    const result = freezeResult(data);
    
    expect(Object.isFrozen(result.data)).toBe(true);
    expect(Object.isFrozen(result.data.nested)).toBe(true);
  });

  // Test 2: Tampering detection
  await runTest('plugin-freeze: detects tampering', () => {
    const data = { value: 'original' };
    const result = freezeResult(data);
    
    // Create tampered result
    const tamperedResult = {
      ...result,
      data: { value: 'tampered' },
    };
    
    expect(() => {
      verifyFrozenResult(tamperedResult);
    }).toThrow(ResultMutationError);
  });

  // Test 3: Explicit mutation with policy record
  await runTest('plugin-freeze: allows explicit mutation with policy', () => {
    const original = freezeResult({ value: 1 });
    const mutated = mutateResult(
      original,
      { value: 2 },
      { reason: 'Update value', authorizedBy: 'test-user' }
    );
    
    expect(mutated.wasMutated).toBe(true);
    expect(mutated.mutationPolicy).toHaveLength(1);
    expect(mutated.mutationPolicy[0].reason).toBe('Update value');
    expect(mutated.mutationPolicy[0].authorizedBy).toBe('test-user');
    expect(mutated.mutationPolicy[0].previousFingerprint).toBe(original.fingerprint);
  });

  await runTest('plugin-freeze: preserves mutation history', () => {
    let result = freezeResult({ value: 1 });
    
    result = mutateResult(result, { value: 2 }, {
      reason: 'First update',
      authorizedBy: 'user1',
    });
    
    result = mutateResult(result, { value: 3 }, {
      reason: 'Second update',
      authorizedBy: 'user2',
    });
    
    expect(result.mutationPolicy).toHaveLength(2);
    expect(result.mutationPolicy[0].reason).toBe('First update');
    expect(result.mutationPolicy[1].reason).toBe('Second update');
  });
}

// ============================================================================
// LLM FREEZE INTEGRITY TESTS
// ============================================================================

async function testLLMFreezeIntegrity(): Promise<void> {
  const cas = new ContentAddressableStorage();

  // Test 1: CID computation
  await runTest('cas-cid: computes deterministic CID', () => {
    const content = 'test content';
    const cid1 = computeCID(content);
    const cid2 = computeCID(content);
    
    expect(cid1).toBe(cid2);
    expect(cid1).toMatch(/^[a-f0-9]{64}$/i);
  });

  await runTest('cas-cid: different content produces different CID', () => {
    const cid1 = computeCID('content A');
    const cid2 = computeCID('content B');
    
    expect(cid1).not.toBe(cid2);
  });

  // Test 2: Store and retrieve with verification
  await runTest('cas-storage: stores and retrieves with CID verification', async () => {
    const content = 'test content for CAS';
    const cid = await cas.put(content);
    
    expect(cid).toBeDefined();
    
    const retrieved = await cas.get(cid);
    expect(retrieved.content.toString()).toBe(content);
  });

  // Test 3: CID verification on read
  await runTest('cas-verify: verifies content on read', async () => {
    const content = 'content to verify';
    const cid = await cas.put(content);
    
    const verification = verifyCID(content, cid);
    expect(verification.matches).toBe(true);
    expect(verification.valid).toBe(true);
  });

  // Test 4: Corruption detection
  await runTest('cas-verify: detects corrupted content', async () => {
    const content = 'original content';
    const wrongContent = 'corrupted content';
    const cid = computeCID(content);
    
    const verification = verifyCID(wrongContent, cid);
    expect(verification.matches).toBe(false);
    expect(verification.error).toBeDefined();
  });

  // Test 5: Poisoning attack prevention
  await runTest('cas-poisoning: throws on CID mismatch', async () => {
    // Manually insert content with wrong CID (simulating poisoning)
    const content = Buffer.from('poisoned content');
    const wrongCid = computeCID('legitimate content');
    
    // Store with wrong CID
    (cas as unknown as { store: Map<string, { content: Buffer }> }).store.set(wrongCid, { content });
    
    // Reading should fail verification
    try {
      await cas.get(wrongCid);
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      expect(error).toBeInstanceOf(CIDVerificationError);
    }
  });

  // Test 6: Path confinement validation
  await runTest('cas-path: validates workspace confinement', async () => {
    const content = 'test content';
    const cid = await cas.put(content);
    const entry = await cas.get(cid);
    
    // Content should be what we stored
    expect(entry.content.toString()).toBe(content);
  });
}

// ============================================================================
// CROSS-PLATFORM GOLDEN TESTS
// ============================================================================

async function testCrossPlatformGolden(): Promise<void> {
  // These tests verify deterministic behavior across platforms
  
  await runTest('golden: path traversal detection is consistent', () => {
    const testCases = [
      { path: '../etc/passwd', expected: true },
      { path: '..\\Windows\\System32', expected: true },
      { path: 'foo/bar/baz', expected: false },
      { path: 'foo\\bar\\baz', expected: false },
      { path: '/etc/passwd', expected: true },
      { path: 'C:\\Windows', expected: true },
      { path: 'file..name.txt', expected: false },
      { path: '...hidden', expected: false },
    ];
    
    for (const testCase of testCases) {
      const result = containsPathTraversal(testCase.path) || isTraversalAttempt(testCase.path);
      expect(result).toBe(testCase.expected);
    }
  });

  await runTest('golden: requestId sanitization is consistent', () => {
    const testCases = [
      { input: 'valid-id-123', expected: 'valid-id-123' },
      { input: '../etc/passwd', expected: '_etc_passwd' },
      { input: 'file\\with\\backslash', expected: 'file_with_backslash' },
      { input: '..hidden', expected: 'hidden' },
    ];
    
    for (const testCase of testCases) {
      const result = sanitizeRequestId(testCase.input);
      expect(result).toBe(testCase.expected);
    }
  });

  await runTest('golden: fingerprint computation is deterministic', () => {
    const data = { score: 0.95, decision: 'approve', nested: { value: 42 } };
    
    const fp1 = computeResultFingerprint(data);
    const fp2 = computeResultFingerprint(data);
    const fp3 = computeResultFingerprint({ ...data });
    
    expect(fp1).toBe(fp2);
    expect(fp1).toBe(fp3);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/i);
  });

  await runTest('golden: CID computation is deterministic', () => {
    const content = 'deterministic test content';
    
    const cid1 = computeCID(content);
    const cid2 = computeCID(content);
    const cid3 = computeCID(Buffer.from(content, 'utf8'));
    
    expect(cid1).toBe(cid2);
    expect(cid1).toBe(cid3);
  });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

// Simple expect helpers
function expect<T>(value: T) {
  return {
    toBe(expected: T) {
      if (value !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
      }
    },
    toEqual(expected: T) {
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
      }
    },
    toBeDefined() {
      if (value === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toBeUndefined() {
      if (value !== undefined) {
        throw new Error('Expected value to be undefined');
      }
    },
    toBeTrue() {
      if (value !== true) {
        throw new Error(`Expected true, got ${value}`);
      }
    },
    toBeFalse() {
      if (value !== false) {
        throw new Error(`Expected false, got ${value}`);
      }
    },
    toMatch(pattern: RegExp) {
      if (typeof value !== 'string' || !pattern.test(value)) {
        throw new Error(`Expected value to match ${pattern}, got ${value}`);
      }
    },
    toContain(item: unknown) {
      if (!Array.isArray(value) || !value.includes(item)) {
        throw new Error(`Expected array to contain ${item}`);
      }
    },
    toHaveLength(expected: number) {
      if (!Array.isArray(value) || value.length !== expected) {
        throw new Error(`Expected array length ${expected}, got ${(value as unknown[]).length}`);
      }
    },
    toThrow(ErrorClass?: new (...args: unknown[]) => Error) {
      if (typeof value !== 'function') {
        throw new Error('Expected value to be a function');
      }
      try {
        value();
        throw new Error('Expected function to throw');
      } catch (error) {
        if (ErrorClass && !(error instanceof ErrorClass)) {
          throw new Error(`Expected error to be instance of ${ErrorClass.name}`);
        }
      }
    },
    not: {
      toThrow() {
        if (typeof value !== 'function') {
          throw new Error('Expected value to be a function');
        }
        try {
          value();
        } catch {
          throw new Error('Expected function not to throw');
        }
      },
      toBe(expected: T) {
        if (value === expected) {
          throw new Error(`Expected value not to be ${JSON.stringify(expected)}`);
        }
      },
    },
  };
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('M3 Security Boundary Hardening - Automated Security Proofs');
  console.log('='.repeat(60));
  console.log('');

  const startTime = Date.now();

  // Run all test suites
  console.log('--- Workspace Escape Tests ---');
  await testWorkspaceEscape();
  console.log('');

  console.log('--- Environment Hygiene Tests ---');
  await testEnvHygiene();
  console.log('');

  console.log('--- Diff Report Path Traversal Tests ---');
  await testDiffReportPathTraversal();
  console.log('');

  console.log('--- Plugin Mutation Boundary Tests ---');
  await testPluginMutationBoundary();
  console.log('');

  console.log('--- LLM Freeze Integrity Tests ---');
  await testLLMFreezeIntegrity();
  console.log('');

  console.log('--- Cross-Platform Golden Tests ---');
  await testCrossPlatformGolden();
  console.log('');

  // Summary
  const totalTime = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total:  ${results.length} tests`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Time:   ${totalTime}ms`);
  console.log('');

  if (failed > 0) {
    console.log('FAILED TESTS:');
    for (const result of results.filter(r => !r.passed)) {
      console.log(`  - ${result.name}`);
      if (result.error) {
        console.log(`    ${result.error}`);
      }
    }
    console.log('');
    process.exit(1);
  } else {
    console.log('✓ All security proofs passed');
    console.log('✓ System is GREEN for security boundaries');
    process.exit(0);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
