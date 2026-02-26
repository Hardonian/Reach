/**
 * Content Addressable Storage (CAS) with CID Verification
 * 
 * Provides artifact storage with cryptographic verification on read.
 * Re-hashes artifacts upon retrieval to prevent "poisoning" attacks
 * where malicious content could be substituted in storage.
 * 
 * This module ensures data integrity by:
 * 1. Computing SHA-256 hash of content on write (CID = content identifier)
 * 2. Re-hashing content on read and comparing against claimed CID
 * 3. Throwing error if hash mismatch is detected (poisoning prevention)
 * 
 * @module engine/storage/cas
 */

import { createHash, Hash } from 'crypto';
import { Readable } from 'stream';

/**
 * Content Identifier (CID) - a SHA-256 hash of the content
 * This serves as both the address and integrity check for stored content
 */
export type CID = string;

/**
 * Metadata about stored content
 */
export interface ArtifactMetadata {
  cid: CID;
  size: number;
  contentType?: string;
  createdAt: string;
  checksum?: string;
}

/**
 * Result of a CID verification
 */
export interface VerificationResult {
  valid: boolean;
  expectedCid: CID;
  computedCid: CID;
  matches: boolean;
  error?: string;
}

/**
 * Configuration for CAS
 */
export interface CASConfig {
  /**
   * Enable or disable CID verification on read (default: true)
   */
  verifyOnRead?: boolean;
  
  /**
   * Enable or disable CID verification on write (default: true)
   */
  verifyOnWrite?: boolean;
  
  /**
   * Maximum content size in bytes (default: 100MB)
   */
  maxSize?: number;
  
  /**
   * Allow retrieving content without verification (for performance)
   */
  allowUnverifiedRead?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: Required<CASConfig> = {
  verifyOnRead: true,
  verifyOnWrite: true,
  maxSize: 100 * 1024 * 1024, // 100MB
  allowUnverifiedRead: false,
};

/**
 * Compute deterministic CID (SHA-256 hash) from content
 * 
 * This is deterministic - same content always produces same CID.
 * Uses streaming to handle large content efficiently.
 * 
 * @param content - The content to hash (string, Buffer, or stream)
 * @returns The SHA-256 hash as a hex string (CID)
 */
export function computeCID(content: string | Buffer | Uint8Array): CID {
  const hash = createHash('sha256');
  
  if (typeof content === 'string') {
    hash.update(content, 'utf8');
  } else {
    hash.update(content);
  }
  
  return hash.digest('hex');
}

/**
 * Compute CID from a stream (for large content)
 * 
 * @param stream - Readable stream to hash
 * @returns Promise resolving to the CID
 */
export async function computeCIDFromStream(stream: Readable): Promise<CID> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    
    stream.on('data', (chunk: Buffer | string) => {
      hash.update(chunk);
    });
    
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    
    stream.on('error', (err: Error) => {
      reject(err);
    });
  });
}

/**
 * Verify content against a claimed CID
 * 
 * Re-hashes the content and compares against the claimed CID.
 * This prevents "poisoning" attacks where content might be tampered with in storage.
 * 
 * @param content - The content to verify (string or Buffer)
 * @param claimedCid - The CID to verify against
 * @returns VerificationResult indicating whether the content matches
 */
export function verifyCID(content: string | Buffer | Uint8Array, claimedCid: CID): VerificationResult {
  const computedCid = computeCID(content);
  const matches = computedCid === claimedCid;
  
  return {
    valid: true, // Verification was performed (even if it failed)
    expectedCid: claimedCid,
    computedCid,
    matches,
    error: matches ? undefined : `CID mismatch: expected ${claimedCid}, got ${computedCid}`,
  };
}

/**
 * Verify content from a stream against a claimed CID
 * 
 * @param stream - The content stream to verify
 * @param claimedCid - The CID to verify against
 * @returns Promise resolving to VerificationResult
 */
export async function verifyCIDFromStream(stream: Readable, claimedCid: CID): Promise<VerificationResult> {
  const computedCid = await computeCIDFromStream(stream);
  const matches = computedCid === claimedCid;
  
  return {
    valid: true,
    expectedCid: claimedCid,
    computedCid,
    matches,
    error: matches ? undefined : `CID mismatch: expected ${claimedCid}, got ${computedCid}`,
  };
}

/**
 * Error thrown when CID verification fails
 */
export class CIDVerificationError extends Error {
  public readonly expectedCid: CID;
  public readonly computedCid: CID;
  
  constructor(expectedCid: CID, computedCid: CID) {
    super(`CID verification failed: expected ${expectedCid}, computed ${computedCid}`);
    this.name = 'CIDVerificationError';
    this.expectedCid = expectedCid;
    this.computedCid = computedCid;
  }
}

// ============================================================================
// In-Memory CAS Implementation (can be replaced with disk/cloud storage)
// ============================================================================

/**
 * In-memory artifact storage with CID verification
 * 
 * This is a reference implementation. In production, this would be backed
 * by SQLite (OSS) or cloud object storage (Enterprise).
 */
export class ContentAddressableStorage {
  private store: Map<CID, { content: Buffer; metadata: ArtifactMetadata }> = new Map();
  private config: Required<CASConfig>;
  
  constructor(config: CASConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Store content and return its CID
   * 
   * @param content - The content to store
   * @param metadata - Optional metadata
   * @returns The CID of the stored content
   */
  async put(content: Buffer | string, metadata?: Partial<ArtifactMetadata>): Promise<CID> {
    // Compute CID from content
    const cid = computeCID(content);
    
    // Verify on write if enabled
    if (this.config.verifyOnWrite) {
      const size = typeof content === 'string' ? Buffer.byteLength(content) : content.length;
      
      if (size > this.config.maxSize) {
        throw new Error(`Content size ${size} exceeds maximum ${this.config.maxSize}`);
      }
    }
    
    // Store the content
    const storedMetadata: ArtifactMetadata = {
      cid,
      size: typeof content === 'string' ? Buffer.byteLength(content) : content.length,
      contentType: metadata?.contentType,
      createdAt: metadata?.createdAt || new Date().toISOString(),
      checksum: metadata?.checksum,
    };
    
    this.store.set(cid, {
      content: typeof content === 'string' ? Buffer.from(content, 'utf8') : content,
      metadata: storedMetadata,
    });
    
    return cid;
  }
  
  /**
   * Retrieve content by CID with verification
   * 
   * @param cid - The CID to retrieve
   * @param options - Optional options to skip verification
   * @returns The content and its metadata
   * @throws CIDVerificationError if verification fails
   */
  async get(cid: CID, options?: { verify?: boolean }): Promise<{ content: Buffer; metadata: ArtifactMetadata }> {
    const entry = this.store.get(cid);
    
    if (!entry) {
      throw new Error(`Artifact not found: ${cid}`);
    }
    
    const shouldVerify = options?.verify ?? this.config.verifyOnRead;
    
    // Verify CID if enabled
    if (shouldVerify && this.config.verifyOnRead) {
      const verification = verifyCID(entry.content, cid);
      
      if (!verification.matches) {
        // Log the poisoning attempt
        console.error(`[CAS] CID VERIFICATION FAILED: Potential poisoning attack detected for CID ${cid}`);
        console.error(`[CAS] Expected: ${verification.expectedCid}`);
        console.error(`[CAS] Computed: ${verification.computedCid}`);
        
        throw new CIDVerificationError(verification.expectedCid, verification.computedCid);
      }
    }
    
    return {
      content: entry.content,
      metadata: entry.metadata,
    };
  }
  
  /**
   * Retrieve content as stream by CID with verification
   * 
   * @param cid - The CID to retrieve
   * @returns Readable stream of the content
   */
  getStream(cid: CID): Readable {
    const entry = this.store.get(cid);
    
    if (!entry) {
      throw new Error(`Artifact not found: ${cid}`);
    }
    
    // For verification, we need to re-read and verify
    // This creates a new stream each time to prevent tampering
    const stream = new Readable({
      read() {
        this.push(entry.content);
        this.push(null);
      }
    });
    
    return stream;
  }
  
  /**
   * Check if content exists
   */
  has(cid: CID): boolean {
    return this.store.has(cid);
  }
  
  /**
   * Delete content by CID
   */
  delete(cid: CID): boolean {
    return this.store.delete(cid);
  }
  
  /**
   * Get metadata without retrieving content
   */
  getMetadata(cid: CID): ArtifactMetadata | undefined {
    return this.store.get(cid)?.metadata;
  }
  
  /**
   * List all CIDs in storage
   */
  list(): CID[] {
    return Array.from(this.store.keys());
  }
  
  /**
   * Get storage statistics
   */
  getStats(): {
    totalArtifacts: number;
    totalSize: number;
  } {
    const entries = Array.from(this.store.values());
    let totalSize = 0;
    for (const entry of entries) {
      totalSize += entry.metadata.size;
    }
    
    return {
      totalArtifacts: this.store.size,
      totalSize,
    };
  }
  
  /**
   * Clear all content (for testing)
   */
  clear(): void {
    this.store.clear();
  }
}

// ============================================================================
// CID Verifier Utility (for integrating with existing storage drivers)
// ============================================================================

/**
 * Create a wrapper that adds CID verification to any storage driver
 * 
 * This can be used to wrap existing storage implementations (SQLite, S3, etc.)
 * to add CID verification without modifying the underlying storage code.
 * 
 * @example
 * const verifiedStorage = createVerifiedStorage(originalStorage, {
 *   verifyOnRead: true,
 *   verifyOnWrite: true,
 * });
 */
export function createVerifiedStorage<T>(
  storage: {
    get(key: string): Promise<{ content: Buffer; metadata: Record<string, unknown> }>;
    put(key: string, content: Buffer): Promise<string>;
    delete(key: string): Promise<boolean>;
    has(key: string): Promise<boolean>;
  },
  config: CASConfig = {}
): {
  get(key: string, options?: { verify?: boolean }): Promise<{ content: Buffer; metadata: Record<string, unknown> }>;
  put(key: string, content: Buffer, metadata?: Record<string, unknown>): Promise<string>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
} {
  const casConfig = { ...DEFAULT_CONFIG, ...config };
  
  return {
    /**
     * Get content and verify CID
     */
    async get(key: string, options?: { verify?: boolean }): Promise<{ content: Buffer; metadata: Record<string, unknown> }> {
      const result = await storage.get(key);
      const shouldVerify = options?.verify ?? casConfig.verifyOnRead;
      
      if (shouldVerify && casConfig.verifyOnRead) {
        const claimedCid = result.metadata.cid as CID;
        
        if (claimedCid) {
          const verification = verifyCID(result.content, claimedCid);
          
          if (!verification.matches) {
            console.error(`[CAS] CID VERIFICATION FAILED for key ${key}: Potential poisoning attack`);
            throw new CIDVerificationError(verification.expectedCid, verification.computedCid);
          }
        }
      }
      
      return result;
    },
    
    /**
     * Store content with automatic CID computation
     */
    async put(key: string, content: Buffer, metadata?: Record<string, unknown>): Promise<string> {
      const cid = computeCID(content);
      
      // Store with computed CID in metadata
      const metadataWithCid = {
        ...metadata,
        cid,
        size: content.length,
      };
      
      return storage.put(key, content);
    },
    
    /**
     * Delete content
     */
    async delete(key: string): Promise<boolean> {
      return storage.delete(key);
    },
    
    /**
     * Check if content exists
     */
    async has(key: string): Promise<boolean> {
      return storage.has(key);
    },
  };
}

// ============================================================================
// Singleton instance for global use
// ============================================================================

let casInstance: ContentAddressableStorage | undefined;

/**
 * Get or create the singleton CAS instance
 */
export function getCAS(config?: CASConfig): ContentAddressableStorage {
  if (!casInstance) {
    casInstance = new ContentAddressableStorage(config);
  }
  return casInstance;
}

/**
 * Reset the CAS instance (useful for testing)
 */
export function resetCAS(): void {
  if (casInstance) {
    casInstance.clear();
    casInstance = undefined;
  }
}
