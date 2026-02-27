/**
 * Proof CLI Module
 * 
 * Commands:
 *   reach proof create <request-id>    - Create proof bundle from execution
 *   reach proof verify --bundle <file> - Verify bundle consistency
 *   reach proof export <bundle-id>     - Export bundle to file
 *   reach proof sign --bundle <file>   - Sign bundle with configured signer
 *   reach proof validate-remote <id>   - Submit for remote validation (if enabled)
 * 
 * @module cli/proof-cli
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  ProofBundle,
  createProofBundle,
  verifyBundleConsistency,
  serializeBundle,
  deserializeBundle,
  computeBundleCID,
  exportBundle,
  importBundle,
  isProofBundle,
} from '../engine/proof/bundle.js';
import { getSignerRegistry } from '../plugins/signing/interface.js';
import { getRemoteReplayClient } from '../remote/replay-client.js';

interface CliOptions {
  json?: boolean;
  debug?: boolean;
  verbose?: boolean;
  bundle?: string;
  output?: string;
  signer?: string;
  keyId?: string;
}

// ============================================================================
// Command: proof create
// ============================================================================

export async function proofCreate(
  requestId: string,
  opts: CliOptions
): Promise<void> {
  // Check if we have execution data for this request
  const dataPath = join('.reach', 'executions', `${requestId}.json`);
  
  if (!existsSync(dataPath)) {
    console.error(`No execution data found for request: ${requestId}`);
    console.error(`Expected: ${dataPath}`);
    process.exit(1);
  }
  
  // Load execution data
  const executionData = JSON.parse(readFileSync(dataPath, 'utf8'));
  
  // Create proof bundle
  const bundle = createProofBundle({
    requestId,
    inputs: {
      params: executionData.inputCid || computeCidStub(executionData.input),
      policy: executionData.policyCid || computeCidStub(executionData.policy || {}),
      context: executionData.contextCid,
    },
    outputs: {
      result: executionData.outputCid || computeCidStub(executionData.output),
      transcript: executionData.transcriptCid || computeCidStub(executionData.transcript || {}),
      trace: executionData.traceCid,
    },
    engine: {
      type: executionData.engine?.type || 'requiem',
      version: executionData.engine?.version || '1.0.0',
      protocolVersion: executionData.engine?.protocolVersion || '1.0.0',
      contractVersion: executionData.engine?.contractVersion || '1.0.0',
    },
    metadata: {
      durationMs: executionData.durationMs || 0,
      algorithm: executionData.algorithm || 'minimax_regret',
      tenantHash: executionData.tenantHash,
    },
  });
  
  // Save bundle
  const bundlePath = join('.reach', 'proofs', `${bundle.bundleId}.json`);
  ensureDirExists(bundlePath);
  exportBundle(bundle, bundlePath);
  
  if (opts.json) {
    console.log(JSON.stringify({
      success: true,
      bundleId: bundle.bundleId,
      path: bundlePath,
      merkleRoot: bundle.merkleRoot,
      cid: computeBundleCID(bundle),
    }, null, 2));
  } else {
    console.log(`✅ Proof bundle created`);
    console.log(`   Bundle ID: ${bundle.bundleId}`);
    console.log(`   Path: ${bundlePath}`);
    console.log(`   Merkle Root: ${bundle.merkleRoot.slice(0, 32)}...`);
    console.log(`   CID: ${computeBundleCID(bundle).slice(0, 32)}...`);
  }
}

// ============================================================================
// Command: proof verify
// ============================================================================

export async function proofVerify(opts: CliOptions): Promise<void> {
  if (!opts.bundle) {
    console.error('Error: --bundle is required');
    console.error('Usage: reach proof verify --bundle <file>');
    process.exit(1);
  }
  
  const bundlePath = resolve(opts.bundle);
  
  if (!existsSync(bundlePath)) {
    console.error(`Bundle not found: ${bundlePath}`);
    process.exit(1);
  }
  
  // Load bundle
  let bundle: ProofBundle;
  try {
    bundle = importBundle(bundlePath);
  } catch (error) {
    console.error(`Failed to load bundle: ${error}`);
    process.exit(1);
  }
  
  // Verify consistency
  const result = verifyBundleConsistency(bundle);
  
  // Additional checks
  const checks = {
    format: isProofBundle(bundle),
    merkleRoot: result.errors.length === 0 || !result.errors.some(e => e.includes('Merkle')),
    bundleId: result.errors.length === 0 || !result.errors.some(e => e.includes('Bundle ID')),
  };
  
  const allValid = result.valid && checks.format;
  
  if (opts.json) {
    console.log(JSON.stringify({
      valid: allValid,
      bundleId: bundle.bundleId,
      merkleRoot: bundle.merkleRoot,
      checks,
      errors: result.errors,
      warnings: result.warnings,
      signature: bundle.signature ? {
        algorithm: bundle.signature.algorithm,
        keyId: bundle.signature.keyId,
        signerPlugin: bundle.signature.signerPlugin,
      } : null,
    }, null, 2));
  } else {
    if (allValid) {
      console.log('✅ Bundle verification PASSED');
    } else {
      console.log('❌ Bundle verification FAILED');
    }
    
    console.log(`\nBundle: ${bundle.bundleId}`);
    console.log(`Merkle Root: ${bundle.merkleRoot}`);
    console.log(`Created: ${bundle.timestamp}`);
    
    if (bundle.signature) {
      console.log(`\nSignature:`);
      console.log(`  Algorithm: ${bundle.signature.algorithm}`);
      console.log(`  Key ID: ${bundle.signature.keyId}`);
      console.log(`  Signer: ${bundle.signature.signerPlugin}`);
    }
    
    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
      for (const warning of result.warnings) {
        console.log(`  - ${warning}`);
      }
    }
    
    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }
  }
  
  process.exit(allValid ? 0 : 1);
}

// ============================================================================
// Command: proof export
// ============================================================================

export async function proofExport(
  bundleId: string,
  opts: CliOptions
): Promise<void> {
  // Find bundle
  const bundlePath = findBundle(bundleId);
  
  if (!bundlePath) {
    console.error(`Bundle not found: ${bundleId}`);
    process.exit(1);
  }
  
  // Load bundle
  const bundle = importBundle(bundlePath);
  
  // Determine output path
  const outputPath = opts.output
    ? resolve(opts.output)
    : resolve(`${bundleId}.proof.json`);
  
  // Export
  exportBundle(bundle, outputPath);
  
  if (opts.json) {
    console.log(JSON.stringify({
      success: true,
      bundleId,
      source: bundlePath,
      destination: outputPath,
    }));
  } else {
    console.log(`✅ Bundle exported`);
    console.log(`   Source: ${bundlePath}`);
    console.log(`   Destination: ${outputPath}`);
  }
}

// ============================================================================
// Command: proof sign
// ============================================================================

export async function proofSign(opts: CliOptions): Promise<void> {
  if (!opts.bundle) {
    console.error('Error: --bundle is required');
    console.error('Usage: reach proof sign --bundle <file> [--signer <id>] [--key-id <key>]');
    process.exit(1);
  }
  
  if (!opts.keyId) {
    console.error('Error: --key-id is required');
    process.exit(1);
  }
  
  const bundlePath = resolve(opts.bundle);
  
  if (!existsSync(bundlePath)) {
    console.error(`Bundle not found: ${bundlePath}`);
    process.exit(1);
  }
  
  // Load bundle
  const bundle = importBundle(bundlePath);
  
  // Get signer plugin
  const registry = getSignerRegistry();
  const signerId = opts.signer || 'stub';
  const signer = registry.get(signerId);
  
  if (!signer) {
    console.error(`Signer plugin not found: ${signerId}`);
    console.error(`Available signers: ${registry.list().join(', ')}`);
    process.exit(1);
  }
  
  if (!signer.isAvailable()) {
    console.error(`Signer plugin not available: ${signerId}`);
    process.exit(1);
  }
  
  // Compute bundle CID for signing
  const bundleCid = computeBundleCID(bundle);
  
  // Sign
  const signResult = await signer.sign(bundleCid, {
    keyId: opts.keyId,
    context: 'reach-proof-bundle',
  });
  
  // Update bundle with signature metadata
  bundle.signature = signResult.metadata;
  
  // Save updated bundle
  exportBundle(bundle, bundlePath);
  
  if (opts.json) {
    console.log(JSON.stringify({
      success: true,
      bundleId: bundle.bundleId,
      signatureRef: signResult.signatureRef,
      signer: signer.id,
      keyId: opts.keyId,
    }, null, 2));
  } else {
    console.log(`✅ Bundle signed`);
    console.log(`   Bundle ID: ${bundle.bundleId}`);
    console.log(`   Signer: ${signer.name}`);
    console.log(`   Key ID: ${opts.keyId}`);
    console.log(`   Algorithm: ${signResult.metadata.algorithm}`);
    console.log(`   Signature Ref: ${signResult.signatureRef}`);
  }
}

// ============================================================================
// Command: proof validate-remote
// ============================================================================

export async function proofValidateRemote(
  bundleId: string,
  opts: CliOptions
): Promise<void> {
  // Find bundle
  const bundlePath = findBundle(bundleId);
  
  if (!bundlePath) {
    console.error(`Bundle not found: ${bundleId}`);
    process.exit(1);
  }
  
  // Load bundle
  const bundle = importBundle(bundlePath);
  
  // Get remote client
  const client = getRemoteReplayClient();
  
  if (!client.isEnabled()) {
    console.error('Remote validation is disabled');
    console.error('Enable with: REACH_REMOTE_VALIDATION=1 and REACH_REMOTE_ENDPOINT=<url>');
    process.exit(1);
  }
  
  // Submit for validation
  console.log('Submitting for remote validation...');
  const result = await client.validate(bundle);
  
  if (opts.json) {
    console.log(JSON.stringify({
      attempted: result.attempted,
      success: result.success,
      retries: result.retries,
      response: result.response,
      error: result.error,
    }, null, 2));
  } else {
    if (!result.attempted) {
      console.log('⚠️  Remote validation not attempted (disabled)');
    } else if (result.success) {
      console.log('✅ Remote validation PASSED');
      if (result.response) {
        console.log(`   Validator: ${result.response.validatorId}`);
        console.log(`   Match: ${result.response.match ? 'YES' : 'NO'}`);
        console.log(`   Duration: ${result.response.executionDurationMs}ms`);
      }
    } else {
      console.log('❌ Remote validation FAILED');
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  }
  
  process.exit(result.success ? 0 : 1);
}

// ============================================================================
// Helpers
// ============================================================================

function computeCidStub(data: unknown): string {
  const { createHash } = require('crypto');
  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

function ensureDirExists(filepath: string): void {
  const fs = require('fs');
  const path = require('path');
  const dir = path.dirname(filepath);
  if (!existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function findBundle(bundleId: string): string | null {
  const searchPaths = [
    join('.reach', 'proofs', `${bundleId}.json`),
    join('.reach', 'proofs', `${bundleId}.proof.json`),
    `${bundleId}.json`,
    `${bundleId}.proof.json`,
  ];
  
  for (const p of searchPaths) {
    if (existsSync(p)) {
      return resolve(p);
    }
  }
  
  return null;
}

// ============================================================================
// Help
// ============================================================================

export function printProofHelp(): void {
  console.log(`
Proof Commands:

  reach proof create <request-id>     Create proof bundle from execution
  reach proof verify --bundle <file>  Verify bundle internal consistency
  reach proof export <bundle-id>      Export bundle to file
  reach proof sign --bundle <file>    Sign bundle with configured signer
  reach proof validate-remote <id>    Submit for remote validation

Options:
  --bundle <file>                     Path to bundle file
  --output <file>                     Output file path
  --signer <id>                       Signer plugin ID (default: stub)
  --key-id <key>                      Key identifier for signing
  --json                              Output as JSON

Examples:
  reach proof create req_abc123
  reach proof verify --bundle .reach/proofs/abc.proof.json
  reach proof sign --bundle proof.json --key-id my-key
`);
}
