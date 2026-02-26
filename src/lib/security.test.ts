/**
 * Security Utilities Tests
 * 
 * Tests for path traversal protection, symlink race detection,
 * and other security hardening measures.
 * 
 * @module lib/security.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  sanitizeRequestId,
  containsPathTraversal,
  resolveSafePath,
  resolveSafePathSync,
  buildDiffReportPath,
  safeReadFile,
  safeWriteFile,
  isSymlink,
  isSymlinkSync,
  SecurityError,
  SecurityErrorCode,
} from './security';

describe('sanitizeRequestId', () => {
  it('allows valid request IDs', () => {
    expect(sanitizeRequestId('abc123')).toBe('abc123');
    expect(sanitizeRequestId('request-123')).toBe('request-123');
    expect(sanitizeRequestId('request_123')).toBe('request_123');
    expect(sanitizeRequestId('request.123')).toBe('request.123');
    expect(sanitizeRequestId('mixed-Case_123.test')).toBe('mixed-Case_123.test');
  });

  it('replaces invalid characters with underscore', () => {
    expect(sanitizeRequestId('request/123')).toBe('request_123');
    expect(sanitizeRequestId('request\\123')).toBe('request_123');
    expect(sanitizeRequestId('request:123')).toBe('request_123');
    expect(sanitizeRequestId('request@123')).toBe('request_123');
    expect(sanitizeRequestId('request..123')).toBe('request..123'); // Dots are allowed
  });

  it('prevents path traversal characters', () => {
    expect(sanitizeRequestId('../etc/passwd')).toBe('.._etc_passwd');
    expect(sanitizeRequestId('..\\Windows\\System32')).toBe('.._Windows_System32');
    expect(sanitizeRequestId('/etc/passwd')).toBe('_etc_passwd');
  });

  it('limits length to 64 characters', () => {
    const longId = 'a'.repeat(100);
    expect(sanitizeRequestId(longId).length).toBe(64);
  });

  it('handles empty string', () => {
    expect(sanitizeRequestId('')).toBe('invalid_request_id');
  });

  it('removes leading dots and dashes', () => {
    expect(sanitizeRequestId('.hidden')).toBe('hidden');
    expect(sanitizeRequestId('-test')).toBe('test');
    expect(sanitizeRequestId('..test')).toBe('test');
  });
});

describe('containsPathTraversal', () => {
  it('detects Unix traversal patterns', () => {
    expect(containsPathTraversal('../etc/passwd')).toBe(true);
    expect(containsPathTraversal('foo/../../etc/passwd')).toBe(true);
    expect(containsPathTraversal('/foo/../bar')).toBe(true);
  });

  it('detects Windows traversal patterns', () => {
    expect(containsPathTraversal('..\\Windows\\System32')).toBe(true);
    expect(containsPathTraversal('foo\\..\\..\\bar')).toBe(true);
  });

  it('returns false for safe paths', () => {
    expect(containsPathTraversal('foo/bar/baz')).toBe(false);
    expect(containsPathTraversal('foo\\bar\\baz')).toBe(false);
    expect(containsPathTraversal('foo..bar')).toBe(false);
    expect(containsPathTraversal('foo...bar')).toBe(false);
    expect(containsPathTraversal('request-123_test.json')).toBe(false);
  });
});

describe('resolveSafePathSync', () => {
  const testBaseDir = path.join(os.tmpdir(), 'reach-security-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testBaseDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('resolves paths within base directory', () => {
    const result = resolveSafePathSync('foo/bar.txt', { baseDir: testBaseDir });
    expect(result.startsWith(testBaseDir)).toBe(true);
    expect(result.endsWith('foo/bar.txt')).toBe(true);
  });

  it('rejects path traversal attempts', () => {
    expect(() => {
      resolveSafePathSync('../outside.txt', { baseDir: testBaseDir });
    }).toThrow(SecurityError);

    expect(() => {
      resolveSafePathSync('foo/../../outside.txt', { baseDir: testBaseDir });
    }).toThrow(SecurityError);
  });

  it('rejects Windows path traversal', () => {
    expect(() => {
      resolveSafePathSync('..\\outside.txt', { baseDir: testBaseDir });
    }).toThrow(SecurityError);
  });

  it('rejects absolute paths by default', () => {
    expect(() => {
      resolveSafePathSync('/etc/passwd', { baseDir: testBaseDir });
    }).toThrow(SecurityError);
  });

  it('allows absolute paths when allowOutside is true', () => {
    // Even with allowOutside, path should still be validated
    const result = resolveSafePathSync('/etc/passwd', { 
      baseDir: testBaseDir, 
      allowOutside: true 
    });
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('rejects paths exceeding max length', () => {
    const longPath = 'a'.repeat(5000);
    expect(() => {
      resolveSafePathSync(longPath, { baseDir: testBaseDir, maxLength: 100 });
    }).toThrow(SecurityError);
  });

  it('detects symlink attacks', () => {
    // Check if we can create symlinks (Windows requires special permissions)
    let canCreateSymlinks = true;
    try {
      const testLink = path.join(testBaseDir, 'test-link-check');
      const testFile = path.join(testBaseDir, 'test-file-check');
      fs.writeFileSync(testFile, 'test');
      fs.symlinkSync(testFile, testLink);
      fs.unlinkSync(testLink);
      fs.unlinkSync(testFile);
    } catch {
      canCreateSymlinks = false;
    }
    
    if (!canCreateSymlinks) {
      console.log('Skipping symlink attack test - cannot create symlinks on this system');
      return;
    }
    
    // Create a file outside the workspace
    const outsideFile = path.join(os.tmpdir(), 'reach-test-outside-' + Date.now() + '.txt');
    fs.writeFileSync(outsideFile, 'sensitive data');

    // Create a symlink inside workspace pointing outside
    const symlinkPath = path.join(testBaseDir, 'malicious_link');
    fs.symlinkSync(outsideFile, symlinkPath);

    try {
      // Attempting to resolve the symlink should detect the escape
      expect(() => {
        resolveSafePathSync('malicious_link', { baseDir: testBaseDir, followSymlinks: true });
      }).toThrow(SecurityError);
    } finally {
      fs.unlinkSync(outsideFile);
      // symlink is cleaned up with testBaseDir
    }
  });
});

describe('resolveSafePath', () => {
  const testBaseDir = path.join(os.tmpdir(), 'reach-security-test-async-' + Date.now());

  beforeEach(async () => {
    await fs.promises.mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testBaseDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('resolves paths within base directory', async () => {
    const result = await resolveSafePath('foo/bar.txt', { baseDir: testBaseDir });
    expect(result.startsWith(testBaseDir)).toBe(true);
  });

  it('rejects path traversal attempts', async () => {
    await expect(
      resolveSafePath('../outside.txt', { baseDir: testBaseDir })
    ).rejects.toThrow(SecurityError);
  });
});

describe('buildDiffReportPath', () => {
  const baseDir = '/workspace/.reach/engine-diffs';

  it('builds safe diff report paths', () => {
    const result = buildDiffReportPath('request-123', { baseDir });
    expect(result.startsWith(baseDir)).toBe(true);
    expect(result.includes('request-123')).toBe(true);
    expect(result.endsWith('.json')).toBe(true);
  });

  it('sanitizes malicious request IDs', () => {
    const result = buildDiffReportPath('../../Windows/System32/pwn', { baseDir });
    expect(result.startsWith(baseDir)).toBe(true);
    expect(containsPathTraversal(result)).toBe(false);
    // The malicious path should be sanitized, not escaped
    expect(result.includes('..')).toBe(false);
  });

  it('handles Windows-style paths', () => {
    const result = buildDiffReportPath('C:\\Windows\\System32\\pwn', { baseDir });
    expect(result.startsWith(baseDir)).toBe(true);
    expect(containsPathTraversal(result)).toBe(false);
  });

  it('limits request ID length', () => {
    const longId = 'a'.repeat(200);
    const result = buildDiffReportPath(longId, { baseDir });
    // Path should still be within base dir and safe
    expect(result.startsWith(baseDir)).toBe(true);
    expect(containsPathTraversal(result)).toBe(false);
  });
});

describe('safeReadFile / safeWriteFile', () => {
  const testWorkspace = path.join(os.tmpdir(), 'reach-safe-io-test-' + Date.now());

  beforeEach(async () => {
    await fs.promises.mkdir(testWorkspace, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testWorkspace, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('writes and reads files safely', async () => {
    const content = 'Hello, secure world!';
    await safeWriteFile('test.txt', content, testWorkspace);
    
    const read = await safeReadFile('test.txt', testWorkspace);
    expect(read).toBe(content);
  });

  it('rejects reading files outside workspace', async () => {
    await expect(
      safeReadFile('../outside.txt', testWorkspace)
    ).rejects.toThrow(SecurityError);
  });

  it('rejects writing files outside workspace', async () => {
    await expect(
      safeWriteFile('../outside.txt', 'data', testWorkspace)
    ).rejects.toThrow(SecurityError);
  });

  it('detects symlink races when reading', async () => {
    // Check if we can create symlinks (Windows requires special permissions)
    let canCreateSymlinks = true;
    try {
      const testLink = path.join(testWorkspace, 'test-link-check');
      const testFile = path.join(testWorkspace, 'test-file-check');
      await fs.promises.writeFile(testFile, 'test');
      await fs.promises.symlink(testFile, testLink);
      await fs.promises.unlink(testLink);
      await fs.promises.unlink(testFile);
    } catch {
      canCreateSymlinks = false;
    }
    
    if (!canCreateSymlinks) {
      console.log('Skipping symlink race test - cannot create symlinks on this system');
      return;
    }
    
    // Create a file outside workspace
    const outsideFile = path.join(os.tmpdir(), 'reach-test-outside-read-' + Date.now() + '.txt');
    await fs.promises.writeFile(outsideFile, 'sensitive');

    // Create a symlink inside workspace pointing outside
    const symlinkPath = path.join(testWorkspace, 'malicious_link');
    await fs.promises.symlink(outsideFile, symlinkPath);

    try {
      await expect(
        safeReadFile('malicious_link', testWorkspace)
      ).rejects.toThrow(SecurityError);
    } finally {
      await fs.promises.unlink(outsideFile);
    }
  });
});

describe('isSymlink / isSymlinkSync', () => {
  const testDir = path.join(os.tmpdir(), 'reach-symlink-test-' + Date.now());
  let canCreateSymlinks = true;

  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
    
    // Test if we can create symlinks (Windows requires special permissions)
    try {
      const testLink = path.join(testDir, 'test-link-' + Date.now());
      const testFile = path.join(testDir, 'test-file-' + Date.now());
      await fs.promises.writeFile(testFile, 'test');
      await fs.promises.symlink(testFile, testLink);
      await fs.promises.unlink(testLink);
      await fs.promises.unlink(testFile);
    } catch {
      canCreateSymlinks = false;
    }
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('detects symlinks (async)', async () => {
    if (!canCreateSymlinks) {
      console.log('Skipping symlink test - cannot create symlinks on this system');
      return;
    }
    
    const targetFile = path.join(testDir, 'target.txt');
    const linkFile = path.join(testDir, 'link.txt');
    
    await fs.promises.writeFile(targetFile, 'target');
    await fs.promises.symlink(targetFile, linkFile);

    expect(await isSymlink(targetFile)).toBe(false);
    expect(await isSymlink(linkFile)).toBe(true);
    expect(await isSymlink(path.join(testDir, 'nonexistent'))).toBe(false);
  });

  it('detects symlinks (sync)', async () => {
    if (!canCreateSymlinks) {
      console.log('Skipping symlink test - cannot create symlinks on this system');
      return;
    }
    
    const targetFile = path.join(testDir, 'target.txt');
    const linkFile = path.join(testDir, 'link.txt');
    
    await fs.promises.writeFile(targetFile, 'target');
    await fs.promises.symlink(targetFile, linkFile);

    expect(isSymlinkSync(targetFile)).toBe(false);
    expect(isSymlinkSync(linkFile)).toBe(true);
    expect(isSymlinkSync(path.join(testDir, 'nonexistent'))).toBe(false);
  });
});

describe('SecurityError', () => {
  it('creates error with code', () => {
    const error = new SecurityError('Test error', SecurityErrorCode.PATH_ESCAPE, '/test/path');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(SecurityErrorCode.PATH_ESCAPE);
    expect(error.path).toBe('/test/path');
    expect(error.name).toBe('SecurityError');
  });
});
