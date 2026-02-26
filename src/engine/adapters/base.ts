/**
 * Base Engine Adapter Interface
 * 
 * All engine adapters must implement this interface.
 * 
 * @module engine/adapters/base
 */

import {
  ExecRequest,
  ExecResult,
  EngineHealth,
  EngineCapabilities,
  DualRunResult,
} from '../contract';

/**
 * Base interface for all engine adapters
 */
export interface EngineAdapter {
  /** Adapter name */
  readonly name: string;
  
  /** Engine type */
  readonly engineType: string;
  
  /**
   * Execute a decision request
   */
  execute(request: ExecRequest): Promise<ExecResult>;
  
  /**
   * Check engine health
   */
  health(): Promise<EngineHealth>;
  
  /**
   * Get engine capabilities
   */
  capabilities(): Promise<EngineCapabilities>;
  
  /**
   * Get engine version
   */
  version(): Promise<string>;
  
  /**
   * Initialize the adapter (optional)
   */
  initialize?(): Promise<void>;
  
  /**
   * Shutdown the adapter (optional)
   */
  shutdown?(): Promise<void>;
}

/**
 * Interface for adapters that support dual-run mode
 */
export interface DualRunAdapter extends EngineAdapter {
  /**
   * Execute with dual-run comparison
   */
  executeDual(request: ExecRequest): Promise<DualRunResult>;
}

/**
 * Interface for adapters that support daemon mode
 */
export interface DaemonAdapter extends EngineAdapter {
  /**
   * Start daemon if not running
   */
  startDaemon(): Promise<void>;
  
  /**
   * Stop daemon
   */
  stopDaemon(): Promise<void>;
  
  /**
   * Check if daemon is running
   */
  isDaemonRunning(): Promise<boolean>;
}

/**
 * Base class with common adapter functionality
 */
export abstract class BaseEngineAdapter implements EngineAdapter {
  abstract readonly name: string;
  abstract readonly engineType: string;
  
  protected isInitialized = false;
  protected isHealthy = false;
  
  abstract execute(request: ExecRequest): Promise<ExecResult>;
  abstract health(): Promise<EngineHealth>;
  abstract capabilities(): Promise<EngineCapabilities>;
  abstract version(): Promise<string>;
  
  async initialize(): Promise<void> {
    this.isInitialized = true;
  }
  
  async shutdown(): Promise<void> {
    this.isInitialized = false;
  }
  
  /**
   * Validate request before execution
   */
  protected validateRequest(request: ExecRequest): void {
    if (!request.requestId) {
      throw new Error('Request ID is required');
    }
    
    if (!request.params) {
      throw new Error('Execution params are required');
    }
    
    if (!request.params.actions || request.params.actions.length === 0) {
      throw new Error('At least one action is required');
    }
    
    if (!request.params.states || request.params.states.length === 0) {
      throw new Error('At least one state is required');
    }
    
    if (!request.params.outcomes) {
      throw new Error('Outcomes are required');
    }
  }
  
  /**
   * Measure execution time of a function
   */
  protected async measureExecutionTime<T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; durationMs: number }> {
    const start = Date.now();
    const result = await fn();
    const durationMs = Date.now() - start;
    return { result, durationMs };
  }
}
