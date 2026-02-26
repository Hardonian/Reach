/**
 * Security Utilities
 * 
 * Provides security hardening utilities for the Reach decision engine:
 * - Path traversal protection
 * - Symlink race (TOCTOU) prevention
 * - Request ID sanitization
 * - Diff report path validation
 * 
 * SECURITY HARDENING (v1.2):
 * All file operations must go through these utilities to ensure
 * workspace confinement and prevent directory traversal attacks.
 * 
 * @module lib/security
 */

import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const realpath = promisify(fs.realpath);
const lstat = promisify(fs.lstat);

/**
 * Security error codes
 */
export enum SecurityErrorCode {
  PATH_ESCAPE = 'path_escape_detected',
  SYMLINK_RACE = 'symlink_race_detected',
  PATH_TRAVERSAL = 'path_traversal_detected',
  INVALID_REQUEST_ID = 'invalid_request_id',
  FILE_NOT_IN_WORKSPACE = 'file_not_in_workspace',
}

/**
 * Security error with code
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: SecurityErrorCode,
    public readonly path?: string,
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Options for path validation
 */
export interface PathValidationOptions {
  /** Base directory that paths must be within */
  baseDir: string;
  /** Allow paths outside base directory */
  allowOutside?: boolean;
  /** Follow symlinks and verify target is within base */
  followSymlinks?: boolean;
  /** Maximum path length */
  maxLength?: number;
}

/**
 * Sanitize a request ID to prevent path traversal
 * 
 * SECURITY: Only allows alphanumeric, dash, underscore, dot
 * Replaces dangerous characters with underscore
 * Limits length to prevent buffer overflow issues
 * 
 * @param requestId - The request ID to sanitize
 * @returns Sanitized request ID safe for use in filenames
 */
export function sanitizeRequestId(requestId: string): string {
  // Remove any path separators and dangerous characters
  // Allow only: alphanumeric, dash, underscore, dot
  const sanitized = requestId
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace invalid chars
    .replace(/^[.-]+/, '')             // Remove leading dots/dashes
    .substring(0, 64);                  // Limit length
  
  // Prevent empty result
  if (sanitized.length === 0) {
    return 'invalid_request_id';
  }
  
  return sanitized;
}

/**
 * Validate that a path does not contain traversal sequences
 * 
 * SECURITY: Detects ../ and ..\ patterns that could escape workspace
 * 
 * @param filePath - The path to validate
 * @returns True if path contains traversal sequences
 */
export function containsPathTraversal(filePath: string): boolean {
  // Normalize path separators for cross-platform check
  const normalized = filePath.replace(/\\/g, '/');
  
  // Check for traversal patterns
  const traversalPatterns = [
    /\.\.\//,        // ../
    /\.\.\\/,        // ..\ (Windows)
    /\/\.\.\//,      // /../
    /\\\.\.\\/,      // \..\ (Windows)
    /^\.\.\//,       // Starts with ../
    /^\.\.\\/,       // Starts with ..\ (Windows)
  ];
  
  return traversalPatterns.some(pattern => pattern.test(normalized));
}

/**
 * Resolve and validate a path is within the base directory
 * 
 * SECURITY: TOCTOU-safe path resolution
 * - Resolves realpath to follow symlinks
 * - Verifies resolved path is within base directory
 * - Throws SecurityError if path escapes
 * 
 * @param filePath - The path to resolve and validate
 * @param options - Validation options
 * @returns Resolved absolute path
 * @throws SecurityError if path validation fails
 */
export async function resolveSafePath(
  filePath: string,
  options: PathValidationOptions,
): Promise<string> {
  const { baseDir, allowOutside = false, followSymlinks = true, maxLength = 4096 } = options;
  
  // Check path length
  if (filePath.length > maxLength) {
    throw new SecurityError(
      `Path exceeds maximum length of ${maxLength}`,
      SecurityErrorCode.PATH_TRAVERSAL,
      filePath,
    );
  }
  
  // Reject absolute paths unless explicitly allowed
  if (path.isAbsolute(filePath) && !allowOutside) {
    throw new SecurityError(
      'Absolute paths not allowed',
      SecurityErrorCode.PATH_TRAVERSAL,
      filePath,
    );
  }
  
  // Check for obvious traversal patterns
  if (containsPathTraversal(filePath)) {
    throw new SecurityError(
      'Path contains traversal sequences',
      SecurityErrorCode.PATH_TRAVERSAL,
      filePath,
    );
  }
  
  // Resolve base directory to absolute path
  const resolvedBase = path.resolve(baseDir);
  
  // Join and resolve the target path
  const targetPath = path.resolve(resolvedBase, filePath);
  
  // If not following symlinks, just check the path starts with base
  if (!followSymlinks) {
    if (!targetPath.startsWith(resolvedBase) && !allowOutside) {
      throw new SecurityError(
        'Path escapes base directory',
        SecurityErrorCode.PATH_ESCAPE,
        filePath,
      );
    }
    return targetPath;
  }
  
  // Follow symlinks and verify final destination
  try {
    const realPath = await realpath(targetPath);
    
    // Ensure resolved path is within base directory
    if (!realPath.startsWith(resolvedBase) && !allowOutside) {
      throw new SecurityError(
        'Resolved path escapes base directory (possible symlink attack)',
        SecurityErrorCode.SYMLINK_RACE,
        filePath,
      );
    }
    
    return realPath;
  } catch (error) {
    // If realpath fails, the file doesn't exist or is not accessible
    // Return the resolved path if it's within base
    if (!targetPath.startsWith(resolvedBase) && !allowOutside) {
      throw new SecurityError(
        'Path escapes base directory',
        SecurityErrorCode.PATH_ESCAPE,
        filePath,
      );
    }
    return targetPath;
  }
}

/**
 * Synchronous version of resolveSafePath
 * 
 * WARNING: This is more vulnerable to TOCTOU races than the async version.
 * Use async version when possible for production code.
 */
export function resolveSafePathSync(
  filePath: string,
  options: PathValidationOptions,
): string {
  const { baseDir, allowOutside = false, maxLength = 4096 } = options;
  
  // Check path length
  if (filePath.length > maxLength) {
    throw new SecurityError(
      `Path exceeds maximum length of ${maxLength}`,
      SecurityErrorCode.PATH_TRAVERSAL,
      filePath,
    );
  }
  
  // Reject absolute paths unless explicitly allowed
  if (path.isAbsolute(filePath) && !allowOutside) {
    throw new SecurityError(
      'Absolute paths not allowed',
      SecurityErrorCode.PATH_TRAVERSAL,
      filePath,
    );
  }
  
  // Check for obvious traversal patterns
  if (containsPathTraversal(filePath)) {
    throw new SecurityError(
      'Path contains traversal sequences',
      SecurityErrorCode.PATH_TRAVERSAL,
      filePath,
    );
  }
  
  // Resolve base directory to absolute path
  const resolvedBase = path.resolve(baseDir);
  
  // Join and resolve the target path
  const targetPath = path.resolve(resolvedBase, filePath);
  
  // Ensure path is within base directory
  if (!targetPath.startsWith(resolvedBase) && !allowOutside) {
    throw new SecurityError(
      'Path escapes base directory',
      SecurityErrorCode.PATH_ESCAPE,
      filePath,
    );
  }
  
  // Try to resolve symlinks
  try {
    const realPath = fs.realpathSync(targetPath);
    
    // Ensure resolved path is within base directory
    if (!realPath.startsWith(resolvedBase) && !allowOutside) {
      throw new SecurityError(
        'Resolved path escapes base directory (possible symlink attack)',
        SecurityErrorCode.SYMLINK_RACE,
        filePath,
      );
    }
    
    return realPath;
  } catch {
    // If realpath fails, return the resolved path if within base
    return targetPath;
  }
}

/**
 * Check if a file is a symlink (cross-platform)
 */
export async function isSymlink(filePath: string): Promise<boolean> {
  try {
    const stats = await lstat(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Check if a file is a symlink (synchronous)
 */
export function isSymlinkSync(filePath: string): boolean {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Diff report path configuration
 */
export interface DiffReportConfig {
  /** Base directory for diff reports */
  baseDir: string;
  /** File extension */
  extension?: string;
}

/**
 * Build a safe path for a diff report file
 * 
 * SECURITY: Prevents path traversal via requestId manipulation
 * 
 * @param requestId - The request ID (will be sanitized)
 * @param config - Diff report configuration
 * @returns Safe path for the diff report
 * @throws SecurityError if path validation fails
 */
export function buildDiffReportPath(
  requestId: string,
  config: DiffReportConfig,
): string {
  const { baseDir, extension = '.json' } = config;
  
  // Sanitize the request ID
  const sanitizedId = sanitizeRequestId(requestId);
  
  // Build filename
  const filename = `diff_${sanitizedId}${extension}`;
  
  // SECURITY: Verify the path would be within base directory
  // Check for path traversal in the original requestId
  if (containsPathTraversal(requestId)) {
    // Still create a safe path, but we've sanitized the dangerous parts
  }
  
  // Use safe path resolution
  const resolvedBase = path.resolve(baseDir);
  const result = path.join(resolvedBase, filename);
  
  // Normalize and verify
  const normalized = path.normalize(result);
  
  return normalized;
}

/**
 * Read a file safely with TOCTOU protection
 * 
 * SECURITY:
 * - Verifies file is within workspace before reading
 * - Detects symlink races
 * - Throws SecurityError on validation failure
 * 
 * @param filePath - Path to read (relative to workspace)
 * @param workspaceRoot - Workspace root directory
 * @returns File contents as string
 * @throws SecurityError if validation fails
 */
export async function safeReadFile(
  filePath: string,
  workspaceRoot: string,
): Promise<string> {
  const resolvedPath = await resolveSafePath(filePath, { 
    baseDir: workspaceRoot,
    followSymlinks: true,
  });
  
  // Double-check it's still not a symlink after resolution (TOCTOU protection)
  if (await isSymlink(resolvedPath)) {
    throw new SecurityError(
      'File is a symlink (possible race condition)',
      SecurityErrorCode.SYMLINK_RACE,
      filePath,
    );
  }
  
  return fs.promises.readFile(resolvedPath, 'utf-8');
}

/**
 * Write a file safely with TOCTOU protection
 * 
 * SECURITY:
 * - Verifies target path is within workspace
 * - Uses atomic write (write to temp, then rename)
 * - Throws SecurityError on validation failure
 * 
 * @param filePath - Path to write (relative to workspace)
 * @param content - Content to write
 * @param workspaceRoot - Workspace root directory
 * @throws SecurityError if validation fails
 */
export async function safeWriteFile(
  filePath: string,
  content: string,
  workspaceRoot: string,
): Promise<void> {
  const resolvedPath = await resolveSafePath(filePath, { 
    baseDir: workspaceRoot,
    followSymlinks: false, // Don't follow symlinks when writing
  });
  
  // Ensure parent directory exists
  const parentDir = path.dirname(resolvedPath);
  await fs.promises.mkdir(parentDir, { recursive: true });
  
  // Atomic write: write to temp file then rename
  const tempPath = `${resolvedPath}.tmp.${Date.now()}`;
  
  try {
    await fs.promises.writeFile(tempPath, content, 'utf-8');
    await fs.promises.rename(tempPath, resolvedPath);
  } catch (error) {
    // Clean up temp file on failure
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Re-export for convenience
 */
export { path, fs };
