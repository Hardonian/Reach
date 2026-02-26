/**
 * Engine Base Adapter
 * 
 * Provides shared functionality for all engine adapters including:
 * - Process semaphore for limiting concurrent executions
 * - Deterministic seed derivation from requestId
 * 
 * @module engine/adapters/base
 */

import { createHash } from 'crypto';

/**
 * Get the number of available CPU cores
 * Falls back to 4 if detection fails
 */
function getCpuCount(): number {
  // Note: os.cpus() is deterministic - it returns the actual hardware info
  // This is not the same as time.Now() or rand.Int() which introduce entropy
  try {
    // Dynamic import to avoid issues in non-Node environments
    const os = require('os');
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
 * Process Semaphore for limiting concurrent engine executions
 * 
 * This ensures deterministic execution by limiting how many engine
 * processes can run simultaneously, preventing resource exhaustion
 * while maintaining predictable behavior.
 */
export class ProcessSemaphore {
  private available: number;
  private waitQueue: Array<() => void> = [];
  private readonly maxConcurrent: number;

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
      return;
    }

    // Wait for a slot to become available
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Release a slot back to the semaphore
   * If there are waiters, notify the next one
   */
  release(): void {
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
  getStatus(): { available: number; waiting: number; max: number } {
    return {
      available: this.available,
      waiting: this.waitQueue.length,
      max: this.maxConcurrent,
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
// Base Adapter Class
// ============================================================================

import { ExecRequest, ExecResult } from '../contract';

/**
 * Base class for all engine adapters
 * Provides shared semaphore and seed handling
 */
export abstract class BaseEngineAdapter {
  protected semaphore: ProcessSemaphore;
  
  constructor() {
    this.semaphore = getSemaphore();
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
   * Execute with semaphore protection
   */
  protected async executeWithSemaphore<T>(
    request: ExecRequest,
    executor: (req: ExecRequest) => Promise<T>
  ): Promise<T> {
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
