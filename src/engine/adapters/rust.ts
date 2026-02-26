/**
 * Rust Engine Adapter
 * 
 * Wraps the existing Rust/WASM decision engine.
 * Maintains compatibility with existing Rust engine integration.
 * 
 * @module engine/adapters/rust
 */

import { BaseEngineAdapter } from './base';
import {
  ExecRequest,
  ExecResult,
  EngineHealth,
  EngineCapabilities,
  EngineType,
} from '../contract';
import { createEngineError, mapEngineError } from '../errors';
import {
  toRustFormat,
  fromRustFormat,
  decisionInputToExecRequest,
  execResultToDecisionOutput,
} from '../translate';

// Import the existing Rust/WASM integration
// This uses the fallback.ts implementation which mirrors Rust logic
import { evaluateDecisionFallback, DecisionInput } from '../../lib/fallback';

/**
 * Rust Engine Adapter
 * 
 * Uses the TypeScript fallback implementation that mirrors the Rust engine logic.
 * When WASM is available, this can be swapped to use the WASM module.
 */
export class RustEngineAdapter extends BaseEngineAdapter {
  readonly name = 'RustEngine';
  readonly engineType: EngineType = 'rust';
  
  private wasmModule: typeof import('../../rust/lib') | null = null;
  private useWasm = false;
  
  async initialize(): Promise<void> {
    // Try to load WASM module if available
    try {
      // Dynamic import to avoid breaking if WASM not built
      const wasm = await import('../../rust/lib');
      this.wasmModule = wasm;
      this.useWasm = true;
      console.log('[RustEngine] WASM module loaded');
    } catch {
      console.log('[RustEngine] WASM not available, using TS fallback');
      this.useWasm = false;
    }
    
    this.isInitialized = true;
  }
  
  async execute(request: ExecRequest): Promise<ExecResult> {
    this.validateRequest(request);
    
    const startTime = Date.now();
    
    try {
      // Convert to legacy format for existing engine
      const legacyInput: DecisionInput = {
        actions: request.params.actions,
        states: request.params.states,
        outcomes: request.params.outcomes,
        algorithm: request.params.algorithm,
        weights: request.params.weights,
        strict: request.params.strict,
        temperature: request.params.temperature,
        optimism: request.params.optimism,
        confidence: request.params.confidence,
        iterations: request.params.iterations,
        epsilon: request.params.epsilon,
      };
      
      let result: ExecResult;
      
      if (this.useWasm && this.wasmModule) {
        // Use WASM engine
        result = await this.executeWasm(legacyInput, request.requestId, startTime);
      } else {
        // Use TypeScript fallback
        result = await this.executeFallback(legacyInput, request.requestId, startTime);
      }
      
      this.isHealthy = true;
      return result;
      
    } catch (error) {
      this.isHealthy = false;
      const engineError = mapEngineError(error);
      throw new Error(JSON.stringify(engineError));
    }
  }
  
  private async executeWasm(
    input: DecisionInput,
    requestId: string,
    startTime: number,
  ): Promise<ExecResult> {
    if (!this.wasmModule) {
      throw new Error('WASM module not loaded');
    }
    
    const jsonInput = JSON.stringify(input);
    const jsonOutput = this.wasmModule.evaluate_decision(jsonInput);
    const output = JSON.parse(jsonOutput);
    
    const durationMs = Date.now() - startTime;
    
    return {
      requestId,
      status: 'success',
      recommendedAction: output.recommended_action,
      ranking: output.ranking,
      trace: {
        algorithm: output.trace?.algorithm || 'unknown',
        regretTable: output.trace?.regret_table,
        maxRegret: output.trace?.max_regret,
        minUtility: output.trace?.min_utility,
        weightedScores: output.trace?.weighted_scores,
      },
      fingerprint: output.trace?.fingerprint || '',
      meta: {
        engine: 'rust',
        engineVersion: '0.3.1-wasm',
        durationMs,
        completedAt: new Date().toISOString(),
      },
    };
  }
  
  private async executeFallback(
    input: DecisionInput,
    requestId: string,
    startTime: number,
  ): Promise<ExecResult> {
    const output = await evaluateDecisionFallback(input);
    const durationMs = Date.now() - startTime;
    
    return {
      requestId,
      status: 'success',
      recommendedAction: output.recommended_action,
      ranking: output.ranking,
      trace: {
        algorithm: output.trace.algorithm,
        regretTable: output.trace.regret_table,
        maxRegret: output.trace.max_regret,
        minUtility: output.trace.min_utility,
        weightedScores: output.trace.weighted_scores,
      },
      fingerprint: output.trace.fingerprint || '',
      meta: {
        engine: 'rust',
        engineVersion: '0.3.1-ts',
        durationMs,
        completedAt: new Date().toISOString(),
      },
    };
  }
  
  async health(): Promise<EngineHealth> {
    try {
      // Quick health check by running a minimal decision
      const testRequest: ExecRequest = {
        requestId: 'health_check',
        timestamp: new Date().toISOString(),
        params: {
          algorithm: 'minimax_regret',
          actions: ['a1', 'a2'],
          states: ['s1'],
          outcomes: {
            a1: { s1: 1.0 },
            a2: { s1: 0.5 },
          },
        },
      };
      
      await this.execute(testRequest);
      
      this.isHealthy = true;
      return {
        healthy: true,
        engine: 'rust',
        version: await this.version(),
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.isHealthy = false;
      return {
        healthy: false,
        engine: 'rust',
        version: 'unknown',
        lastError: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      };
    }
  }
  
  async capabilities(): Promise<EngineCapabilities> {
    return {
      deterministicHashing: true,
      casSupport: false, // Rust engine doesn't support CAS directly
      replayValidation: true,
      sandboxing: false,
      windowsSupport: true,
      daemonMode: false,
      version: await this.version(),
    };
  }
  
  async version(): Promise<string> {
    if (this.useWasm) {
      return '0.3.1-wasm';
    }
    return '0.3.1-ts';
  }
}

/**
 * Create a Rust engine adapter instance
 */
export function createRustAdapter(): RustEngineAdapter {
  return new RustEngineAdapter();
}
