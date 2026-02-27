/**
 * Requiem Engine Adapter Security Tests
 * 
 * Tests for security hardening measures:
 * - Binary trust verification
 * - Environment sanitization (secret filtering)
 * - Resource limit enforcement
 * - Path traversal protection
 * 
 * @module engine/adapters/requiem.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  RequiemEngineAdapter,
  getRequiemEngine,
  initRequiemEngine,
  __security__,
} from './requiem';
import type { ExecRequest } from '../contract';

describe('RequiemEngineAdapter Security', () => {
  const testDir = path.join(os.tmpdir(), 'reach-requiem-test-' + Date.now());

  beforeEach(() => {
    // Clean environment
    delete process.env.REACH_ENCRYPTION_KEY;
    delete process.env.TEST_TOKEN;
    delete process.env.API_SECRET;
  });

  afterEach(() => {
    // Cleanup
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Environment Sanitization', () => {
    it('filters secrets from child environment', () => {
      // Set secret environment variables
      process.env.REACH_ENCRYPTION_KEY = 'super-secret-key-12345';
      process.env.TEST_TOKEN = 'bearer-token-abc';
      process.env.API_SECRET = 'api-secret-value';
      process.env.NORMAL_VAR = 'normal-value';

      const adapter = new RequiemEngineAdapter();
      
      // Access private method via type assertion for testing
      const sanitized = (adapter as any).buildSanitizedEnv();

      // Secrets should be filtered
      expect(sanitized.REACH_ENCRYPTION_KEY).toBeUndefined();
      expect(sanitized.TEST_TOKEN).toBeUndefined();
      expect(sanitized.API_SECRET).toBeUndefined();

      // Normal variables should pass through
      expect(sanitized.NORMAL_VAR).toBe('normal-value');
      
      // Safe allowlist should be present
      expect(sanitized.PATH).toBeDefined();
    });

    it('always includes safe environment variables', () => {
      process.env.PATH = '/usr/bin:/bin';
      process.env.HOME = '/home/user';
      
      const adapter = new RequiemEngineAdapter();
      const sanitized = (adapter as any).buildSanitizedEnv();

      expect(sanitized.PATH).toBe('/usr/bin:/bin');
      expect(sanitized.HOME).toBe('/home/user');
      expect(sanitized.PYTHONHASHSEED).toBe('0');
      expect(sanitized.REACH_SANDBOX_MODE).toBe('1');
    });

    it('identifies secret patterns correctly', () => {
      const secretPatterns = __security__.SECRET_ENV_PATTERNS;
      
      // Should match secrets
      expect(secretPatterns.some(p => p.test('REACH_ENCRYPTION_KEY'))).toBe(true);
      expect(secretPatterns.some(p => p.test('API_TOKEN'))).toBe(true);
      expect(secretPatterns.some(p => p.test('MY_SECRET'))).toBe(true);
      expect(secretPatterns.some(p => p.test('AUTH_HEADER'))).toBe(true);
      expect(secretPatterns.some(p => p.test('COOKIE_SESSION'))).toBe(true);
      
      // Should not match normal vars
      expect(secretPatterns.some(p => p.test('PATH'))).toBe(false);
      expect(secretPatterns.some(p => p.test('HOME'))).toBe(false);
      expect(secretPatterns.some(p => p.test('NODE_ENV'))).toBe(false);
    });
  });

  describe('Resource Limits', () => {
    it('rejects requests exceeding matrix size limit', async () => {
      const adapter = new RequiemEngineAdapter({
        maxMatrixCells: 100, // Small limit for testing
      });

      const hugeRequest: ExecRequest = {
        requestId: 'test-1',
        timestamp: new Date().toISOString(),
        params: {
          algorithm: 'minimax_regret',
          actions: Array(20).fill('action'), // 20 actions
          states: Array(20).fill('state'),   // 20 states = 400 cells (should pass)
          outcomes: {},
        },
      };

      // This should pass (400 < 100? No, this is 400 > 100)
      // Actually let me fix the test
      const requestThatPasses: ExecRequest = {
        requestId: 'test-1',
        timestamp: new Date().toISOString(),
        params: {
          algorithm: 'minimax_regret',
          actions: Array(5).fill('action'), // 5 actions
          states: Array(5).fill('state'),   // 5 states = 25 cells (should pass)
          outcomes: {},
        },
      };

      const limitCheck = (adapter as any).validateRequestLimits(requestThatPasses);
      expect(limitCheck.valid).toBe(true);

      // This should fail (100 cells > 100 limit? No, equals, should pass)
      // Let's make one that definitely fails
      const requestThatFails: ExecRequest = {
        requestId: 'test-2',
        timestamp: new Date().toISOString(),
        params: {
          algorithm: 'minimax_regret',
          actions: Array(15).fill('action'), // 15 actions
          states: Array(15).fill('state'),   // 15 states = 225 cells (should fail)
          outcomes: {},
        },
      };

      const limitCheckFail = (adapter as any).validateRequestLimits(requestThatFails);
      expect(limitCheckFail.valid).toBe(false);
      expect(limitCheckFail.error).toContain('matrix_too_large');
    });

    it('rejects requests exceeding size limit', async () => {
      const adapter = new RequiemEngineAdapter({
        maxRequestBytes: 100, // Very small limit
      });

      const largeRequest: ExecRequest = {
        requestId: 'test-3',
        timestamp: new Date().toISOString(),
        params: {
          algorithm: 'minimax_regret',
          actions: Array(100).fill('very-long-action-name-that-makes-json-big'),
          states: Array(10).fill('state'),
          outcomes: {},
        },
      };

      const limitCheck = (adapter as any).validateRequestLimits(largeRequest);
      expect(limitCheck.valid).toBe(false);
      expect(limitCheck.error).toContain('request_too_large');
    });
  });

  describe('Request ID Sanitization', () => {
    it('sanitizes malicious request IDs', () => {
      const adapter = new RequiemEngineAdapter();
      
      // sanitizeRequestId replaces invalid chars with underscore
      expect((adapter as any).sanitizeRequestId('../etc/passwd')).toBe('.._etc_passwd');
      expect((adapter as any).sanitizeRequestId('..\\Windows\\System32')).toBe('.._Windows_System32');
      expect((adapter as any).sanitizeRequestId('/etc/passwd')).toBe('_etc_passwd');
      // Colons are also sanitized (invalid in Windows filenames, replaced with underscore)
      expect((adapter as any).sanitizeRequestId('C:\\Windows\\System32')).toBe('C__Windows_System32');
    });

    it('allows valid request IDs', () => {
      const adapter = new RequiemEngineAdapter();
      
      expect((adapter as any).sanitizeRequestId('valid-request-123')).toBe('valid-request-123');
      expect((adapter as any).sanitizeRequestId('request_123.test')).toBe('request_123.test');
    });

    it('limits request ID length', () => {
      const adapter = new RequiemEngineAdapter();
      const longId = 'a'.repeat(100);
      
      expect((adapter as any).sanitizeRequestId(longId).length).toBe(64);
    });
  });

  describe('Input Validation', () => {
    it('detects path traversal in requestId', () => {
      const adapter = new RequiemEngineAdapter();
      
      const maliciousRequest: ExecRequest = {
        requestId: '../../Windows/System32/pwn',
        timestamp: new Date().toISOString(),
        params: {
          algorithm: 'minimax_regret',
          actions: ['a1'],
          states: ['s1'],
          outcomes: {},
        },
      };

      const validation = adapter.validateInput(maliciousRequest);
      expect(validation.valid).toBe(false);
      // The validation should detect the path traversal attempt
      expect(validation.errors?.some(e => e.includes('invalid') || e.includes('path') || e.includes('traversal'))).toBe(true);
    });

    it('accepts valid requests', () => {
      const adapter = new RequiemEngineAdapter();
      
      const validRequest: ExecRequest = {
        requestId: 'valid-request-123',
        timestamp: new Date().toISOString(),
        params: {
          algorithm: 'minimax_regret',
          actions: ['a1', 'a2'],
          states: ['s1', 's2'],
          outcomes: { a1: { s1: 1, s2: 2 } },
        },
      };

      const validation = adapter.validateInput(validRequest);
      expect(validation.valid).toBe(true);
    });

    it('rejects floating point values in outcomes', () => {
      const adapter = new RequiemEngineAdapter();
      
      const floatRequest: ExecRequest = {
        requestId: 'float-test-1',
        timestamp: new Date().toISOString(),
        params: {
          algorithm: 'minimax_regret',
          actions: ['a1'],
          states: ['s1'],
          outcomes: { a1: { s1: 1.5 } },
        },
      };

      const validation = adapter.validateInput(floatRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors?.some(e => e.includes('floating_point_values_detected'))).toBe(true);
    });
  });

  describe('Binary Trust Verification', () => {
    it('validates binary path is executable', () => {
      const adapter = new RequiemEngineAdapter();
      
      // Test with a non-executable path
      const result = (adapter as any).isExecutable('/nonexistent/path');
      expect(result).toBe(false);
    });

    it('checks version matches expected', () => {
      const adapter = new RequiemEngineAdapter({
        expectedVersion: '1.0',
      });
      
      expect((adapter as any).versionMatches('1.0.0', '1.0')).toBe(true);
      expect((adapter as any).versionMatches('1.0.5', '1.0')).toBe(true);
      expect((adapter as any).versionMatches('2.0.0', '1.0')).toBe(false);
    });
  });
});

describe('RequiemEngineAdapter Integration', () => {
  it('exports security utilities', () => {
    expect(__security__).toBeDefined();
    expect(__security__.SECRET_ENV_PATTERNS).toBeInstanceOf(Array);
    expect(__security__.SAFE_ENV_ALLOWLIST).toBeInstanceOf(Array);
  });

  it('singleton instance works correctly', () => {
    const instance1 = getRequiemEngine();
    const instance2 = getRequiemEngine();
    
    expect(instance1).toBe(instance2);
  });
});
