#!/usr/bin/env node
/**
 * Proof Verification Script
 * 
 * Validates proof bundle functionality:
 * - Bundle creation
 * - Bundle verification (consistency)
 * - Signing plugin interface
 * - Remote validation stub (if enabled)
 * 
 * Usage: npx tsx scripts/verify-proof.ts [--json]
 */

import {
  createProofBundle,
  verifyBundleConsistency,
  serializeBundle,
  deserializeBundle,
  computeBundleCID,
  isProofBundle,
  PROOF_BUNDLE_VERSION,
} from '../src/engine/proof/bundle.js';
import { getSignerRegistry } from '../src/plugins/signing/interface.js';
import { getRemoteReplayClient } from '../src/remote/replay-client.js';

interface VerificationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    critical: boolean;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    critical: number;
  };
}

async function runVerification(): Promise<VerificationResult> {
  const checks: Array<{ name: string; passed: boolean; message: string; critical: boolean }> = [];
  
  // 1. Test bundle creation
  let bundle: ReturnType<typeof createProofBundle>;
  try {
    bundle = createProofBundle({
      requestId: 'test-request-001',
      inputs: {
        params: 'a'.repeat(64),
        policy: 'b'.repeat(64),
        context: 'c'.repeat(64),
      },
      outputs: {
        result: 'd'.repeat(64),
        transcript: 'e'.repeat(64),
        trace: 'f'.repeat(64),
      },
      engine: {
        type: 'requiem',
        version: '1.0.0',
        protocolVersion: '1.0.0',
        contractVersion: '1.0.0',
      },
      metadata: {
        durationMs: 150,
        algorithm: 'minimax_regret',
        tenantHash: 'tenant123',
      },
    });
    
    checks.push({
      name: 'bundle_creation',
      passed: true,
      message: `Bundle created: ${bundle.bundleId}`,
      critical: true,
    });
  } catch (error) {
    checks.push({
      name: 'bundle_creation',
      passed: false,
      message: `Bundle creation failed: ${error}`,
      critical: true,
    });
    return {
      passed: false,
      checks,
      summary: { total: 1, passed: 0, failed: 1, critical: 1 },
    };
  }
  
  // 2. Test bundle structure validation
  const isValid = isProofBundle(bundle);
  checks.push({
    name: 'bundle_structure',
    passed: isValid,
    message: isValid ? 'Bundle structure is valid' : 'Bundle structure is invalid',
    critical: true,
  });
  
  // 3. Test bundle version
  checks.push({
    name: 'bundle_version',
    passed: bundle.version === PROOF_BUNDLE_VERSION,
    message: `Bundle version: ${bundle.version}`,
    critical: true,
  });
  
  // 4. Test consistency verification
  const consistency = verifyBundleConsistency(bundle);
  checks.push({
    name: 'bundle_consistency',
    passed: consistency.valid,
    message: consistency.valid
      ? 'Bundle internal consistency verified'
      : `Consistency errors: ${consistency.errors.join(', ')}`,
    critical: true,
  });
  
  // 5. Test serialization/deserialization
  try {
    const serialized = serializeBundle(bundle);
    const deserialized = deserializeBundle(serialized);
    const roundtrip = deserialized.bundleId === bundle.bundleId;
    
    checks.push({
      name: 'bundle_serialization',
      passed: roundtrip,
      message: roundtrip ? 'Serialization roundtrip successful' : 'Serialization roundtrip failed',
      critical: true,
    });
  } catch (error) {
    checks.push({
      name: 'bundle_serialization',
      passed: false,
      message: `Serialization failed: ${error}`,
      critical: true,
    });
  }
  
  // 6. Test CID computation
  try {
    const cid = computeBundleCID(bundle);
    checks.push({
      name: 'bundle_cid',
      passed: cid.length >= 64,
      message: `Bundle CID: ${cid.slice(0, 32)}...`,
      critical: false,
    });
  } catch (error) {
    checks.push({
      name: 'bundle_cid',
      passed: false,
      message: `CID computation failed: ${error}`,
      critical: false,
    });
  };
  
  // 7. Test signer plugin registry
  const registry = getSignerRegistry();
  const hasSigners = registry.list().length > 0;
  checks.push({
    name: 'signer_registry',
    passed: hasSigners,
    message: hasSigners
      ? `Signer plugins available: ${registry.list().join(', ')}`
      : 'No signer plugins registered',
    critical: false,
  });
  
  // 8. Test stub signer
  const stubSigner = registry.get('stub');
  if (stubSigner) {
    try {
      const signResult = await stubSigner.sign('test-data', {
        keyId: 'test-key',
        algorithm: 'stub-ed25519',
      });
      
      checks.push({
        name: 'stub_signer',
        passed: !!signResult.metadata,
        message: `Stub signer working: ${signResult.signatureRef}`,
        critical: false,
      });
      
      // Test verification
      const verifyResult = await stubSigner.verify(
        'test-data',
        signResult.signature || '',
        'test-key'
      );
      
      checks.push({
        name: 'stub_verification',
        passed: verifyResult,
        message: verifyResult ? 'Stub verification working' : 'Stub verification failed',
        critical: false,
      });
    } catch (error) {
      checks.push({
        name: 'stub_signer',
        passed: false,
        message: `Stub signer failed: ${error}`,
        critical: false,
      });
    }
  }
  
  // 9. Test remote validation client
  const client = getRemoteReplayClient();
  const config = client.getConfig();
  
  checks.push({
    name: 'remote_client_config',
    passed: !config.enabled,
    message: config.enabled
      ? 'Remote validation is enabled'
      : 'Remote validation is disabled (default)',
    critical: false,
  });
  
  // Test with disabled client (should return success without attempting)
  const validationResult = await client.validate(bundle);
  checks.push({
    name: 'remote_disabled_validation',
    passed: validationResult.attempted === false && validationResult.success === true,
    message: 'Disabled client returns success without attempting',
    critical: false,
  });
  
  // 10. Test Merkle root
  checks.push({
    name: 'merkle_root',
    passed: bundle.merkleRoot.length === 64,
    message: `Merkle root: ${bundle.merkleRoot.slice(0, 32)}...`,
    critical: true,
  });
  
  // Calculate summary
  const criticalFailed = checks.filter(c => c.critical && !c.passed).length;
  const totalFailed = checks.filter(c => !c.passed).length;
  
  return {
    passed: criticalFailed === 0,
    checks,
    summary: {
      total: checks.length,
      passed: checks.length - totalFailed,
      failed: totalFailed,
      critical: criticalFailed,
    },
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  
  console.log('🔍 Running proof verification...\n');
  
  const result = await runVerification();
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Verification Results:');
    console.log('─'.repeat(50));
    
    for (const check of result.checks) {
      const icon = check.passed ? '✅' : '❌';
      const critical = check.critical ? ' [CRITICAL]' : '';
      console.log(`${icon} ${check.name}${critical}`);
      console.log(`   ${check.message}`);
    }
    
    console.log('─'.repeat(50));
    console.log(`\nSummary: ${result.summary.passed}/${result.summary.total} passed`);
    
    if (result.summary.critical > 0) {
      console.log(`❌ ${result.summary.critical} critical check(s) failed`);
      process.exit(1);
    } else if (result.summary.failed > 0) {
      console.log(`⚠️  ${result.summary.failed} non-critical check(s) failed`);
      process.exit(0);
    } else {
      console.log('✅ All checks passed');
      process.exit(0);
    }
  }
}

main().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
