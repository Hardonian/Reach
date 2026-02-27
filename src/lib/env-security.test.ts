/**
 * Environment Security Tests
 * 
 * Tests for environment sanitization and binary trust validation.
 * 
 * @module lib/env-security.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  sanitizeEnvironment,
  isSensitiveEnvVar,
  validateBinaryTrust,
  computeBinaryHash,
  verifyBinaryHash,
  createRequiemEnv,
  BinaryTrustError,
  SENSITIVE_ENV_VARS,
  SECRET_ENV_PATTERNS,
} from './env-security';

describe('sanitizeEnvironment', () => {
  it('strips known sensitive variables', () => {
    const dirtyEnv = {
      REACH_ENCRYPTION_KEY: 'super-secret-key',
      API_TOKEN: 'token-abc-123',
      GITHUB_SECRET: 'ghs_xxxxxxxx',
      AUTH_PASSWORD: 'hunter2',
      COOKIE_SECRET: 'cookie-signing-key',
      SAFE_VAR: 'this-is-ok',
      PATH: '/usr/bin',
      NODE_ENV: 'test',
    };
    
    const cleanEnv = sanitizeEnvironment(dirtyEnv);
    
    // Secrets should be stripped
    expect(cleanEnv.REACH_ENCRYPTION_KEY).toBeUndefined();
    expect(cleanEnv.API_TOKEN).toBeUndefined();
    expect(cleanEnv.GITHUB_SECRET).toBeUndefined();
    expect(cleanEnv.AUTH_PASSWORD).toBeUndefined();
    expect(cleanEnv.COOKIE_SECRET).toBeUndefined();
    
    // Safe vars should remain
    expect(cleanEnv.SAFE_VAR).toBe('this-is-ok');
    expect(cleanEnv.PATH).toBe('/usr/bin');
    expect(cleanEnv.NODE_ENV).toBe('test');
  });
  
  it('handles empty environment', () => {
    const cleanEnv = sanitizeEnvironment({});
    expect(Object.keys(cleanEnv)).toHaveLength(0);
  });
  
  it('handles undefined values', () => {
    const env = {
      DEFINED: 'value',
      UNDEFINED: undefined,
    };
    const cleanEnv = sanitizeEnvironment(env as unknown as Record<string, string>);
    expect(cleanEnv.DEFINED).toBe('value');
    expect(cleanEnv.UNDEFINED).toBeUndefined();
  });
  
  it('preserves system variables', () => {
    const env = {
      PATH: '/usr/bin:/bin',
      HOME: '/home/user',
      USER: 'testuser',
      SHELL: '/bin/bash',
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      NODE_ENV: 'production',
      REACH_CLI_VERSION: '1.0.0',
    };
    
    const cleanEnv = sanitizeEnvironment(env);
    
    expect(cleanEnv.PATH).toBe('/usr/bin:/bin');
    expect(cleanEnv.HOME).toBe('/home/user');
    expect(cleanEnv.USER).toBe('testuser');
    expect(cleanEnv.SHELL).toBe('/bin/bash');
    expect(cleanEnv.TERM).toBe('xterm-256color');
    expect(cleanEnv.LANG).toBe('en_US.UTF-8');
    expect(cleanEnv.LC_ALL).toBe('en_US.UTF-8');
    expect(cleanEnv.NODE_ENV).toBe('production');
    expect(cleanEnv.REACH_CLI_VERSION).toBe('1.0.0');
  });
});

describe('isSensitiveEnvVar', () => {
  it('detects _SECRET suffix', () => {
    expect(isSensitiveEnvVar('MY_SECRET')).toBe(true);
    expect(isSensitiveEnvVar('APP_SECRET')).toBe(true);
    expect(isSensitiveEnvVar('SECRETS')).toBe(false); // Not at end
  });
  
  it('detects _TOKEN suffix', () => {
    expect(isSensitiveEnvVar('API_TOKEN')).toBe(true);
    expect(isSensitiveEnvVar('GITHUB_TOKEN')).toBe(true);
    expect(isSensitiveEnvVar('TOKENIZED')).toBe(false);
  });
  
  it('detects _KEY suffix', () => {
    expect(isSensitiveEnvVar('API_KEY')).toBe(true);
    expect(isSensitiveEnvVar('PRIVATE_KEY')).toBe(true);
    expect(isSensitiveEnvVar('KEYBOARD')).toBe(false);
  });
  
  it('detects _PASSWORD suffix', () => {
    expect(isSensitiveEnvVar('DB_PASSWORD')).toBe(true);
    expect(isSensitiveEnvVar('USER_PASSWD')).toBe(true);
    expect(isSensitiveEnvVar('PASSAGE')).toBe(false);
  });
  
  it('detects known sensitive vars', () => {
    expect(isSensitiveEnvVar('REACH_ENCRYPTION_KEY')).toBe(true);
    expect(isSensitiveEnvVar('AWS_SECRET_ACCESS_KEY')).toBe(true);
    expect(isSensitiveEnvVar('PRIVATE_KEY')).toBe(true);
  });
  
  it('allows safe variables', () => {
    expect(isSensitiveEnvVar('PATH')).toBe(false);
    expect(isSensitiveEnvVar('HOME')).toBe(false);
    expect(isSensitiveEnvVar('NODE_ENV')).toBe(false);
    expect(isSensitiveEnvVar('REACH_VERSION')).toBe(false);
    expect(isSensitiveEnvVar('PUBLIC_KEY')).toBe(false);
  });
  
  it('is case-insensitive for patterns', () => {
    expect(isSensitiveEnvVar('api_secret')).toBe(true);
    expect(isSensitiveEnvVar('API_SECRET')).toBe(true);
    expect(isSensitiveEnvVar('Api_Secret')).toBe(true);
  });
});

describe('validateBinaryTrust', () => {
  const testDir = path.join(os.tmpdir(), `reach-binary-test-${Date.now()}`);
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  it('accepts matching versions', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: '/usr/bin/requiem',
        expectedVersion: '1.2.3',
        currentVersion: '1.2.3',
        requireExecutable: false, // Don't require actual file to exist
      });
    }).not.toThrow();
  });
  
  it('rejects version mismatch', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: '/usr/bin/requiem',
        expectedVersion: '1.2.3',
        currentVersion: '9.9.9',
      });
    }).toThrow(BinaryTrustError);
  });
  
  it('rejects relative paths by default', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: './requiem',
        expectedVersion: '1.0.0',
        currentVersion: '1.0.0',
      });
    }).toThrow(BinaryTrustError);
  });
  
  it('allows relative paths when configured', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: './requiem',
        expectedVersion: '1.0.0',
        currentVersion: '1.0.0',
        allowRelative: true,
        requireExecutable: false,
      });
    }).not.toThrow();
  });
  
  it('rejects paths outside allowed directories', () => {
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
  
  it('accepts paths within allowed directories', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: '/usr/bin/requiem',
        expectedVersion: '1.0.0',
        currentVersion: '1.0.0',
        allowedPaths: ['/usr/bin', '/usr/local/bin'],
        requireExecutable: false,
      });
    }).not.toThrow();
  });
  
  it('rejects non-existent binaries when requiring executable', () => {
    expect(() => {
      validateBinaryTrust({
        binaryPath: '/nonexistent/binary',
        expectedVersion: '1.0.0',
        currentVersion: '1.0.0',
        requireExecutable: true,
      });
    }).toThrow(BinaryTrustError);
  });
  
  it('validates actual binary file', () => {
    const binaryPath = path.join(testDir, 'test-binary');
    fs.writeFileSync(binaryPath, '#!/bin/bash\necho "test"', 'utf8');
    fs.chmodSync(binaryPath, 0o755);
    
    expect(() => {
      validateBinaryTrust({
        binaryPath,
        expectedVersion: '1.0.0',
        currentVersion: '1.0.0',
        allowedPaths: [testDir],
        requireExecutable: true,
      });
    }).not.toThrow();
  });
  
  it('rejects non-executable binary', () => {
    // Skip on Windows where permissions work differently
    if (process.platform === 'win32') {
      console.log('Skipping non-executable test on Windows');
      return;
    }
    
    const binaryPath = path.join(testDir, 'non-executable');
    fs.writeFileSync(binaryPath, 'not executable', 'utf8');
    // Explicitly remove execute permission
    fs.chmodSync(binaryPath, 0o644);
    
    expect(() => {
      validateBinaryTrust({
        binaryPath,
        expectedVersion: '1.0.0',
        currentVersion: '1.0.0',
        allowedPaths: [testDir],
        requireExecutable: true,
      });
    }).toThrow(BinaryTrustError);
  });
});

describe('computeBinaryHash / verifyBinaryHash', () => {
  const testDir = path.join(os.tmpdir(), `reach-hash-test-${Date.now()}`);
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  it('computes consistent hash', () => {
    const binaryPath = path.join(testDir, 'test-file');
    fs.writeFileSync(binaryPath, 'test content', 'utf8');
    
    const hash1 = computeBinaryHash(binaryPath);
    const hash2 = computeBinaryHash(binaryPath);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/i);
  });
  
  it('computes different hashes for different content', () => {
    const binaryPath1 = path.join(testDir, 'file1');
    const binaryPath2 = path.join(testDir, 'file2');
    fs.writeFileSync(binaryPath1, 'content A', 'utf8');
    fs.writeFileSync(binaryPath2, 'content B', 'utf8');
    
    const hash1 = computeBinaryHash(binaryPath1);
    const hash2 = computeBinaryHash(binaryPath2);
    
    expect(hash1).not.toBe(hash2);
  });
  
  it('verifies matching hash', () => {
    const binaryPath = path.join(testDir, 'test-file');
    fs.writeFileSync(binaryPath, 'test content', 'utf8');
    
    const hash = computeBinaryHash(binaryPath);
    
    expect(() => {
      verifyBinaryHash(binaryPath, hash);
    }).not.toThrow();
  });
  
  it('rejects mismatched hash', () => {
    const binaryPath = path.join(testDir, 'test-file');
    fs.writeFileSync(binaryPath, 'test content', 'utf8');
    
    expect(() => {
      verifyBinaryHash(binaryPath, '0000000000000000000000000000000000000000000000000000000000000000');
    }).toThrow(BinaryTrustError);
  });
});

describe('createRequiemEnv', () => {
  it('creates sanitized environment', () => {
    process.env.TEST_SECRET_TOKEN = 'should-be-stripped';
    process.env.TEST_SAFE_VAR = 'should-be-kept';
    
    const env = createRequiemEnv();
    
    expect(env.TEST_SECRET_TOKEN).toBeUndefined();
    expect(env.TEST_SAFE_VAR).toBe('should-be-kept');
    
    // Cleanup
    delete process.env.TEST_SECRET_TOKEN;
    delete process.env.TEST_SAFE_VAR;
  });
  
  it('includes additional safe variables', () => {
    const env = createRequiemEnv({
      CUSTOM_VAR: 'custom-value',
      ANOTHER_SECRET: 'should-be-stripped',  // Should still be stripped
    });
    
    expect(env.CUSTOM_VAR).toBe('custom-value');
    expect(env.ANOTHER_SECRET).toBeUndefined();
  });
});
