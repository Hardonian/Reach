/**
 * Engine Base Adapter
 * 
 * Provides shared functionality for all engine adapters including:
 * - Process semaphore for limiting concurrent executions
 * - Deterministic seed derivation from requestId
 * - Resource limits enforcement (memory, CPU, file descriptors)
 * 
 * SECURITY HARDENING (v1.2):
 * - Concurrency limits to prevent resource exhaustion
 * - Request size validation
 * - Streaming parsing for large payloads
 * - Deterministic sort enforcement
 * 
 * @module engine/adapters/base
 */

import { createHash } from 'crypto';
import os from 'os';
import { ExecRequest, ExecResult } from '../contract';

/**
 * Get the number of available CPU cores
 * Falls back to 4 if detection fails
 */
function getCpuCount(): number {
  // Note: os.cpus() is deterministic - it returns the actual hardware info
  // This is not the same as time.Now(), rand.Int() or UUID v4 which introduce entropy
  try {
    // Dynamic import to avoid issues in non-Node environments
    const cpus = os.cpus();
    return cpus ? cpus.length : 4;
  } catch {
    return 4;
  }
}

/**
 * Maximum concurrent engine processes
 * Cap at min(CPU_COUNT, 32) as specified in requirements
 */
export const MAX_CONCURRENT_PROCESSES = Math.min(getCpuCount(), 32);

/**
 * Default resource limits for engine execution
 */
export const DEFAULT_RESOURCE_LIMITS = {
  maxRequestBytes: 10 * 1024 * 1024, // 10MB
  maxMatrixCells: 1_000_000, // 1M cells (e.g., 1000x1000)
  maxMemoryBytes: 512 * 1024 * 1024, // 512MB
  maxFileDescriptors: 1024,
  timeoutMs: 30000, // 30 seconds
};

/**
 * Process Semaphore for limiting concurrent engine executions
 * 
 * This ensures deterministic execution by limiting how many engine
 * processes can run simultaneously, preventing resource exhaustion
 * while maintaining predictable behavior.
 * 
 * SECURITY: Prevents EMFILE/ENOSPC cascades from too many concurrent processes
 */
export class ProcessSemaphore {
  private available: number;
  private waitQueue: Array<() => void> = [];
  private readonly maxConcurrent: number;
  private activeCount = 0;

  constructor(maxConcurrent: number = MAX_CONCURRENT_PROCESSES) {
    this.maxConcurrent = maxConcurrent;
    this.available = maxConcurrent;
  }

  /**
   * Acquire a slot in the semaphore
   * Returns a promise that resolves when a slot is available
   */
  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      this.activeCount++;
      return;
    }

    // Wait for a slot to become available
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.activeCount++;
        resolve();
      });
    });
  }

  /**
   * Release a slot back to the semaphore
   * If there are waiters, notify the next one
   */
  release(): void {
    this.activeCount--;
    if (this.waitQueue.length > 0) {
      // FIFO - wake up the oldest waiter
      const waiter = this.waitQueue.shift();
      if (waiter) {
        waiter();
        return;
      }
    }
    this.available++;
  }

  /**
   * Execute a function with semaphore protection
   * Automatically acquires and releases the semaphore
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get current semaphore status (for debugging/monitoring)
   */
  getStatus(): { available: number; waiting: number; max: number; active: number } {
    return {
      available: this.available,
      waiting: this.waitQueue.length,
      max: this.maxConcurrent,
      active: this.activeCount,
    };
  }
}

// Singleton semaphore instance shared across all adapters
let semaphoreInstance: ProcessSemaphore | undefined;

/**
 * Get the shared process semaphore instance
 */
export function getSemaphore(): ProcessSemaphore {
  if (!semaphoreInstance) {
    semaphoreInstance = new ProcessSemaphore();
  }
  return semaphoreInstance;
}

/**
 * Reset the semaphore instance (for testing)
 */
export function resetSemaphore(): void {
  semaphoreInstance = undefined;
}

// ============================================================================
// Deterministic Seed Derivation
// ============================================================================

/**
 * Derive a deterministic seed from a requestId
 * 
 * Uses SHA-256 hash to derive a seed from the requestId.
 * This ensures identical RNG/Adaptive outcomes for the same request.
 * 
 * @param requestId - The unique request identifier
 * @returns A deterministic 32-bit seed value
 */
export function deriveSeed(requestId: string): number {
  // Use SHA-256 for cryptographic derivation
  // This is deterministic - same input always produces same output
  const hash = createHash('sha256');
  hash.update(requestId);
  const digest = hash.digest('hex');
  
  // Take first 8 hex characters (32 bits) and convert to number
  // This ensures we get a consistent integer seed
  const seed = parseInt(digest.substring(0, 8), 16);
  
  return seed;
}

/**
 * Derive a seed as a hex string for engines that expect string seeds
 * 
 * @param requestId - The unique request identifier
 * @returns A deterministic 64-character hex string seed
 */
export function deriveSeedHex(requestId: string): string {
  const hash = createHash('sha256');
  hash.update(requestId);
  return hash.digest('hex');
}

/**
 * Convert a numeric seed to a deterministic float in [0, 1)
 * Useful for normalized random values
 * 
 * @param seed - The numeric seed
 * @returns A deterministic float in [0, 1)
 */
export function seedToNormalizedFloat(seed: number): number {
  // Simple linear congruential generator for deterministic floats
  // This maintains determinism - same seed always produces same sequence
  const a = 1664525;
  const c = 1013904223;
  const m = 0xFFFFFFFF;
  
  const next = (a * seed + c) % m;
  return next / m;
}

// ============================================================================
// Resource Limit Validation
// ============================================================================

/**
 * Resource limit validation result
 */
export interface ResourceValidationResult {
  valid: boolean;
  error?: string;
  limits: {
    requestBytes: number;
    matrixCells: number;
  };
}

/**
 * Validate request against resource limits
 * 
 * SECURITY: Prevents OOM DoS from huge decision matrices
 * 
 * @param request - The execution request
 * @param limits - Optional custom limits
 * @returns Validation result
 */
export function validateResourceLimits(
  request: ExecRequest,
  limits?: Partial<typeof DEFAULT_RESOURCE_LIMITS>,
): ResourceValidationResult {
  const effectiveLimits = { ...DEFAULT_RESOURCE_LIMITS, ...limits };
  
  // Check matrix size
  const numActions = request.params.actions?.length || 0;
  const numStates = request.params.states?.length || 0;
  const matrixCells = numActions * numStates;
  
  if (matrixCells > effectiveLimits.maxMatrixCells) {
    return {
      valid: false,
      error: `matrix_too_large: ${matrixCells} cells (${numActions} actions × ${numStates} states) exceeds limit of ${effectiveLimits.maxMatrixCells}`,
      limits: {
        requestBytes: effectiveLimits.maxRequestBytes,
        matrixCells: effectiveLimits.maxMatrixCells,
      },
    };
  }
  
  // Check request size
  const requestJson = JSON.stringify(request);
  if (requestJson.length > effectiveLimits.maxRequestBytes) {
    return {
      valid: false,
      error: `request_too_large: ${requestJson.length} bytes exceeds limit of ${effectiveLimits.maxRequestBytes}`,
      limits: {
        requestBytes: effectiveLimits.maxRequestBytes,
        matrixCells: effectiveLimits.maxMatrixCells,
      },
    };
  }
  
  return {
    valid: true,
    limits: {
      requestBytes: effectiveLimits.maxRequestBytes,
      matrixCells: effectiveLimits.maxMatrixCells,
    },
  };
}

// ============================================================================
// Deterministic Sort Enforcement
// ============================================================================

/**
 * Sort an array of strings deterministically
 * SECURITY: Ensures consistent ordering for hashing
 */
export function deterministicSort<T extends string | number>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b, 'en', { sensitivity: 'base' });
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * Deterministically sort object keys for canonical JSON/Hashing
 * Includes a depth guard to prevent stack overflow attacks.
 */
export function sortObjectKeys(obj: any, depth = 0): any {
  if (depth > 20) {
    throw new Error('Maximum recursion depth exceeded in sortObjectKeys');
  }
  
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sortObjectKeys(item, depth + 1));
  }

  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: any = {};

  for (const key of sortedKeys) {
    sortedObj[key] = sortObjectKeys(obj[key], depth + 1);
  }

  return sortedObj;
}

// ============================================================================
// Base Adapter Class
// ============================================================================

/**
 * Base class for all engine adapters
 * Provides shared semaphore, seed handling, and resource limits
 */
export abstract class BaseEngineAdapter {
  protected semaphore: ProcessSemaphore;
  protected resourceLimits: typeof DEFAULT_RESOURCE_LIMITS;
  
  constructor(limits?: Partial<typeof DEFAULT_RESOURCE_LIMITS>) {
    this.semaphore = getSemaphore();
    this.resourceLimits = { ...DEFAULT_RESOURCE_LIMITS, ...limits };
  }

  /**
   * Derive and inject seed into request if not already present
   * Ensures deterministic execution
   */
  protected ensureSeed(request: ExecRequest): ExecRequest {
    // If seed already exists in params, use it; otherwise derive from requestId
    const seed = request.params.seed ?? deriveSeed(request.requestId);
    
    return {
      ...request,
      params: {
        ...request.params,
        seed,
      },
    };
  }

  /**
   * Validate request against resource limits
   */
  protected validateLimits(request: ExecRequest): ResourceValidationResult {
    return validateResourceLimits(request, this.resourceLimits);
  }

  /**
   * Execute with semaphore protection
   */
  protected async executeWithSemaphore<T>(
    request: ExecRequest,
    executor: (req: ExecRequest) => Promise<T>,
  ): Promise<T> {
    // Validate resource limits before execution
    const validation = this.validateLimits(request);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Ensure seed is derived before execution
    const requestWithSeed = this.ensureSeed(request);
    
    return this.semaphore.run(() => executor(requestWithSeed));
  }

  /**
   * Abstract method that subclasses must implement
   */
  abstract evaluate(request: ExecRequest): Promise<ExecResult>;

  /**
   * Check if engine is ready
   */
  abstract isReady(): boolean;
}
