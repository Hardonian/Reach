/**
 * Signing Plugin Interface
 * 
 * Plugin-first approach: Core only records signature metadata.
 * Actual cryptographic operations are delegated to external signer plugins.
 * 
 * This design:
 * - Keeps heavy crypto libraries out of core
 * - Allows HSM/KMS integration
 * - Supports multiple signature algorithms
 * - Enables air-gapped signing
 * 
 * @module plugins/signing/interface
 */

import { SignatureMetadata } from '../../engine/proof/bundle.js';

/**
 * Signer plugin interface
 * 
 * All signer plugins must implement this interface.
 */
export interface SignerPlugin {
  /** Unique identifier for this signer type */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Supported signature algorithms */
  readonly supportedAlgorithms: string[];
  
  /** Whether this signer is available in the current environment */
  isAvailable(): boolean;
  
  /**
   * Sign data
   * 
   * @param data - The data to sign (typically bundle CID)
   * @param options - Signing options
   * @returns Signature metadata (core records this, actual signature stored externally)
   */
  sign(data: string, options: SignOptions): Promise<SignResult>;
  
  /**
   * Verify a signature
   * 
   * @param data - The original data
   * @param signature - The signature to verify
   * @param keyId - The public key identifier
   * @returns Whether the signature is valid
   */
  verify(data: string, signature: string, keyId: string): Promise<boolean>;
  
  /**
   * Get public key metadata
   * 
   * @param keyId - The key identifier
   * @returns Public key metadata (not the key itself for security)
   */
  getKeyMetadata(keyId: string): Promise<KeyMetadata>;
}

/**
 * Options for signing
 */
export interface SignOptions {
  /** Key identifier (not the key itself) */
  keyId: string;
  
  /** Algorithm to use (must be in supportedAlgorithms) */
  algorithm?: string;
  
  /** Optional context/domain separation */
  context?: string;
  
  /** Additional plugin-specific options */
  [key: string]: unknown;
}

/**
 * Result of a signing operation
 */
export interface SignResult {
  /** Signature metadata for the bundle */
  metadata: SignatureMetadata;
  
  /** Signature reference (external storage location) */
  signatureRef: string;
  
  /** Actual signature (may be empty if stored externally) */
  signature?: string;
  
  /** Public key identifier used */
  keyId: string;
}

/**
 * Public key metadata
 */
export interface KeyMetadata {
  /** Key identifier */
  id: string;
  
  /** Algorithm */
  algorithm: string;
  
  /** Key type (public, key handle reference, etc) */
  type: string;
  
  /** Key creation timestamp */
  createdAt?: string;
  
  /** Key expiration timestamp */
  expiresAt?: string;
  
  /** Whether key is currently valid */
  valid: boolean;
}

/**
 * Plugin registry for signer plugins
 */
export class SignerPluginRegistry {
  private plugins = new Map<string, SignerPlugin>();
  
  /**
   * Register a signer plugin
   */
  register(plugin: SignerPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }
  
  /**
   * Get a signer plugin by ID
   */
  get(id: string): SignerPlugin | undefined {
    return this.plugins.get(id);
  }
  
  /**
   * Get all available signer plugins
   */
  getAvailable(): SignerPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.isAvailable());
  }
  
  /**
   * Get all registered plugin IDs
   */
  list(): string[] {
    return Array.from(this.plugins.keys());
  }
  
  /**
   * Check if a plugin is registered
   */
  has(id: string): boolean {
    return this.plugins.has(id);
  }
}

// Singleton registry
let registryInstance: SignerPluginRegistry | undefined;

/**
 * Get the global signer plugin registry
 */
export function getSignerRegistry(): SignerPluginRegistry {
  if (!registryInstance) {
    registryInstance = new SignerPluginRegistry();
  }
  return registryInstance;
}

/**
 * Reset the registry (for testing)
 */
export function resetSignerRegistry(): void {
  registryInstance = undefined;
}

// ============================================================================
// Stub Signer Plugin (for testing/development)
// ============================================================================

/**
 * Stub signer plugin that records signature intent but doesn't actually sign.
 * Useful for development and testing without requiring actual crypto keys.
 */
export class StubSignerPlugin implements SignerPlugin {
  readonly id = 'stub';
  readonly name = 'Stub Signer (Development Only)';
  readonly supportedAlgorithms = ['stub-ed25519', 'stub-ecdsa'];
  
  isAvailable(): boolean {
    return true;
  }
  
  async sign(data: string, options: SignOptions): Promise<SignResult> {
    // Generate a stub signature (not cryptographically secure!)
    const { createHash } = await import('crypto');
    const stubSignature = createHash('sha256')
      .update('stub')
      .update(data)
      .update(options.keyId)
      .digest('hex');
    
    const timestamp = new Date().toISOString();
    
    return {
      metadata: {
        algorithm: options.algorithm || 'stub-ed25519',
        keyId: options.keyId,
        timestamp,
        signerPlugin: this.id,
        signatureRef: `stub://${options.keyId}/${stubSignature.slice(0, 16)}`,
      },
      signatureRef: `stub://${options.keyId}/${stubSignature.slice(0, 16)}`,
      signature: stubSignature,
      keyId: options.keyId,
    };
  }
  
  async verify(data: string, signature: string, keyId: string): Promise<boolean> {
    // Stub verification always returns true for development
    const { createHash } = await import('crypto');
    const expected = createHash('sha256')
      .update('stub')
      .update(data)
      .update(keyId)
      .digest('hex');
    
    return signature === expected;
  }
  
  async getKeyMetadata(keyId: string): Promise<KeyMetadata> {
    return {
      id: keyId,
      algorithm: 'stub-ed25519',
      type: 'stub-key',
      valid: true,
    };
  }
}

// Auto-register stub signer
getSignerRegistry().register(new StubSignerPlugin());
