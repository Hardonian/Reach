/**
 * Protocol Engine Adapter
 * 
 * Provides integration with the Requiem engine via the binary protocol.
 * This is the default adapter that uses binary framed communication.
 * 
 * MERGE GATE COMPLIANT:
 * - Uses binary framed daemon by default
 * - HELLO negotiation enforces engine_version + protocol_version + hash_primitive=blake3
 * - Client fails closed on fallback hash backend
 * - Frame-normalized results (no stdout parsing)
 * 
 * FALLBACK: Only uses temp-file CLI in --protocol=json debug mode
 * 
 * @module engine/adapters/protocol
 */

import { ExecRequest, ExecResult } from '../contract';
import { BaseEngineAdapter } from './base';
import { 
  ProtocolClient, 
  ConnectionState,
  type ProtocolClientConfig 
} from '../../protocol/client';
import { 
  createHello,
  type ExecRequestPayload,
  type ExecResultPayload,
  ExecutionControls,
  Duration,
  type Workflow,
  type WorkflowStep,
  type Policy,
  type Decision,
} from '../../protocol/messages';
import { RequiemEngineAdapter } from './requiem';

/**
 * Configuration for the Protocol engine adapter
 */
export interface ProtocolAdapterConfig {
  /**
   * Protocol client configuration
   */
  client?: Partial<ProtocolClientConfig>;
  
  /**
   * Use JSON temp-file CLI instead of binary protocol
   * DEBUG ONLY: Not for production use
   */
  useJsonFallback?: boolean;
  
  /**
   * Requiem CLI path (only used if useJsonFallback=true)
   */
  cliPath?: string;
  
  /**
   * Expected engine version (semver)
   */
  expectedVersion?: string;
}

/**
 * Protocol Engine Adapter (Binary Framed)
 * 
 * This is the primary adapter that communicates with the Requiem engine
 * using the binary protocol over TCP sockets.
 * 
 * MERGE GATE: This adapter is the default and uses:
 * - Binary framed protocol (not temp files)
 * - CBOR encoding
 * - blake3 hash primitive
 * - Frame-level results (no stdout parsing)
 */
export class ProtocolEngineAdapter extends BaseEngineAdapter {
  private client: ProtocolClient | null = null;
  private config: ProtocolAdapterConfig;
  private isConnected = false;
  private fallbackAdapter: RequiemEngineAdapter | null = null;
  
  constructor(config: ProtocolAdapterConfig = {}) {
    super();
    this.config = {
      useJsonFallback: false,
      ...config,
    };
  }
  
  /**
   * Check if the engine is ready
   */
  isReady(): boolean {
    if (this.config.useJsonFallback && this.fallbackAdapter) {
      return this.fallbackAdapter.isReady();
    }
    return this.isConnected && this.client?.isReady === true;
  }
  
  /**
   * Configure and connect to the engine
   */
  async configure(): Promise<boolean> {
    // DEBUG MODE: Use JSON temp-file fallback if explicitly requested
    if (this.config.useJsonFallback) {
      console.warn('[ProtocolAdapter] DEBUG MODE: Using JSON temp-file fallback');
      this.fallbackAdapter = new RequiemEngineAdapter({
        cliPath: this.config.cliPath,
        expectedVersion: this.config.expectedVersion,
      });
      return this.fallbackAdapter.configure();
    }
    
    // NORMAL MODE: Use binary protocol
    try {
      const clientConfig: ProtocolClientConfig = {
        host: process.env.REACH_ENGINE_HOST?.split(':')[0] ?? '127.0.0.1',
        port: parseInt(process.env.REACH_ENGINE_HOST?.split(':')[1] ?? '9000', 10),
        connectTimeoutMs: 5000,
        requestTimeoutMs: 30000,
        autoReconnect: true,
        ...this.config.client,
      };
      
      this.client = new ProtocolClient(clientConfig);
      
      // Connect (performs HELLO negotiation)
      // This will fail if:
      // - Server doesn't support binary protocol
      // - Protocol version mismatch
      // - hash_version is not 'blake3'
      await this.client.connect();
      
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('[ProtocolAdapter] Failed to connect:', error);
      this.isConnected = false;
      return false;
    }
  }
  
  /**
   * Evaluate a decision request
   * 
   * Uses binary protocol by default. Only falls back to temp-file CLI
   * if useJsonFallback was explicitly set to true.
   */
  async evaluate(request: ExecRequest): Promise<ExecResult> {
    // Use fallback if in debug mode
    if (this.config.useJsonFallback && this.fallbackAdapter) {
      return this.fallbackAdapter.evaluate(request);
    }
    
    // Use semaphore protection and binary protocol
    return this.executeWithSemaphore(request, async (req) => {
      return this.doEvaluate(req);
    });
  }
  
  /**
   * Internal evaluation using binary protocol
   */
  private async doEvaluate(request: ExecRequest): Promise<ExecResult> {
    if (!this.client?.isReady) {
      throw new Error('Protocol client not connected. Call configure() first.');
    }
    
    // Convert ExecRequest to protocol format
    const protocolRequest = this.toProtocolRequest(request);
    
    // Execute via binary protocol
    const result = await this.client.execute(protocolRequest);
    
    // Convert result back to ExecResult
    return this.fromProtocolResult(result, request.requestId);
  }
  
  /**
   * Convert internal ExecRequest to protocol format
   */
  private toProtocolRequest(request: ExecRequest): ExecRequestPayload {
    // Derive seed for determinism
    const seed = request.params.seed ?? this.deriveSeed(request.requestId);
    
    // Convert steps to workflow format
    const steps: WorkflowStep[] = [];
    
    // Default policy: allow
    const policy: Policy = {
      rules: [],
      default_decision: { type: 'allow' } as Decision,
    };
    
    // Build execution controls
    const controls: ExecutionControls = {
      max_steps: undefined,
      step_timeout_us: Duration.fromSeconds(30),
      run_timeout_us: Duration.fromSeconds(300),
      budget_limit_usd: BigInt(0),
      min_step_interval_us: Duration.fromMillis(10),
    };
    
    const workflow: Workflow = {
      name: request.params.algorithm ?? 'default',
      version: '1.0.0',
      steps,
    };
    
    return {
      run_id: request.requestId,
      workflow,
      controls,
      policy,
      metadata: {
        algorithm: request.params.algorithm ?? 'unknown',
        actions: String(request.params.actions.length),
        states: String(request.params.states.length),
        seed: String(seed),
      },
    };
  }
  
  /**
   * Convert protocol result to internal ExecResult
   */
  private fromProtocolResult(result: ExecResultPayload, requestId: string): ExecResult {
    // Map protocol status to internal status
    let status: 'success' | 'error' | 'pending' = 'success';
    let error: string | undefined;
    
    if (result.status.type === 'failed') {
      status = 'error';
      error = result.status.reason;
    } else if (result.status.type === 'paused' || result.status.type === 'cancelled') {
      status = 'pending';
    }
    
    return {
      requestId,
      status,
      recommendedAction: this.extractRecommendedAction(result),
      ranking: this.extractRanking(result),
      trace: {
        algorithm: result.metadata?.algorithm ?? 'unknown',
        seed: parseInt(result.metadata?.seed ?? '0', 10),
      },
      fingerprint: result.result_digest, // blake3 digest from protocol
      meta: {
        engine: 'requiem',
        engineVersion: result.metadata?.engine_version ?? 'unknown',
        durationMs: Number(result.metrics.elapsed_us) / 1000,
        completedAt: new Date().toISOString(),
      },
      error,
    };
  }
  
  /**
   * Extract recommended action from result
   */
  private extractRecommendedAction(result: ExecResultPayload): string {
    if (result.final_action?.type === 'tool_call') {
      return result.final_action.tool_name;
    }
    return '';
  }
  
  /**
   * Extract ranking from result
   */
  private extractRanking(result: ExecResultPayload): Array<{
    actionId: string;
    expectedUtility: number;
    rank: number;
  }> {
    // Rankings are derived from events if available
    const rankings: Array<{
      actionId: string;
      expectedUtility: number;
      rank: number;
    }> = [];
    
    let rank = 1;
    for (const event of result.events) {
      if (event.event_type === 'action_selected' && event.payload?.action_id) {
        rankings.push({
          actionId: String(event.payload.action_id),
          expectedUtility: Number(event.payload.utility ?? 0),
          rank: rank++,
        });
      }
    }
    
    return rankings;
  }
  
  /**
   * Health check via protocol
   */
  async health(detailed: boolean = false): Promise<{
    healthy: boolean;
    version?: string;
    message?: string;
  }> {
    if (this.config.useJsonFallback && this.fallbackAdapter) {
      // Fallback: check if adapter is configured
      return {
        healthy: this.fallbackAdapter.isReady(),
        version: 'fallback',
      };
    }
    
    if (!this.client?.isReady) {
      return { healthy: false, message: 'Not connected' };
    }
    
    try {
      const health = await this.client.health(detailed);
      return {
        healthy: health.status.type === 'healthy',
        version: health.version,
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Disconnect from the engine
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
    this.fallbackAdapter = null;
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let protocolAdapterInstance: ProtocolEngineAdapter | undefined;

/**
 * Get or create the singleton Protocol engine adapter
 * 
 * By default, uses binary framed protocol.
 * Set REACH_PROTOCOL=json env var to use temp-file CLI (debug only).
 */
export function getProtocolEngine(config?: ProtocolAdapterConfig): ProtocolEngineAdapter {
  if (!protocolAdapterInstance) {
    // Check for debug mode from environment
    const useJsonFallback = process.env.REACH_PROTOCOL === 'json';
    if (useJsonFallback) {
      console.warn('[ProtocolEngine] DEBUG: Using JSON temp-file fallback');
    }
    
    protocolAdapterInstance = new ProtocolEngineAdapter({
      useJsonFallback,
      ...config,
    });
  }
  return protocolAdapterInstance;
}

/**
 * Initialize the Protocol engine with configuration
 */
export async function initProtocolEngine(config?: ProtocolAdapterConfig): Promise<ProtocolEngineAdapter> {
  const engine = getProtocolEngine(config);
  await engine.configure();
  return engine;
}

/**
 * Safely evaluate a decision using the Protocol engine
 * Returns null if engine is not available
 */
export async function evaluateWithProtocol(
  request: ExecRequest,
  config?: ProtocolAdapterConfig,
): Promise<ExecResult | null> {
  try {
    const engine = getProtocolEngine(config);
    
    if (!engine.isReady()) {
      const configured = await engine.configure();
      if (!configured) {
        return null;
      }
    }
    
    return await engine.evaluate(request);
  } catch (error) {
    console.error('Protocol engine evaluation failed:', error);
    return null;
  }
}

/**
 * Check if binary protocol is available
 */
export async function isProtocolAvailable(): Promise<boolean> {
  const engine = new ProtocolEngineAdapter();
  return engine.configure();
}

/**
 * Force JSON fallback mode (debug only)
 * Use for debugging or when daemon is not available
 */
export function useJsonFallbackMode(cliPath?: string): ProtocolEngineAdapter {
  console.warn('[ProtocolEngine] WARNING: Using JSON fallback mode (not for production)');
  protocolAdapterInstance = new ProtocolEngineAdapter({
    useJsonFallback: true,
    cliPath,
  });
  return protocolAdapterInstance;
}
