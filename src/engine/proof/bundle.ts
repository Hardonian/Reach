/**
 * Proof Bundle Format
 * 
 * A deterministic, self-contained bundle format for verifiable execution proofs.
 * 
 * Contains:
 * - Merkle root of all artifacts
 * - Input/output artifact digests
 * - Policy digest
 * - Transcript digest
 * - Engine/protocol versions
 * 
 * @module engine/proof/bundle
 */

import { hash } from '../../lib/hash';
import { CID, computeCID } from '../storage/cas.js';

/**
 * Proof bundle schema version
 */
export const PROOF_BUNDLE_VERSION = 'proof.bundle.v1';

/**
 * Artifact reference with digest
 */
export interface ArtifactRef {
  /** Artifact name/identifier */
  name: string;
  /** Content identifier (CID) */
  cid: CID;
  /** Size in bytes */
  size: number;
  /** Content type */
  contentType?: string;
}

/**
 * Input artifacts reference
 */
export interface InputArtifacts {
  /** Input parameters digest */
  params: CID;
  /** Policy digest */
  policy: CID;
  /** Context/state digest */
  context?: CID;
  /** Additional input artifacts */
  extras?: ArtifactRef[];
}

/**
 * Output artifacts reference
 */
export interface OutputArtifacts {
  /** Result digest */
  result: CID;
  /** Transcript/log digest */
  transcript: CID;
  /** Trace/debug info digest */
  trace?: CID;
  /** Additional output artifacts */
  extras?: ArtifactRef[];
}

/**
 * Engine version information
 */
export interface EngineInfo {
  /** Engine type */
  type: string;
  /** Engine version */
  version: string;
  /** Build/commit hash */
  commit?: string;
  /** Protocol version */
  protocolVersion: string;
  /** Contract version */
  contractVersion: string;
}

/**
 * Signature metadata (not the signature itself)
 * Core only records metadata; actual signing is done by plugins
 */
export interface SignatureMetadata {
  /** Signature algorithm used */
  algorithm: string;
  /** Public key identifier (not the key itself) */
  keyId: string;
  /** Timestamp of signature */
  timestamp: string;
  /** Signature reference (external storage) */
  signatureRef?: string;
  /** Signer plugin identifier */
  signerPlugin: string;
}

/**
 * Proof bundle structure
 */
export interface ProofBundle {
  /** Bundle schema version */
  version: typeof PROOF_BUNDLE_VERSION;
  /** Unique bundle identifier */
  bundleId: string;
  /** Timestamp of bundle creation */
  timestamp: string;
  /** Request identifier */
  requestId: string;
  
  /** Merkle root of all artifacts */
  merkleRoot: string;
  
  /** Input artifacts */
  inputs: InputArtifacts;
  /** Output artifacts */
  outputs: OutputArtifacts;
  
  /** Engine information */
  engine: EngineInfo;
  
  /** Signature metadata (if signed) */
  signature?: SignatureMetadata;
  
  /** Additional metadata (redacted, no secrets) */
  metadata: {
    /** Execution duration in ms */
    durationMs: number;
    /** Algorithm used */
    algorithm: string;
    /** Tenant identifier (hashed) */
    tenantHash?: string;
  };
}

/**
 * Merkle tree node
 */
interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  leaf?: boolean;
}

/**
 * Build a Merkle tree from leaf hashes
 */
function buildMerkleTree(leaves: string[]): MerkleNode {
  if (leaves.length === 0) {
    return { hash: hashLeaf(''), leaf: true };
  }
  
  if (leaves.length === 1) {
    return { hash: leaves[0], leaf: true };
  }
  
  // Pad to power of 2
  const depth = Math.ceil(Math.log2(leaves.length));
  const targetCount = Math.pow(2, depth);
  const padded = [...leaves];
  while (padded.length < targetCount) {
    padded.push(leaves[leaves.length - 1]); // Duplicate last
  }
  
  return buildTreeRecursive(padded);
}

function buildTreeRecursive(hashes: string[]): MerkleNode {
  if (hashes.length === 1) {
    return { hash: hashes[0], leaf: true };
  }
  
  const mid = Math.floor(hashes.length / 2);
  const left = buildTreeRecursive(hashes.slice(0, mid));
  const right = buildTreeRecursive(hashes.slice(mid));
  
  return {
    hash: hashBranch(left.hash, right.hash),
    left,
    right,
  };
}

function hashLeaf(data: string): string {
  return hash(Buffer.concat([Buffer.from([0x00]), Buffer.from(data)]));
}

function hashBranch(left: string, right: string): string {
  return hash(Buffer.concat([Buffer.from([0x01]), Buffer.from(left), Buffer.from(right)]));
}

/**
 * Create a proof bundle from execution artifacts
 */
export function createProofBundle(options: {
  requestId: string;
  inputs: {
    params: CID;
    policy: CID;
    context?: CID;
    extras?: ArtifactRef[];
  };
  outputs: {
    result: CID;
    transcript: CID;
    trace?: CID;
    extras?: ArtifactRef[];
  };
  engine: EngineInfo;
  metadata: {
    durationMs: number;
    algorithm: string;
    tenantHash?: string;
  };
  signature?: SignatureMetadata;
}): ProofBundle {
  // Collect all CIDs for Merkle tree
  const leaves: string[] = [
    options.inputs.params,
    options.inputs.policy,
    options.outputs.result,
    options.outputs.transcript,
  ];
  
  if (options.inputs.context) leaves.push(options.inputs.context);
  if (options.outputs.trace) leaves.push(options.outputs.trace);
  if (options.inputs.extras) {
    leaves.push(...options.inputs.extras.map(e => e.cid));
  }
  if (options.outputs.extras) {
    leaves.push(...options.outputs.extras.map(e => e.cid));
  }
  
  // Sort for determinism
  leaves.sort();
  
  // Build Merkle tree
  const tree = buildMerkleTree(leaves);
  
  // Generate deterministic bundle ID
  const bundleId = hash(
    options.requestId + tree.hash + options.engine.version
  ).slice(0, 32);
  
  return {
    version: PROOF_BUNDLE_VERSION,
    bundleId,
    timestamp: new Date().toISOString(),
    requestId: options.requestId,
    merkleRoot: tree.hash,
    inputs: options.inputs,
    outputs: options.outputs,
    engine: options.engine,
    signature: options.signature,
    metadata: options.metadata,
  };
}

/**
 * Verify proof bundle internal consistency
 * 
 * This verifies:
 * 1. Merkle root matches recomputed value from leaves
 * 2. All required fields are present
 * 3. CIDs are valid format
 * 4. Bundle is deterministic (sorted, canonical)
 * 
 * Note: This does NOT verify the signature (use signing plugin) or
 * validate artifacts exist in storage.
 */
export function verifyBundleConsistency(bundle: ProofBundle): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check version
  if (bundle.version !== PROOF_BUNDLE_VERSION) {
    warnings.push(`Bundle version ${bundle.version} may not be fully supported`);
  }
  
  // Check required fields
  if (!bundle.bundleId) errors.push('Missing bundleId');
  if (!bundle.timestamp) errors.push('Missing timestamp');
  if (!bundle.requestId) errors.push('Missing requestId');
  if (!bundle.merkleRoot) errors.push('Missing merkleRoot');
  
  // Check inputs
  if (!bundle.inputs?.params) errors.push('Missing inputs.params');
  if (!bundle.inputs?.policy) errors.push('Missing inputs.policy');
  if (!bundle.outputs?.result) errors.push('Missing outputs.result');
  if (!bundle.outputs?.transcript) errors.push('Missing outputs.transcript');
  
  // Check engine info
  if (!bundle.engine?.type) errors.push('Missing engine.type');
  if (!bundle.engine?.version) errors.push('Missing engine.version');
  if (!bundle.engine?.protocolVersion) errors.push('Missing engine.protocolVersion');
  if (!bundle.engine?.contractVersion) errors.push('Missing engine.contractVersion');
  
  // Verify CID format (hex string, 64 chars for SHA-256 or variable for BLAKE3)
  const validCidPattern = /^[a-f0-9]{64,128}$/i;
  
  const cidsToCheck = [
    { cid: bundle.inputs.params, name: 'inputs.params' },
    { cid: bundle.inputs.policy, name: 'inputs.policy' },
    { cid: bundle.outputs.result, name: 'outputs.result' },
    { cid: bundle.outputs.transcript, name: 'outputs.transcript' },
  ];
  
  if (bundle.inputs.context) {
    cidsToCheck.push({ cid: bundle.inputs.context, name: 'inputs.context' });
  }
  if (bundle.outputs.trace) {
    cidsToCheck.push({ cid: bundle.outputs.trace, name: 'outputs.trace' });
  }
  
  for (const { cid, name } of cidsToCheck) {
    if (!validCidPattern.test(cid)) {
      errors.push(`Invalid CID format for ${name}: ${cid.slice(0, 20)}...`);
    }
  }
  
  // Recompute and verify Merkle root
  const leaves: string[] = [
    bundle.inputs.params,
    bundle.inputs.policy,
    bundle.outputs.result,
    bundle.outputs.transcript,
  ];
  
  if (bundle.inputs.context) leaves.push(bundle.inputs.context);
  if (bundle.outputs.trace) leaves.push(bundle.outputs.trace);
  if (bundle.inputs.extras) {
    leaves.push(...bundle.inputs.extras.map(e => e.cid));
  }
  if (bundle.outputs.extras) {
    leaves.push(...bundle.outputs.extras.map(e => e.cid));
  }
  
  leaves.sort();
  const computedTree = buildMerkleTree(leaves);
  
  if (computedTree.hash !== bundle.merkleRoot) {
    errors.push('Merkle root mismatch: bundle may be tampered with');
    errors.push(`  Expected: ${computedTree.hash}`);
    errors.push(`  Got:      ${bundle.merkleRoot}`);
  }
  
  // Verify bundle ID
  const expectedBundleId = hash(
    bundle.requestId + bundle.merkleRoot + bundle.engine.version
  ).slice(0, 32);
  
  if (bundle.bundleId !== expectedBundleId) {
    errors.push('Bundle ID mismatch: potential integrity violation');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Serialize bundle to deterministic JSON string
 */
export function serializeBundle(bundle: ProofBundle): string {
  // Deterministic serialization: sorted keys, no extra whitespace
  return JSON.stringify(bundle, Object.keys(bundle).sort());
}

/**
 * Deserialize bundle from JSON string
 */
export function deserializeBundle(json: string): ProofBundle {
  return JSON.parse(json) as ProofBundle;
}

/**
 * Compute bundle CID (content hash)
 */
export function computeBundleCID(bundle: ProofBundle): CID {
  return computeCID(serializeBundle(bundle));
}

/**
 * Export bundle to file (deterministic format)
 */
export function exportBundle(bundle: ProofBundle, filepath: string): void {
  const fs = require('fs');
  const serialized = serializeBundle(bundle);
  fs.writeFileSync(filepath, serialized, 'utf8');
}

/**
 * Import bundle from file
 */
export function importBundle(filepath: string): ProofBundle {
  const fs = require('fs');
  const content = fs.readFileSync(filepath, 'utf8');
  return deserializeBundle(content);
}

/**
 * Check if an object is a valid ProofBundle structure
 */
export function isProofBundle(obj: unknown): obj is ProofBundle {
  if (typeof obj !== 'object' || obj === null) return false;
  const bundle = obj as Partial<ProofBundle>;
  
  return (
    bundle.version === PROOF_BUNDLE_VERSION &&
    typeof bundle.bundleId === 'string' &&
    typeof bundle.timestamp === 'string' &&
    typeof bundle.requestId === 'string' &&
    typeof bundle.merkleRoot === 'string' &&
    typeof bundle.inputs === 'object' &&
    typeof bundle.outputs === 'object' &&
    typeof bundle.engine === 'object'
  );
}
