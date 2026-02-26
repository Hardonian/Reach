/**
 * Requiem Engine Adapter
 * 
 * Provides integration with the Requiem CLI decision engine.
 * Uses process spawning to execute Requiem commands.
 * 
 * @module engine/adapters/requiem
 */

import { ExecRequest, ExecResult } from '../contract';
import { toRequiemFormat, fromRequiemFormat } from '../translate';
import { BaseEngineAdapter, ProcessSemaphore, getSemaphore } from './base';
import { spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFile = promisify(require('child_process').execFile);

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
}

/**
 * Requiem CLI Engine Adapter
 * 
 * Spawns the Requiem CLI as a subprocess to execute decisions.
 * Uses semaphore to limit concurrent executions.
 */
export class RequiemEngineAdapter extends BaseEngineAdapter {
  private cliPath: string;
  private timeout: number;
  private isConfigured = false;
  
  /**
   * Create a new Requiem engine adapter
   * 
   * @param config - Optional configuration
   */
  constructor(config: RequiemConfig = {}) {
    super(); // Initialize base class with semaphore
    
    this.cliPath = config.cliPath || 'requiem';
    this.timeout = config.timeout || 30000;
  }
  
  /**
   * Check if the engine is ready
   */
  isReady(): boolean {
    return this.isConfigured;
  }
  
  /**
   * Configure the adapter (e.g., verify CLI is available)
   */
  async configure(): Promise<boolean> {
    try {
      // Try to get version to verify CLI is available
      const result = await execFile(this.cliPath, ['--version'], {
        timeout: 5000,
      });
      this.isConfigured = result.stdout.includes('requiem') || result.stderr.includes('requiem');
      return this.isConfigured;
    } catch {
      this.isConfigured = false;
      return false;
    }
  }
  
  /**
   * Evaluate a decision request using Requiem CLI
   * Uses semaphore to limit concurrent executions and seed for determinism
   * 
   * @param request - The execution request
   * @returns The execution result
   */
  async evaluate(request: ExecRequest): Promise<ExecResult> {
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
    
    // Convert request to Requiem format (includes seed)
    const requestJson = toRequiemFormat(request);
    
    const startTime = performance.now();
    
    try {
      // Spawn Requiem CLI process
      const result = await this.spawnRequiem(requestJson);
      const durationMs = Math.round(performance.now() - startTime);
      
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
      
      const proc = spawn(this.cliPath, ['evaluate', '-'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout,
      });
      
      proc.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      proc.stderr.on('data', (chunk: Buffer) => {
        // Log stderr but don't fail
        console.warn('Requiem stderr:', chunk.toString());
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
   * Validate that input is compatible with Requiem
   */
  validateInput(request: ExecRequest): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!request.requestId) {
      errors.push('requestId is required');
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
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
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
