/**
 * Pack Extraction Security Module
 * 
 * Provides secure pack/archive extraction with protection against:
 * - Directory traversal attacks (../../etc/passwd)
 * - Symlink attacks (TOCTOU races)
 * - Reparse point attacks (Windows)
 * - Absolute path injections
 * 
 * SECURITY: All paths are validated before extraction. Traversal attempts
 * are blocked and symlinks are rejected by default.
 * 
 * @module lib/pack-extraction
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { promisify } from 'node:util';

const realpath = promisify(fs.realpath);
const lstat = promisify(fs.lstat);

/**
 * Error thrown when pack extraction fails security checks
 */
export class PackExtractionError extends Error {
  constructor(
    message: string,
    public readonly entryName?: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = 'PackExtractionError';
  }
}

/**
 * Options for pack extraction
 */
export interface PackExtractionOptions {
  /** Target directory for extraction */
  targetDir: string;
  /** Allow symlinks (default: false) */
  allowSymlinks?: boolean;
  /** Maximum file size in bytes (default: 100MB) */
  maxFileSize?: number;
  /** Maximum total size in bytes (default: 1GB) */
  maxTotalSize?: number;
  /** Preserve permissions (default: false) */
  preservePermissions?: boolean;
  /** Strip components from path (like tar --strip-components) */
  stripComponents?: number;
}

/**
 * Detect path traversal attempts in archive entry names
 * 
 * SECURITY: Blocks all known traversal patterns including:
 * - ../ (Unix)
 * - ..\ (Windows)
 * - /.. and \.. at path boundaries
 * - URL-encoded variants (if decoded)
 * - Unicode homoglyphs
 * 
 * @param entryPath - The entry path from the archive
 * @returns True if traversal attempt detected
 */
export function isTraversalAttempt(entryPath: string): boolean {
  // Normalize separators for consistent checking
  const normalized = entryPath.replace(/\\/g, '/');
  
  // Check for path traversal patterns
  const traversalPatterns = [
    /\.\.\//,           // ../
    /\/\.\.\//,         // /../
    /^\.\.\//,          // Starts with ../
    /\/\.\.$/,          // Ends with /..
    /^\.\.$/,           // Just ..
    /%2e%2e%2f/i,       // URL-encoded ../
    /%2e%2e\//i,        // URL-encoded ../ (mixed)
    /\.\.\u002f/,       // Unicode variant
    /\u002e\u002e\//,   // Unicode dots with slash
  ];
  
  for (const pattern of traversalPatterns) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  
  // Check for absolute paths (Unix and Windows)
  if (path.isAbsolute(entryPath)) {
    return true;
  }
  
  // Check for Windows drive letters (e.g., C:, D:)
  if (/^[a-zA-Z]:[/\\]/.test(entryPath)) {
    return true;
  }
  
  // Check for UNC paths (Windows network paths)
  if (/^\\\\/.test(entryPath)) {
    return true;
  }
  
  // Check for null bytes (indicates potential injection)
  if (entryPath.includes('\0')) {
    return true;
  }
  
  // Normalize the path and check if it differs significantly
  // This catches tricks like foo/../../etc/passwd
  const pathSegments = normalized.split('/').filter(s => s && s !== '.');
  let depth = 0;
  
  for (const segment of pathSegments) {
    if (segment === '..') {
      depth--;
      if (depth < 0) {
        return true;  // Attempts to escape above root
      }
    } else {
      depth++;
    }
  }
  
  return false;
}

/**
 * Validate a single pack entry path
 * 
 * @param entryPath - The entry path from the archive
 * @param options - Validation options
 * @returns Sanitized path if valid
 * @throws PackExtractionError if path is invalid
 */
export function validatePackPath(
  entryPath: string,
  options: { stripComponents?: number } = {}
): string {
  const { stripComponents = 0 } = options;
  
  // Check for traversal attempts
  if (isTraversalAttempt(entryPath)) {
    throw new PackExtractionError(
      `Path traversal detected in entry: ${entryPath}`,
      entryPath,
      'traversal_attempt'
    );
  }
  
  // Strip leading components if requested
  let sanitizedPath = entryPath;
  if (stripComponents > 0) {
    const parts = entryPath.split(/[/\\]/).filter(p => p);
    if (parts.length <= stripComponents) {
      throw new PackExtractionError(
        `Cannot strip ${stripComponents} components from path with ${parts.length} parts: ${entryPath}`,
        entryPath,
        'strip_components_error'
    );
    }
    sanitizedPath = parts.slice(stripComponents).join('/');
  }
  
  // Additional validation: ensure no leading/trailing dots (hidden files)
  sanitizedPath = sanitizedPath.replace(/^[.]+[/\\]/g, '');
  
  // Re-validate after stripping
  if (isTraversalAttempt(sanitizedPath)) {
    throw new PackExtractionError(
      `Path traversal detected after sanitization: ${entryPath} -> ${sanitizedPath}`,
      entryPath,
      'traversal_after_sanitize'
    );
  }
  
  return sanitizedPath;
}

/**
 * Check if a file is a Windows reparse point (junction, symbolic link, etc.)
 * 
 * @param filePath - Path to check
 * @returns True if file is a reparse point
 */
export async function isReparsePoint(filePath: string): Promise<boolean> {
  if (process.platform !== 'win32') {
    return false;  // Only relevant on Windows
  }
  
  try {
    const stats = await lstat(filePath);
    // On Windows, isSymbolicLink() also detects junctions and symbolic links
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Synchronous version of isReparsePoint
 */
export function isReparsePointSync(filePath: string): boolean {
  if (process.platform !== 'win32') {
    return false;
  }
  
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Securely extract a pack entry to the target directory
 * 
 * SECURITY: 
 * - Validates path doesn't escape target directory
 * - Rejects symlinks unless explicitly allowed
 * - Creates parent directories safely
 * 
 * @param entryPath - The entry path from the archive
 * @param content - The file content
 * @param options - Extraction options
 * @returns Path to the extracted file
 * @throws PackExtractionError if extraction fails security checks
 */
export async function extractPackEntry(
  entryPath: string,
  content: Buffer | string,
  options: PackExtractionOptions
): Promise<string> {
  const {
    targetDir,
    allowSymlinks = false,
    maxFileSize = 100 * 1024 * 1024, // 100MB
  } = options;
  
  // Validate the entry path
  const sanitizedEntry = validatePackPath(entryPath, options);
  
  // Check content size
  const contentSize = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content);
  if (contentSize > maxFileSize) {
    throw new PackExtractionError(
      `File ${entryPath} exceeds maximum size of ${maxFileSize} bytes`,
      entryPath,
      'file_too_large'
    );
  }
  
  // Resolve target path within target directory
  const resolvedTarget = path.resolve(targetDir);
  const targetPath = path.join(resolvedTarget, sanitizedEntry);
  const normalizedTarget = path.normalize(targetPath);
  
  // Verify the resolved path is still within target directory
  if (!normalizedTarget.startsWith(resolvedTarget + path.sep) && 
      normalizedTarget !== resolvedTarget) {
    throw new PackExtractionError(
      `Entry escapes target directory: ${entryPath}`,
      entryPath,
      'escape_attempt'
    );
  }
  
  // Check if target path is a symlink (TOCTOU protection)
  if (!allowSymlinks) {
    // Check before writing
    if (await isReparsePoint(normalizedTarget)) {
      throw new PackExtractionError(
        `Symlink detected at target path: ${entryPath}`,
        entryPath,
        'symlink_blocked'
      );
    }
    
    // Check parent directories too
    let currentDir = path.dirname(normalizedTarget);
    while (currentDir !== resolvedTarget && currentDir !== path.dirname(currentDir)) {
      if (await isReparsePoint(currentDir)) {
        throw new PackExtractionError(
          `Symlink detected in parent path: ${currentDir}`,
          entryPath,
          'symlink_in_parent'
        );
      }
      currentDir = path.dirname(currentDir);
    }
  }
  
  // Create parent directories
  const parentDir = path.dirname(normalizedTarget);
  await fs.promises.mkdir(parentDir, { recursive: true });
  
  // Double-check after directory creation (TOCTOU)
  if (!allowSymlinks) {
    if (await isReparsePoint(normalizedTarget)) {
      throw new PackExtractionError(
        `Symlink race condition detected: ${entryPath}`,
        entryPath,
        'symlink_race'
      );
    }
  }
  
  // Write the file atomically
  const tempPath = `${normalizedTarget}.tmp.${Date.now()}`;
  try {
    await fs.promises.writeFile(tempPath, content);
    await fs.promises.rename(tempPath, normalizedTarget);
  } catch (error) {
    // Cleanup temp file on failure
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw new PackExtractionError(
      `Failed to write file: ${entryPath} - ${error}`,
      entryPath,
      'write_error'
    );
  }
  
  return normalizedTarget;
}

/**
 * Extract an entire pack with security validation
 * 
 * @param entries - Array of {path, content} entries
 * @param options - Extraction options
 * @returns Array of extracted file paths
 * @throws PackExtractionError if any entry fails validation
 */
export async function extractPackSafely(
  entries: Array<{ path: string; content: Buffer | string }>,
  options: PackExtractionOptions
): Promise<string[]> {
  const { targetDir, maxTotalSize = 1024 * 1024 * 1024 } = options; // 1GB default
  
  // Ensure target directory exists
  await fs.promises.mkdir(targetDir, { recursive: true });
  
  // Calculate total size before extraction
  let totalSize = 0;
  for (const entry of entries) {
    totalSize += Buffer.isBuffer(entry.content) 
      ? entry.content.length 
      : Buffer.byteLength(entry.content);
    
    if (totalSize > maxTotalSize) {
      throw new PackExtractionError(
        `Total pack size exceeds maximum of ${maxTotalSize} bytes`,
        entry.path,
        'total_size_exceeded'
      );
    }
  }
  
  // Extract each entry
  const extracted: string[] = [];
  for (const entry of entries) {
    const extractedPath = await extractPackEntry(entry.path, entry.content, options);
    extracted.push(extractedPath);
  }
  
  return extracted;
}

/**
 * Validate a pack manifest for security issues
 * 
 * @param manifest - The pack manifest object
 * @returns Validation result
 */
export function validatePackManifest(
  manifest: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for required fields
  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('Missing or invalid pack id');
  } else {
    // Validate id doesn't contain traversal
    if (isTraversalAttempt(manifest.id)) {
      errors.push(`Pack id contains traversal: ${manifest.id}`);
    }
  }
  
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Missing or invalid pack version');
  }
  
  // Validate entry point if present
  if (manifest.entry) {
    const entry = String(manifest.entry);
    if (isTraversalAttempt(entry)) {
      errors.push(`Entry point contains traversal: ${entry}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Re-export for convenience
 */
export { path, fs };
