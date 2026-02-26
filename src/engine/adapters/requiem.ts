/**
 * Requiem Engine Adapter
 * 
 * Provides integration with the Requiem CLI decision engine.
 * Uses process spawning to execute Requiem commands with security hardening.
 * 
 * SECURITY HARDENING (v1.2):
 * - Binary trust verification (version lock, path validation)
 * - Environment sanitization (secrets filtered from child process)
 * - Resource limits enforcement (request size, memory, concurrent processes)
 * - Path traversal protection
 * 
 * @module engine/adapters/requiem
 */

import { ExecRequest, ExecResult } from '../contract';
import { toRequiemFormat, fromRequiemFormat } from '../translate';
import { BaseEngineAdapter } from './base';
import { spawn, execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFile = promisify(execFileCb);

/**
 * Configuration for the Requiem engine adapter
 */
export interface RequiemConfig {
  /**
   * Path to the Requiem CLI executable
   */
  cliPath?: string;
  
  /**
   * Timeout for each execution in milliseconds
   */
  timeout?: number;
  
  /**
   * Expected Requiem version (semver range)
   * If provided, binary trust check will enforce version match
   */
  expectedVersion?: string;
  
  /**
   * Allow unknown/unverified engine binaries
   * WARNING: Only enable in development/testing
   */
  allowUnknownEngine?: boolean;
  
  /**
   * Maximum request size in bytes (default: 10MB)
   */
  maxRequestBytes?: number;
  
  /**
   * Maximum matrix dimensions (actions × states)
   * Prevents OOM from huge decision matrices
   */
  maxMatrixCells?: number;
}

/**
 * Environment variable patterns that are secrets and should be filtered
 */
const SECRET_ENV_PATTERNS = [
  /^REACH_ENCRYPTION_KEY/i,
  /_TOKEN$/i,
  /_SECRET$/i,
  /_KEY$/i,
  /^AUTH/i,
  /^COOKIE/i,
  /^SESSION/i,
  /PASSWORD/i,
  /CREDENTIAL/i,
  /PRIVATE/i,
  /API_KEY/i,
  /ACCESS_KEY/i,
];

/**
 * Environment variables that are safe to pass to child processes
 */
const SAFE_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'PWD',
  'NODE_ENV',
  'REACH_ENV',
  'REACH_LOG_LEVEL',
];

/**
 * Result of binary trust verification
 */
interface BinaryTrustResult {
  trusted: boolean;
  reason?: string;
  version?: string;
  path: string;
}

/**
 * Requiem CLI Engine Adapter
 * 
 * Spawns the Requiem CLI as a subprocess to execute decisions.
 * Uses semaphore to limit concurrent executions.
 * Implements security hardening for production use.
 */
export class RequiemEngineAdapter extends BaseEngineAdapter {
  private cliPath: string;
  private timeout: number;
  private isConfigured = false;
  private config: RequiemConfig;
  private binaryTrustVerified = false;
  private verifiedBinaryPath?: string;
  
  /**
   * Create a new Requiem engine adapter
   * 
   * @param config - Optional configuration with security options
   */
  constructor(config: RequiemConfig = {}) {
    super(); // Initialize base class with semaphore
    
    this.config = {
      maxRequestBytes: 10 * 1024 * 1024, // 10MB default
      maxMatrixCells: 1_000_000, // 1M cells default (e.g., 1000x1000)
      ...config,
    };
    
    this.cliPath = config.cliPath || this.resolveCliPath();
    this.timeout = config.timeout || 30000;
  }
  
  /**
   * Resolve the Requiem CLI path with security checks
   */
  private resolveCliPath(): string {
    // Priority 1: Check for embedded binary in node_modules/.bin
    const embeddedPaths = [
      path.join(process.cwd(), 'node_modules', '.bin', 'requiem'),
      path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'requiem'),
      path.join(__dirname, '..', '..', '..', '.bin', 'requiem'),
    ];
    
    for (const p of embeddedPaths) {
      if (this.isExecutable(p)) {
        return p;
      }
    }
    
    // Priority 2: Check REQUIEM_BIN environment variable
    const envPath = process.env.REQUIEM_BIN;
    if (envPath) {
      // Path will be validated during configure()
      return envPath;
    }
    
    // Priority 3: Fallback to PATH lookup
    return 'requiem';
  }
  
  /**
   * Check if a path is an executable regular file
   */
  private isExecutable(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) return false;
      
      // Check if executable (Unix only)
      if (process.platform !== 'win32') {
        const mode = stats.mode;
        return (mode & 0o111) !== 0; // Any execute bit set
      }
      
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Verify binary trust (version lock, path validation, permissions)
   */
  private async verifyBinaryTrust(): Promise<BinaryTrustResult> {
    const result: BinaryTrustResult = { trusted: false, path: this.cliPath };
    
    try {
      // Check if file exists and is executable
      if (!this.isExecutable(this.cliPath)) {
        // Try to resolve via PATH
        if (this.cliPath === 'requiem') {
          // Will be resolved by spawn
          result.trusted = true; // Defer to system PATH
          return result;
        }
        
        result.reason = 'binary_not_executable';
        return result;
      }
      
      // Check file permissions (Unix: reject if writable by group/others)
      if (process.platform !== 'win32') {
        try {
          const stats = fs.statSync(this.cliPath);
          const mode = stats.mode;
          // Check if writable by group or others (unsafe)
          if ((mode & 0o022) !== 0) {
            result.reason = 'binary_world_writable';
            return result;
          }
        } catch {
          // Continue if stat fails
        }
      }
      
      // Version verification
      try {
        const versionResult = await execFile(this.cliPath, ['--version'], {
          timeout: 5000,
          env: this.buildSanitizedEnv(), // Use sanitized env for version check
        });
        
        const versionOutput = versionResult.stdout + versionResult.stderr;
        const versionMatch = versionOutput.match(/requiem[\s/]+v?(\d+\.\d+\.?\d*)/i);
        
        if (versionMatch) {
          result.version = versionMatch[1];
          
          // Check against expected version if specified
          if (this.config.expectedVersion && result.version) {
            if (!this.versionMatches(result.version, this.config.expectedVersion)) {
              result.reason = `version_mismatch: expected ${this.config.expectedVersion}, got ${result.version}`;
              return result;
            }
          }
        }
      } catch {
        // Version check failed
        if (!this.config.allowUnknownEngine) {
          result.reason = 'version_check_failed';
          return result;
        }
      }
      
      result.trusted = true;
      this.verifiedBinaryPath = this.cliPath;
      return result;
    } catch (error) {
      result.reason = `verification_error: ${error instanceof Error ? error.message : String(error)}`;
      return result;
    }
  }
  
  /**
   * Check if version matches expected semver range (simplified)
   */
  private versionMatches(version: string, expected: string): boolean {
    // Simple semver comparison - supports exact match or "1.x" style
    if (expected.includes('x') || expected.includes('*')) {
      const expectedPrefix = expected.split(/[x*]/)[0];
      return version.startsWith(expectedPrefix);
    }
    return version === expected || version.startsWith(expected + '.');
  }
  
  /**
   * Build sanitized environment for child process
   * Filters out secrets and sensitive data
   */
  private buildSanitizedEnv(): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    // Always include safe allowlist variables if they exist
    for (const key of SAFE_ENV_ALLOWLIST) {
      if (process.env[key] !== undefined) {
        sanitized[key] = process.env[key] as string;
      }
    }
    
    // Filter out secrets from all environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      
      // Skip if already added from allowlist
      if (key in sanitized) continue;
      
      // Check against secret patterns
      let isSecret = false;
      for (const pattern of SECRET_ENV_PATTERNS) {
        if (pattern.test(key)) {
          isSecret = true;
          break;
        }
      }
      
      if (!isSecret) {
        sanitized[key] = value;
      }
    }
    
    // Add deterministic mode markers
    sanitized.REACH_SANDBOX_MODE = '1';
    sanitized.PYTHONHASHSEED = '0'; // Ensure Python determinism
    
    return sanitized;
  }
  
  /**
   * Check if the engine is ready
   */
  isReady(): boolean {
    return this.isConfigured && this.binaryTrustVerified;
  }
  
  /**
   * Configure the adapter (e.g., verify CLI is available and trusted)
   */
  async configure(): Promise<boolean> {
    try {
      // Verify binary trust
      const trustResult = await this.verifyBinaryTrust();
      
      if (!trustResult.trusted) {
        if (this.config.allowUnknownEngine) {
          console.warn(`Requiem binary trust warning: ${trustResult.reason}. Continuing due to allowUnknownEngine=true`);
          this.binaryTrustVerified = true;
        } else {
          console.error(`Requiem binary trust failed: ${trustResult.reason}`);
          this.isConfigured = false;
          this.binaryTrustVerified = false;
          return false;
        }
      } else {
        this.binaryTrustVerified = true;
      }
      
      this.isConfigured = true;
      return true;
    } catch {
      this.isConfigured = false;
      this.binaryTrustVerified = false;
      return false;
    }
  }
  
  /**
   * Validate request against resource limits
   */
  private validateRequestLimits(request: ExecRequest): { valid: boolean; error?: string } {
    // Check matrix size limits
    const numActions = request.params.actions.length;
    const numStates = request.params.states.length;
    const matrixCells = numActions * numStates;
    
    if (this.config.maxMatrixCells && matrixCells > this.config.maxMatrixCells) {
      return {
        valid: false,
        error: `matrix_too_large: ${matrixCells} cells exceeds limit of ${this.config.maxMatrixCells}`,
      };
    }
    
    // Check request size (estimate)
    const requestJson = JSON.stringify(request);
    if (this.config.maxRequestBytes && requestJson.length > this.config.maxRequestBytes) {
      return {
        valid: false,
        error: `request_too_large: ${requestJson.length} bytes exceeds limit of ${this.config.maxRequestBytes}`,
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Evaluate a decision request using Requiem CLI
   * Uses semaphore to limit concurrent executions and seed for determinism
   * 
   * @param request - The execution request
   * @returns The execution result
   */
  async evaluate(request: ExecRequest): Promise<ExecResult> {
    // Validate resource limits before acquiring semaphore
    const limitCheck = this.validateRequestLimits(request);
    if (!limitCheck.valid) {
      return {
        requestId: request.requestId,
        status: 'error',
        recommendedAction: '',
        ranking: [],
        trace: { algorithm: request.params.algorithm },
        fingerprint: '',
        meta: {
          engine: 'requiem',
          engineVersion: 'unknown',
          durationMs: 0,
          completedAt: new Date().toISOString(),
        },
        error: limitCheck.error,
      };
    }
    
    // Use semaphore protection and ensure seed is derived
    return this.executeWithSemaphore(request, async (req) => {
      return this.doEvaluate(req);
    });
  }
  
  /**
   * Internal evaluation logic (called within semaphore)
   */
  private async doEvaluate(request: ExecRequest): Promise<ExecResult> {
    if (!this.isConfigured) {
      await this.configure();
      if (!this.isConfigured) {
        throw new Error('Requiem CLI not configured. Call configure() first.');
      }
    }
    
    if (!this.binaryTrustVerified && !this.config.allowUnknownEngine) {
      throw new Error('Requiem binary trust verification failed. Set allowUnknownEngine=true to override (not recommended for production).');
    }
    
    // Convert request to Requiem format (includes seed)
    const requestJson = toRequiemFormat(request);
    
    const startTime = performance.now();
    
    try {
      // Spawn Requiem CLI process with sanitized environment
      const result = await this.spawnRequiem(requestJson);
      // Parse result
      return fromRequiemFormat(result, request.requestId);
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      
      // Return error result
      return {
        requestId: request.requestId,
        status: 'error',
        recommendedAction: '',
        ranking: [],
        trace: {
          algorithm: request.params.algorithm,
        },
        fingerprint: '',
        meta: {
          engine: 'requiem',
          engineVersion: 'unknown',
          durationMs,
          completedAt: new Date().toISOString(),
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Spawn Requiem CLI and get result
   */
  private async spawnRequiem(inputJson: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      // Use verified binary path if available
      const binaryPath = this.verifiedBinaryPath || this.cliPath;
      
      const proc = spawn(binaryPath, ['evaluate', '-'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout,
        env: this.buildSanitizedEnv(), // SECURITY: Use sanitized environment
      });
      
      proc.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      proc.stderr.on('data', (chunk: Buffer) => {
        // Log stderr but don't fail
        const stderrText = chunk.toString();
        // Filter out any potential secrets from stderr
        const sanitizedStderr = this.sanitizeLogOutput(stderrText);
        console.warn('Requiem stderr:', sanitizedStderr);
      });
      
      proc.on('error', (error) => {
        reject(new Error(`Failed to spawn Requiem CLI: ${error.message}`));
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks).toString());
        } else {
          reject(new Error(`Requiem CLI exited with code ${code}`));
        }
      });
      
      // Write input to stdin
      proc.stdin.write(inputJson);
      proc.stdin.end();
    });
  }
  
  /**
   * Sanitize log output to prevent secret leakage
   */
  private sanitizeLogOutput(output: string): string {
    // Simple secret redaction - replace potential secrets with [REDACTED]
    let sanitized = output;
    
    // Redact patterns that look like keys/tokens
    const secretPatterns = [
      /[a-zA-Z0-9_-]{20,}/g, // Long alphanumeric strings (likely keys)
    ];
    
    for (const pattern of secretPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return sanitized;
  }
  
  /**
   * Validate that input is compatible with Requiem
   */
  validateInput(request: ExecRequest): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!request.requestId) {
      errors.push('requestId is required');
    }
    
    // Validate requestId format (prevent path traversal)
    if (request.requestId) {
      const sanitized = this.sanitizeRequestId(request.requestId);
      if (sanitized !== request.requestId) {
        errors.push('requestId contains invalid characters (path traversal attempt detected)');
      }
    }
    
    if (!request.params) {
      errors.push('params is required');
    } else {
      if (!request.params.algorithm) {
        errors.push('algorithm is required');
      }
      if (!request.params.actions || request.params.actions.length === 0) {
        errors.push('at least one action is required');
      }
      if (!request.params.states || request.params.states.length === 0) {
        errors.push('at least one state is required');
      }
      if (!request.params.outcomes) {
        errors.push('outcomes is required');
      }
      
      // Check matrix size
      const limitCheck = this.validateRequestLimits(request);
      if (!limitCheck.valid) {
        errors.push(limitCheck.error || 'request exceeds resource limits');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  
  /**
   * Sanitize requestId to prevent path traversal
   */
  private sanitizeRequestId(requestId: string): string {
    // Allow only alphanumeric, dash, underscore, dot
    // Replace any other characters with underscore
    return requestId.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 64);
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let requiemEngineInstance: RequiemEngineAdapter | undefined;

/**
 * Get or create the singleton Requiem engine adapter
 */
export function getRequiemEngine(config?: RequiemConfig): RequiemEngineAdapter {
  if (!requiemEngineInstance) {
    requiemEngineInstance = new RequiemEngineAdapter(config);
  }
  return requiemEngineInstance;
}

/**
 * Initialize the Requiem engine with configuration
 */
export async function initRequiemEngine(config?: RequiemConfig): Promise<RequiemEngineAdapter> {
  const engine = getRequiemEngine(config);
  await engine.configure();
  return engine;
}

/**
 * Safely evaluate a decision using the Requiem engine
 * Returns null if engine is not available
 */
export async function evaluateWithRequiem(
  request: ExecRequest,
  config?: RequiemConfig,
): Promise<ExecResult | null> {
  try {
    const engine = getRequiemEngine(config);
    
    if (!engine.isReady()) {
      await engine.configure();
    }
    
    return await engine.evaluate(request);
  } catch (error) {
    console.error('Requiem engine evaluation failed:', error);
    return null;
  }
}

// Re-export security utilities for testing
export const __security__ = {
  SECRET_ENV_PATTERNS,
  SAFE_ENV_ALLOWLIST,
};
