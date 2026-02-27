/**
 * Remote Replay Validation Client
 * 
 * Optional client stub for remote replay validation.
 * Disabled by default. When enabled, submits deterministic request
 * envelopes to a remote validation service for independent replay.
 * 
 * Features:
 * - Behind config flag (disabled by default)
 * - Retry/backoff strategy
 * - Deterministic request envelope
 * - Non-blocking (best-effort)
 * 
 * @module remote/replay-client
 */

import { ProofBundle } from '../engine/proof/bundle.js';
import { hash } from '../lib/hash';

/**
 * Remote validation configuration
 */
export interface RemoteValidationConfig {
  /** Whether remote validation is enabled */
  enabled: boolean;
  
  /** Remote validation service endpoint */
  endpoint: string;
  
  /** API key (reference only, not the actual key) */
  apiKeyRef?: string;
  
  /** Maximum number of retries */
  maxRetries: number;
  
  /** Initial retry delay in ms */
  initialRetryDelayMs: number;
  
  /** Maximum retry delay in ms */
  maxRetryDelayMs: number;
  
  /** Request timeout in ms */
  timeoutMs: number;
  
  /** Whether to fail execution on validation failure */
  failOnError: boolean;
}

/**
 * Default configuration (disabled)
 */
export const DEFAULT_REMOTE_VALIDATION_CONFIG: RemoteValidationConfig = {
  enabled: false,
  endpoint: '',
  maxRetries: 3,
  initialRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  timeoutMs: 10000,
  failOnError: false,
};

/**
 * Deterministic request envelope for remote validation
 * 
 * All fields are ordered and serialized deterministically to ensure
 * the same request always produces the same envelope.
 */
export interface ReplayRequestEnvelope {
  /** Envelope version */
  version: 'replay.v1';
  
  /** Request timestamp */
  timestamp: string;
  
  /** Bundle identifier */
  bundleId: string;
  
  /** Request identifier */
  requestId: string;
  
  /** Bundle CID (content hash) */
  bundleCid: string;
  
  /** Merkle root from bundle */
  merkleRoot: string;
  
  /** Engine information */
  engine: {
    type: string;
    version: string;
    protocolVersion: string;
    contractVersion: string;
  };
  
  /** Hash of input parameters */
  inputHash: string;
  
  /** Hash of expected output */
  expectedOutputHash: string;
  
  /** Algorithm used */
  algorithm: string;
}

/**
 * Replay validation response
 */
export interface ReplayValidationResponse {
  /** Whether validation succeeded */
  valid: boolean;
  
  /** Validation timestamp */
  timestamp: string;
  
  /** Remote validator identifier */
  validatorId: string;
  
  /** Computed output hash */
  computedOutputHash: string;
  
  /** Match status */
  match: boolean;
  
  /** Execution duration at validator */
  executionDurationMs: number;
  
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation was attempted */
  attempted: boolean;
  
  /** Whether validation succeeded */
  success: boolean;
  
  /** Number of retries performed */
  retries: number;
  
  /** Response from validator (if successful) */
  response?: ReplayValidationResponse;
  
  /** Error if validation failed */
  error?: string;
}

/**
 * Remote replay validation client
 * 
 * This is a stub implementation. In production, this would connect
 * to an actual remote validation service.
 */
export class RemoteReplayClient {
  private config: RemoteValidationConfig;
  
  constructor(config: Partial<RemoteValidationConfig> = {}) {
    this.config = { ...DEFAULT_REMOTE_VALIDATION_CONFIG, ...config };
  }
  
  /**
   * Check if remote validation is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.config.endpoint !== '';
  }
  
  /**
   * Submit a bundle for remote replay validation
   * 
   * This is non-blocking and best-effort. If validation fails,
   * it will be logged but not block execution (unless failOnError is set).
   */
  async validate(bundle: ProofBundle): Promise<ValidationResult> {
    if (!this.isEnabled()) {
      return {
        attempted: false,
        success: true,
        retries: 0,
      };
    }
    
    // Build deterministic envelope
    const envelope = this.buildEnvelope(bundle);
    
    // Serialize deterministically
    const payload = this.serializeEnvelope(envelope);
    
    // Submit with retry
    return this.submitWithRetry(payload, envelope.bundleId);
  }
  
  /**
   * Build deterministic request envelope from bundle
   */
  private buildEnvelope(bundle: ProofBundle): ReplayRequestEnvelope {
    // Use only deterministic fields
    return {
      version: 'replay.v1',
      timestamp: bundle.timestamp, // Bundle timestamp is part of proof
      bundleId: bundle.bundleId,
      requestId: bundle.requestId,
      bundleCid: this.computeBundleCid(bundle),
      merkleRoot: bundle.merkleRoot,
      engine: {
        type: bundle.engine.type,
        version: bundle.engine.version,
        protocolVersion: bundle.engine.protocolVersion,
        contractVersion: bundle.engine.contractVersion,
      },
      inputHash: bundle.inputs.params, // Input is the params CID
      expectedOutputHash: bundle.outputs.result, // Expected output
      algorithm: bundle.metadata.algorithm,
    };
  }
  
  /**
   * Serialize envelope deterministically
   */
  private serializeEnvelope(envelope: ReplayRequestEnvelope): string {
    // Sort keys for determinism
    const sorted = this.sortKeys(envelope);
    return JSON.stringify(sorted);
  }
  
  /**
   * Recursively sort object keys
   */
  private sortKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortKeys(item));
    }
    
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = this.sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  
  /**
   * Compute bundle CID (stub implementation)
   */
  private computeBundleCid(bundle: ProofBundle): string {
    return hash(bundle.bundleId + bundle.merkleRoot);
  }
  
  /**
   * Submit validation request with exponential backoff retry
   */
  private async submitWithRetry(
    payload: string,
    bundleId: string
  ): Promise<ValidationResult> {
    let lastError: Error | undefined;
    let delay = this.config.initialRetryDelayMs;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.submitRequest(payload);
        
        return {
          attempted: true,
          success: true,
          retries: attempt,
          response,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.maxRetries) {
          // Log retry
          console.warn(
            `[RemoteReplay] Attempt ${attempt + 1} failed for ${bundleId}, ` +
            `retrying in ${delay}ms: ${lastError.message}`
          );
          
          // Wait with exponential backoff
          await this.sleep(delay);
          
          // Increase delay for next attempt (exponential backoff)
          delay = Math.min(delay * 2, this.config.maxRetryDelayMs);
        }
      }
    }
    
    // All retries exhausted
    const errorMessage = `Remote validation failed after ${this.config.maxRetries} retries: ${lastError?.message}`;
    console.error(`[RemoteReplay] ${errorMessage}`);
    
    return {
      attempted: true,
      success: false,
      retries: this.config.maxRetries,
      error: errorMessage,
    };
  }
  
  /**
   * Submit request to remote validator (stub)
   * 
   * In production, this would make an actual HTTP request.
   * This stub simulates the interface.
   */
  private async submitRequest(
    payload: string
  ): Promise<ReplayValidationResponse> {
    // STUB: In production, this would be:
    // const response = await fetch(this.config.endpoint, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: payload,
    //   signal: AbortSignal.timeout(this.config.timeoutMs),
    // });
    // return response.json();
    
    // For now, simulate a successful validation
    const computedHash = hash(payload);
    
    return {
      valid: true,
      timestamp: new Date().toISOString(),
      validatorId: 'stub-validator',
      computedOutputHash: computedHash.slice(0, 32),
      match: true,
      executionDurationMs: 150,
    };
  }
  
  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<RemoteValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): RemoteValidationConfig {
    return { ...this.config };
  }
}

// Singleton instance
let clientInstance: RemoteReplayClient | undefined;

/**
 * Get or create the global remote replay client
 */
export function getRemoteReplayClient(
  config?: Partial<RemoteValidationConfig>
): RemoteReplayClient {
  if (!clientInstance) {
    clientInstance = new RemoteReplayClient(config);
  }
  return clientInstance;
}

/**
 * Reset the client (for testing)
 */
export function resetRemoteReplayClient(): void {
  clientInstance = undefined;
}

/**
 * Enable remote validation with configuration
 */
export function enableRemoteValidation(
  endpoint: string,
  options?: Partial<Omit<RemoteValidationConfig, 'enabled' | 'endpoint'>>
): void {
  const client = getRemoteReplayClient();
  client.updateConfig({
    enabled: true,
    endpoint,
    ...options,
  });
}

/**
 * Disable remote validation
 */
export function disableRemoteValidation(): void {
  const client = getRemoteReplayClient();
  client.updateConfig({ enabled: false });
}
