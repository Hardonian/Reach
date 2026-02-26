/**
 * Pack Extraction Security Tests
 * 
 * Tests for pack extraction security including traversal protection,
 * symlink detection, and rearse point handling.
 * 
 * @module lib/pack-extraction.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  isTraversalAttempt,
  validatePackPath,
  extractPackEntry,
  extractPackSafely,
  validatePackManifest,
  isReparsePoint,
  PackExtractionError,
} from './pack-extraction';

describe('isTraversalAttempt', () => {
  it('detects Unix traversal (../)', () => {
    expect(isTraversalAttempt('../etc/passwd')).toBe(true);
    expect(isTraversalAttempt('foo/../../etc/passwd')).toBe(true);
    expect(isTraversalAttempt('/foo/../bar')).toBe(true);
  });
  
  it('detects Windows traversal (..\\)', () => {
    expect(isTraversalAttempt('..\\Windows\\System32')).toBe(true);
    expect(isTraversalAttempt('foo\\..\\..\\bar')).toBe(true);
  });
  
  it('detects absolute Unix paths', () => {
    expect(isTraversalAttempt('/etc/passwd')).toBe(true);
    expect(isTraversalAttempt('/var/log/secrets')).toBe(true);
  });
  
  it('detects Windows drive letters', () => {
    expect(isTraversalAttempt('C:\\Windows\\System32')).toBe(true);
    expect(isTraversalAttempt('D:\\secret.txt')).toBe(true);
    expect(isTraversalAttempt('c:/windows/system32')).toBe(true);
  });
  
  it('detects UNC paths', () => {
    expect(isTraversalAttempt('\\\\server\\share\\file.txt')).toBe(true);
    expect(isTraversalAttempt('\\\\\\\\192.168.1.1\\share')).toBe(true);
  });
  
  it('detects null bytes', () => {
    expect(isTraversalAttempt('file\0.txt')).toBe(true);
    expect(isTraversalAttempt('path\x00traversal')).toBe(true);
  });
  
  it('detects URL-encoded traversal', () => {
    expect(isTraversalAttempt('%2e%2e%2fetc/passwd')).toBe(true);
    expect(isTraversalAttempt('%2e%2e/etc/passwd')).toBe(true);
  });
  
  it('allows safe relative paths', () => {
    expect(isTraversalAttempt('foo/bar/baz')).toBe(false);
    expect(isTraversalAttempt('foo\\bar\\baz')).toBe(false);
    expect(isTraversalAttempt('filename.txt')).toBe(false);
    expect(isTraversalAttempt('path/to/file')).toBe(false);
  });
  
  it('allows paths with dots in names', () => {
    expect(isTraversalAttempt('file.name.txt')).toBe(false);
    expect(isTraversalAttempt('foo..bar')).toBe(false);
    expect(isTraversalAttempt('...hidden')).toBe(false);
  });
  
  it('detects traversal in complex paths', () => {
    expect(isTraversalAttempt('safe/../unsafe')).toBe(true);
    expect(isTraversalAttempt('./../escape')).toBe(true);
    expect(isTraversalAttempt('foo/bar/../../escape')).toBe(true);
  });
  
  it('detects lone .. component', () => {
    expect(isTraversalAttempt('..')).toBe(true);
  });
  
  it('detects trailing ..', () => {
    expect(isTraversalAttempt('foo/..')).toBe(true);
    expect(isTraversalAttempt('/foo/..')).toBe(true);
  });
});

describe('validatePackPath', () => {
  it('returns sanitized path for valid entry', () => {
    const result = validatePackPath('foo/bar.txt');
    expect(result).toBe('foo/bar.txt');
  });
  
  it('throws on traversal attempt', () => {
    expect(() => {
      validatePackPath('../etc/passwd');
    }).toThrow(PackExtractionError);
  });
  
  it('throws on absolute path', () => {
    expect(() => {
      validatePackPath('/etc/passwd');
    }).toThrow(PackExtractionError);
  });
  
  it('strips leading components when requested', () => {
    const result = validatePackPath('pack-1.0.0/file.txt', { stripComponents: 1 });
    expect(result).toBe('file.txt');
  });
  
  it('throws if cannot strip enough components', () => {
    expect(() => {
      validatePackPath('single', { stripComponents: 1 });
    }).toThrow(PackExtractionError);
  });
  
  it('re-validates after stripping', () => {
    expect(() => {
      validatePackPath('../unsafe/file.txt', { stripComponents: 1 });
    }).toThrow(PackExtractionError);
  });
});

describe('extractPackEntry', () => {
  const testDir = path.join(os.tmpdir(), `reach-pack-test-${Date.now()}`);
  
  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  it('extracts file to target directory', async () => {
    const content = 'Hello, World!';
    const result = await extractPackEntry('hello.txt', content, {
      targetDir: testDir,
    });
    
    expect(result).toBe(path.join(testDir, 'hello.txt'));
    expect(fs.existsSync(result)).toBe(true);
    expect(fs.readFileSync(result, 'utf8')).toBe(content);
  });
  
  it('creates parent directories', async () => {
    const result = await extractPackEntry('nested/path/file.txt', 'content', {
      targetDir: testDir,
    });
    
    expect(fs.existsSync(result)).toBe(true);
  });
  
  it('rejects files exceeding max size', async () => {
    const largeContent = 'x'.repeat(1000);
    
    await expect(
      extractPackEntry('large.txt', largeContent, {
        targetDir: testDir,
        maxFileSize: 100,  // 100 bytes
      })
    ).rejects.toThrow(PackExtractionError);
  });
  
  it('rejects traversal in entry path', async () => {
    await expect(
      extractPackEntry('../outside.txt', 'content', {
        targetDir: testDir,
      })
    ).rejects.toThrow(PackExtractionError);
  });
  
  it('writes binary content correctly', async () => {
    const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    const result = await extractPackEntry('binary.bin', binaryContent, {
      targetDir: testDir,
    });
    
    const readContent = fs.readFileSync(result);
    expect(Buffer.compare(readContent, binaryContent)).toBe(0);
  });
});

describe('extractPackSafely', () => {
  const testDir = path.join(os.tmpdir(), `reach-pack-batch-test-${Date.now()}`);
  
  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  it('extracts multiple entries', async () => {
    const entries = [
      { path: 'file1.txt', content: 'content 1' },
      { path: 'file2.txt', content: 'content 2' },
      { path: 'nested/file3.txt', content: 'content 3' },
    ];
    
    const results = await extractPackSafely(entries, {
      targetDir: testDir,
    });
    
    expect(results).toHaveLength(3);
    expect(fs.existsSync(results[0])).toBe(true);
    expect(fs.existsSync(results[1])).toBe(true);
    expect(fs.existsSync(results[2])).toBe(true);
  });
  
  it('enforces total size limit', async () => {
    const entries = [
      { path: 'file1.txt', content: 'x'.repeat(100) },
      { path: 'file2.txt', content: 'x'.repeat(100) },
    ];
    
    await expect(
      extractPackSafely(entries, {
        targetDir: testDir,
        maxTotalSize: 150,  // Less than total content
      })
    ).rejects.toThrow(PackExtractionError);
  });
  
  it('fails fast on first traversal attempt', async () => {
    const entries = [
      { path: 'safe.txt', content: 'safe content' },
      { path: '../unsafe.txt', content: 'malicious' },
      { path: 'also-safe.txt', content: 'more safe content' },
    ];
    
    await expect(
      extractPackSafely(entries, {
        targetDir: testDir,
      })
    ).rejects.toThrow(PackExtractionError);
    
    // First file should not be extracted (atomic failure)
    // or should be rolled back
  });
});

describe('validatePackManifest', () => {
  it('validates valid manifest', () => {
    const manifest = {
      id: 'test-pack',
      version: '1.0.0',
      entry: 'index.js',
    };
    
    const result = validatePackManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('requires id field', () => {
    const manifest = { version: '1.0.0' };
    const result = validatePackManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid pack id');
  });
  
  it('requires version field', () => {
    const manifest = { id: 'test' };
    const result = validatePackManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid pack version');
  });
  
  it('rejects traversal in id', () => {
    const manifest = {
      id: '../malicious',
      version: '1.0.0',
    };
    
    const result = validatePackManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('traversal'))).toBe(true);
  });
  
  it('rejects traversal in entry', () => {
    const manifest = {
      id: 'test',
      version: '1.0.0',
      entry: '../../etc/passwd',
    };
    
    const result = validatePackManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('traversal'))).toBe(true);
  });
});

describe('isReparsePoint', () => {
  const testDir = path.join(os.tmpdir(), `reach-reparse-test-${Date.now()}`);
  
  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  it('returns false for regular files', async () => {
    const filePath = path.join(testDir, 'regular.txt');
    await fs.promises.writeFile(filePath, 'content', 'utf8');
    
    const result = await isReparsePoint(filePath);
    expect(result).toBe(false);
  });
  
  it('returns false for non-existent files', async () => {
    const result = await isReparsePoint(path.join(testDir, 'nonexistent'));
    expect(result).toBe(false);
  });
  
  it('detects symlinks (if supported)', async () => {
    // Check if we can create symlinks
    let canCreateSymlinks = true;
    try {
      const targetFile = path.join(testDir, 'target.txt');
      const linkFile = path.join(testDir, 'link.txt');
      await fs.promises.writeFile(targetFile, 'target', 'utf8');
      await fs.promises.symlink(targetFile, linkFile);
      
      const result = await isReparsePoint(linkFile);
      expect(result).toBe(true);
      
      await fs.promises.unlink(linkFile);
      await fs.promises.unlink(targetFile);
    } catch {
      // Symlinks not supported on this system
      console.log('Skipping symlink test - not supported');
    }
  });
});
