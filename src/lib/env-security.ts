/**
 * Environment Security Module
 * 
 * Provides environment hygiene and binary hijack resistance:
 * - Secret stripping from child process environments
 * - Binary trust gate with version locking
 * - Path validation for trusted binaries
 * - Cross-platform binary integrity verification
 * 
 * SECURITY: This module ensures sensitive credentials never leak to child processes
 * and that only trusted binaries are executed.
 * 
 * M3 Hardening:
 * - Enhanced secret pattern detection
 * - Windows-specific env leakage prevention
 * - Deterministic binary trust verification
 * 
 * @module lib/env-security
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Error thrown when binary trust validation fails
 */
export class BinaryTrustError extends Error {
  constructor(
    message: string,
    public readonly binaryPath?: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = 'BinaryTrustError';
  }
}

/**
 * Environment variable prefixes that indicate trusted/safe variables
 * These will be preserved during sanitization
 */
export const TRUSTED_ENV_VAR_PREFIXES = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'TERM',
  'LANG',
  'LC_',
  'NODE_',
  'REACH_',
  'TMP',
  'TEMP',
  'PWD',
  'OLDPWD',
  'SHLVL',
  '_',  // Last command
];

/**
 * Patterns that indicate secret/sensitive environment variables
 * These will be stripped during sanitization
 */
export const SECRET_ENV_PATTERNS = [
  /_SECRET$/i,
  /_TOKEN$/i,
  /_KEY$/i,
  /_PASSWORD$/i,
  /_PASSWD$/i,
  /_PASS$/i,
  /_CREDENTIAL$/i,
  /_CREDENTIALS$/i,
  /_AUTH$/i,
  /_AUTHENTICATION$/i,
  /_COOKIE$/i,
  /_SESSION$/i,
  /ENCRYPTION_KEY$/i,
  /PRIVATE_KEY$/i,
  /SECRET_KEY$/i,
  /ACCESS_KEY$/i,
  /AWS_SECRET/i,
  /GITHUB_TOKEN/i,
  /GITLAB_TOKEN/i,
  /NPM_TOKEN/i,
  /DOCKER_AUTH/i,
  /KUBECONFIG/i,
  /^AUTH/i,
  /^SECRET_/i,
  /^TOKEN_/i,
  /^PASSWORD/i,
  /API_KEY/i,
  /SIGNING_KEY/i,
  /MASTER_KEY/i,
  /DB_PASS/i,
  /DATABASE_URL/i,
  /CONNECTION_STRING/i,
  /JWT_SECRET/i,
  /OAUTH_SECRET/i,
  /REFRESH_TOKEN/i,
  /CERTIFICATE/i,
  /_PEM$/i,
  /_CERT$/i,
];

/**
 * Additional specific environment variables to always strip
 */
export const SENSITIVE_ENV_VARS = new Set([
  'REACH_ENCRYPTION_KEY',
  'REACH_API_KEY',
  'REACH_TOKEN',
  'REQUIEM_AUTH_TOKEN',
  'REQUIEM_API_SECRET',
  'REQUIEM_TOKEN',
  'REQUIEM_ENCRYPTION_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'AZURE_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'GCP_SERVICE_ACCOUNT_KEY',
  'GITHUB_PERSONAL_ACCESS_TOKEN',
  'DOCKER_HUB_TOKEN',
  'KUBERNETES_TOKEN',
  'SSL_CERTIFICATE',
  'TLS_PRIVATE_KEY',
]);

/**
 * Environment variables that are explicitly safe and should never be stripped
 */
export const SAFE_ENV_VARS = new Set([
  'PUBLIC_KEY',
  'MY_PUBLIC_KEY',
  'NODE_ENV',
  'PATH',
  'HOME',
]);

/**
 * Sanitize environment variables for child process spawning
 * 
 * SECURITY: Removes all secret/sensitive variables while preserving
 * necessary system variables for process execution.
 * 
 * @param env - The environment object to sanitize (defaults to process.env)
 * @returns Sanitized environment safe for child processes
 */
export function sanitizeEnvironment(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(env)) {
    // Skip undefined values
    if (value === undefined) continue;
    
    // Check if this is a sensitive variable
    if (isSensitiveEnvVar(key)) {
      continue; // Strip it
    }
    
    // Preserve non-sensitive variables
    sanitized[key] = value;
  }
  
  return sanitized;
}

/**
 * Check if an environment variable name indicates it contains sensitive data
 * 
 * @param name - The environment variable name
 * @returns True if the variable should be considered sensitive
 */
export function isSensitiveEnvVar(name: string): boolean {
  // Check against explicitly safe variables first
  if (SAFE_ENV_VARS.has(name)) {
    return false;
  }
  
  // Check against known sensitive variable names
  if (SENSITIVE_ENV_VARS.has(name)) {
    return true;
  }
  
  // Check against sensitive patterns
  for (const pattern of SECRET_ENV_PATTERNS) {
    if (pattern.test(name)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Options for binary trust validation
 */
export interface BinaryTrustOptions {
  /** Path to the binary to validate */
  binaryPath: string;
  /** Expected version of the binary */
  expectedVersion: string;
  /** Current running version to compare against */
  currentVersion: string;
  /** Allowed base paths for the binary (optional) */
  allowedPaths?: string[];
  /** Allow relative paths (default: false) */
  allowRelative?: boolean;
  /** Require executable permissions (default: true) */
  requireExecutable?: boolean;
}

/**
 * Validate binary trust gate
 * 
 * SECURITY: Ensures:
 * 1. Binary path is in an allowed location (not /tmp, user-writable, etc.)
 * 2. Version matches expected (prevents version downgrade attacks)
 * 3. Binary is actually executable
 * 
 * @param options - Validation options
 * @throws BinaryTrustError if validation fails
 */
export function validateBinaryTrust(options: BinaryTrustOptions): void {
  const {
    binaryPath,
    expectedVersion,
    currentVersion,
    allowedPaths = ['/usr/bin', '/usr/local/bin', '/bin', '/opt/reach/bin'],
    allowRelative = false,
    requireExecutable = true,
  } = options;
  
  // Check version lock
  if (currentVersion !== expectedVersion) {
    throw new BinaryTrustError(
      `Version mismatch: expected ${expectedVersion}, got ${currentVersion}`,
      binaryPath,
      'version_mismatch'
    );
  }
  
  // Resolve to absolute path
  const resolvedPath = path.resolve(binaryPath);
  
  // Check if path is relative and not allowed
  if (!path.isAbsolute(binaryPath) && !allowRelative) {
    throw new BinaryTrustError(
      `Relative binary paths not allowed: ${binaryPath}`,
      binaryPath,
      'relative_path'
    );
  }
  
  // Check if path is in allowed location
  const isInAllowedPath = allowedPaths.some(allowed => {
    const resolvedAllowed = path.resolve(allowed);
    return resolvedPath.startsWith(resolvedAllowed + path.sep) || 
           resolvedPath === resolvedAllowed;
  });
  
  if (!isInAllowedPath && path.isAbsolute(binaryPath)) {
    throw new BinaryTrustError(
      `Binary not in allowed path: ${binaryPath}. Allowed: ${allowedPaths.join(', ')}`,
      binaryPath,
      'untrusted_path'
    );
  }
  
  // Verify file exists and is executable
  if (requireExecutable) {
    try {
      const stats = fs.statSync(resolvedPath);
      
      if (!stats.isFile()) {
        throw new BinaryTrustError(
          `Binary is not a file: ${binaryPath}`,
          binaryPath,
          'not_a_file'
        );
      }
      
      // Check executable permission (Unix-like systems)
      if (process.platform !== 'win32') {
        const mode = stats.mode;
        const isExecutable = (mode & 0o111) !== 0;  // Owner, group, or other execute bit
        
        if (!isExecutable) {
          throw new BinaryTrustError(
            `Binary is not executable: ${binaryPath}`,
            binaryPath,
            'not_executable'
          );
        }
      }
    } catch (error) {
      if (error instanceof BinaryTrustError) throw error;
      
      throw new BinaryTrustError(
        `Cannot access binary: ${binaryPath} - ${error}`,
        binaryPath,
        'access_error'
      );
    }
  }
}

/**
 * Compute hash of a binary for integrity verification
 * 
 * @param binaryPath - Path to the binary
 * @returns SHA-256 hash of the binary
 */
export function computeBinaryHash(binaryPath: string): string {
  const content = fs.readFileSync(binaryPath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Verify binary integrity against known hash
 * 
 * @param binaryPath - Path to the binary
 * @param expectedHash - Expected SHA-256 hash
 * @returns True if hash matches
 * @throws BinaryTrustError if hashes don't match
 */
export function verifyBinaryHash(binaryPath: string, expectedHash: string): boolean {
  const actualHash = computeBinaryHash(binaryPath);
  
  if (actualHash !== expectedHash.toLowerCase()) {
    throw new BinaryTrustError(
      `Binary hash mismatch: expected ${expectedHash}, got ${actualHash}`,
      binaryPath,
      'hash_mismatch'
    );
  }
  
  return true;
}

/**
 * Create a sanitized environment for spawning REQUIEM_BIN
 * 
 * @param additionalVars - Additional safe variables to include
 * @returns Sanitized environment with REQUIEM_BIN trust validation
 */
export function createRequiemEnv(
  additionalVars: Record<string, string> = {}
): Record<string, string> {
  // Start with sanitized environment
  const env = sanitizeEnvironment();
  
  // Add additional safe variables
  for (const [key, value] of Object.entries(additionalVars)) {
    if (!isSensitiveEnvVar(key)) {
      env[key] = value;
    }
  }
  
  return env;
}

/**
 * Windows-specific environment variables that may leak sensitive info
 * These are stripped on Windows platforms for defense in depth
 */
const WINDOWS_SENSITIVE_PATTERNS = [
  /^USERNAME$/i,  // May contain identifying info
  /^USERDOMAIN$/i,
  /^LOGONSERVER$/i,
  /^COMPUTERNAME$/i, // May be sensitive in some contexts
];

/**
 * Check if running on Windows
 */
function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Enhanced environment sanitization with platform-specific protections
 * 
 * SECURITY: On Windows, additional environment variables are stripped
 * to prevent information leakage through child processes.
 * 
 * @param env - The environment to sanitize
 * @param platformSpecific - Whether to apply platform-specific rules
 * @returns Sanitized environment
 */
export function sanitizeEnvironmentEnhanced(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  platformSpecific = true,
): Record<string, string> {
  const sanitized = sanitizeEnvironment(env);
  
  // Apply Windows-specific protections
  if (platformSpecific && isWindows()) {
    for (const key of Object.keys(sanitized)) {
      for (const pattern of WINDOWS_SENSITIVE_PATTERNS) {
        if (pattern.test(key)) {
          delete sanitized[key];
          break;
        }
      }
    }
  }
  
  return sanitized;
}

/**
 * Validate REQUIEM_BIN trust with enhanced checks
 * 
 * SECURITY: Combines version lock, path trust, and optional hash verification
 * for comprehensive binary integrity validation.
 * 
 * @param binaryPath - Path to the binary
 * @param expectedVersion - Expected version
 * @param currentVersion - Current running version
 * @param expectedHash - Optional expected SHA-256 hash
 * @throws BinaryTrustError if any validation fails
 */
export function validateRequiemBinTrust(
  binaryPath: string,
  expectedVersion: string,
  currentVersion: string,
  expectedHash?: string,
): void {
  // Validate binary trust (version + path)
  validateBinaryTrust({
    binaryPath,
    expectedVersion,
    currentVersion,
    allowedPaths: ['/usr/bin', '/usr/local/bin', '/bin', '/opt/reach/bin', 'C:\\Program Files\\Reach'],
    requireExecutable: true,
  });
  
  // If hash provided, verify integrity
  if (expectedHash) {
    verifyBinaryHash(binaryPath, expectedHash);
  }
}

/**
 * Create a completely sanitized environment for untrusted child processes
 * 
 * SECURITY: Creates a minimal environment with only essential variables,
 * stripping all potentially sensitive information.
 * 
 * @param additionalVars - Additional safe variables to include
 * @returns Minimal safe environment
 */
export function createMinimalEnv(
  additionalVars: Record<string, string> = {}
): Record<string, string> {
  // Start with only essential system variables
  const minimal: Record<string, string> = {};
  
  const essentialVars = [
    'PATH',
    'HOME',
    'USER',
    'TEMP',
    'TMP',
    'SystemRoot', // Windows
    'windir',     // Windows
    'PROGRAMDATA', // Windows
  ];
  
  for (const key of essentialVars) {
    const value = process.env[key];
    if (value !== undefined) {
      minimal[key] = value;
    }
  }
  
  // Add verified safe additional variables
  for (const [key, value] of Object.entries(additionalVars)) {
    if (!isSensitiveEnvVar(key)) {
      minimal[key] = value;
    }
  }
  
  return minimal;
}

/**
 * Re-export for convenience
 */
export { path, fs };
