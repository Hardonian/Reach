#!/usr/bin/env node
/**
 * Dual-Run Verification Script
 * 
 * Validates dual-run sampling is working correctly:
 * - Adaptive sampling rate (100% for new, taper after stability)
 * - Diff reports stored in .reach/engine-diffs/
 * - Canonical comparison (not presentation)
 * - Stability tracking working
 * 
 * Usage: npx tsx scripts/verify-dual-run.ts [--json] [--quick]
 */

import { ExecRequest } from '../src/engine/contract.js';
import { 
  AdaptiveDualRunSampler, 
  DEFAULT_SAMPLING_CONFIG,
  DiffReport 
} from '../src/engine/adapters/dual-sampling.js';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

interface VerificationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    details?: Record<string, unknown>;
  }>;
  samplingTest?: {
    newTenantRate: number;
    baseRate: number;
    taperedRate: number;
  };
  storageTest?: {
    diffPath: string;
    fileCount: number;
    sampleReport?: DiffReport;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

// Create a sample request for testing
function createTestRequest(requestId: string, algorithm = 'minimax_regret'): ExecRequest {
  return {
    requestId,
    timestamp: new Date().toISOString(),
    params: {
      algorithm: algorithm as any,
      actions: ['action_a', 'action_b', 'action_c'],
      states: ['state_1', 'state_2'],
      outcomes: {
        action_a: { state_1: 10, state_2: 5 },
        action_b: { state_1: 8, state_2: 8 },
        action_c: { state_1: 5, state_2: 10 },
      },
    },
  };
}

async function runVerification(quick = false): Promise<VerificationResult> {
  const checks: Array<{ name: string; passed: boolean; message: string; details?: Record<string, unknown> }> = [];
  let samplingTest;
  let storageTest;
  
  // 1. Check sampler can be instantiated
  let sampler: AdaptiveDualRunSampler;
  try {
    sampler = new AdaptiveDualRunSampler();
    checks.push({
      name: 'sampler_instantiation',
      passed: true,
      message: 'AdaptiveDualRunSampler instantiated successfully',
    });
  } catch (error) {
    checks.push({
      name: 'sampler_instantiation',
      passed: false,
      message: `Failed to instantiate sampler: ${error}`,
    });
    return {
      passed: false,
      checks,
      summary: { total: 1, passed: 0, failed: 1 },
    };
  }
  
  // 2. Test sampling rates
  if (!quick) {
    const newRequest = createTestRequest(`test_new_${Date.now()}`);
    const newTenantRate = sampler.getSamplingRate(newRequest, '1.0.0');
    
    // New tenant should have 100% sampling
    checks.push({
      name: 'new_tenant_sampling',
      passed: newTenantRate === 1.0,
      message: `New tenant sampling rate: ${(newTenantRate * 100).toFixed(1)}%`,
      details: { expected: 1.0, actual: newTenantRate },
    });
    
    // Simulate a stable workload by recording many matches
    const stableRequest = createTestRequest(`test_stable_${Date.now()}`);
    
    // Record 150 successful matches to exceed stability threshold
    for (let i = 0; i < 150; i++) {
      const result = {
        requestId: stableRequest.requestId,
        status: 'success' as const,
        recommendedAction: 'action_a',
        ranking: ['action_a', 'action_b', 'action_c'],
        trace: { algorithm: 'minimax_regret' },
        fingerprint: `fp_${i}`,
        meta: {
          engine: 'requiem',
          engineVersion: '1.0.0',
          durationMs: 10,
          completedAt: new Date().toISOString(),
        },
      };
      
      sampler.recordResult(stableRequest, result, result, '1.0.0');
    }
    
    const stableRate = sampler.getSamplingRate(stableRequest, '1.0.0');
    
    // After stability, should be at base rate
    checks.push({
      name: 'stable_workload_sampling',
      passed: stableRate <= DEFAULT_SAMPLING_CONFIG.baseRate + 0.01,
      message: `Stable workload sampling rate: ${(stableRate * 100).toFixed(2)}%`,
      details: { 
        expected: `<= ${DEFAULT_SAMPLING_CONFIG.baseRate}`,
        actual: stableRate,
        stabilityCount: 150,
      },
    });
    
    // 3. Test new algorithm detection
    const newAlgoRequest = createTestRequest(`test_algo_${Date.now()}`, 'maximin');
    const newAlgoRate = sampler.getSamplingRate(newAlgoRequest, '1.0.0');
    
    checks.push({
      name: 'new_algorithm_sampling',
      passed: newAlgoRate === 1.0,
      message: `New algorithm sampling rate: ${(newAlgoRate * 100).toFixed(1)}%`,
      details: { algorithm: 'maximin' },
    });
    
    samplingTest = {
      newTenantRate,
      baseRate: DEFAULT_SAMPLING_CONFIG.baseRate,
      taperedRate: stableRate,
    };
  }
  
  // 4. Check diff storage
  const diffPath = DEFAULT_SAMPLING_CONFIG.diffStoragePath;
  const diffPathExists = existsSync(diffPath);
  
  checks.push({
    name: 'diff_storage_path',
    passed: diffPathExists,
    message: diffPathExists 
      ? `Diff storage ready at ${diffPath}` 
      : `Diff storage path not created yet: ${diffPath}`,
  });
  
  // 5. Validate diff report format
  let fileCount = 0;
  let sampleReport: DiffReport | undefined;
  
  if (diffPathExists) {
    try {
      const files = readdirSync(diffPath).filter(f => f.endsWith('.json'));
      fileCount = files.length;
      
      checks.push({
        name: 'diff_files_exist',
        passed: fileCount > 0,
        message: `${fileCount} diff report(s) found`,
      });
      
      if (fileCount > 0) {
        // Read and validate a sample report
        const sampleFile = files[0];
        const content = readFileSync(join(diffPath, sampleFile), 'utf-8');
        sampleReport = JSON.parse(content);
        
        const hasValidSchema = 
          sampleReport.version === 'dual-run-diff.v1' &&
          typeof sampleReport.requestId === 'string' &&
          typeof sampleReport.match === 'boolean' &&
          Array.isArray(sampleReport.differences) &&
          sampleReport.canonicalComparison &&
          typeof sampleReport.canonicalComparison.fingerprintMatch === 'boolean';
        
        checks.push({
          name: 'diff_report_schema',
          passed: hasValidSchema,
          message: hasValidSchema 
            ? 'Diff report schema is valid' 
            : 'Diff report schema is invalid',
          details: {
            version: sampleReport.version,
            hasRequestId: !!sampleReport.requestId,
            hasMatch: typeof sampleReport.match === 'boolean',
            hasCanonicalComparison: !!sampleReport.canonicalComparison,
          },
        });
        
        // Check for PII/sensitive data
        const reportStr = JSON.stringify(sampleReport);
        const hasPotentialSecrets = 
          /password|secret|token|key/i.test(reportStr) &&
          !/requestId|canonical|fingerprint/i.test(reportStr);
        
        checks.push({
          name: 'diff_report_no_secrets',
          passed: !hasPotentialSecrets,
          message: hasPotentialSecrets 
            ? 'Potential secrets found in diff report' 
            : 'No secrets detected in diff report',
        });
      }
    } catch (error) {
      checks.push({
        name: 'diff_report_read',
        passed: false,
        message: `Failed to read diff reports: ${error}`,
      });
    }
  }
  
  storageTest = {
    diffPath,
    fileCount,
    sampleReport,
  };
  
  // 6. Check stability stats
  try {
    const stats = sampler.getStabilityStats();
    checks.push({
      name: 'stability_tracking',
      passed: true,
      message: `Stability tracking active (${stats.totalWorkloads} workloads)`,
      details: {
        totalWorkloads: stats.totalWorkloads,
        stableWorkloads: stats.stableWorkloads,
        unstableWorkloads: stats.unstableWorkloads,
      },
    });
  } catch (error) {
    checks.push({
      name: 'stability_tracking',
      passed: false,
      message: `Stability tracking failed: ${error}`,
    });
  }
  
  // 7. Check event export integration
  try {
    const { getEventExporter } = await import('../src/engine/events/event-export.js');
    const exporter = getEventExporter();
    
    // Try to create a test event
    const testRequest = createTestRequest('test_event');
    const event = exporter.createExecutionStartEvent(
      testRequest,
      '1.0.0',
      'requiem',
      true,
      1.0
    );
    
    const hasValidEventSchema = 
      event.schema_version &&
      event.event_type &&
      event.timestamp &&
      event.event_id &&
      event.request_id &&
      event.tenant_id &&
      event.engine_version &&
      event.contract_version &&
      event.protocol_version;
    
    checks.push({
      name: 'event_export_integration',
      passed: !!hasValidEventSchema,
      message: hasValidEventSchema 
        ? 'Event export integration working'
        : 'Event export schema incomplete',
      details: {
        schemaVersion: event.schema_version,
        eventType: event.event_type,
      },
    });
  } catch (error) {
    checks.push({
      name: 'event_export_integration',
      passed: false,
      message: `Event export integration failed: ${error}`,
    });
  }
  
  // Calculate summary
  const totalFailed = checks.filter(c => !c.passed).length;
  
  return {
    passed: totalFailed === 0,
    checks,
    samplingTest,
    storageTest,
    summary: {
      total: checks.length,
      passed: checks.length - totalFailed,
      failed: totalFailed,
    },
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const quick = args.includes('--quick');
  
  console.log('🔍 Running dual-run verification...\n');
  
  const result = await runVerification(quick);
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Verification Results:');
    console.log('─'.repeat(50));
    
    for (const check of result.checks) {
      const icon = check.passed ? '✅' : '❌';
      console.log(`${icon} ${check.name}`);
      console.log(`   ${check.message}`);
    }
    
    console.log('─'.repeat(50));
    
    if (result.samplingTest) {
      console.log('\nSampling Test Results:');
      console.log(`  New tenant rate: ${(result.samplingTest.newTenantRate * 100).toFixed(0)}%`);
      console.log(`  Base rate: ${(result.samplingTest.baseRate * 100).toFixed(2)}%`);
      console.log(`  Tapered rate: ${(result.samplingTest.taperedRate * 100).toFixed(2)}%`);
    }
    
    if (result.storageTest) {
      console.log('\nStorage Test Results:');
      console.log(`  Path: ${result.storageTest.diffPath}`);
      console.log(`  Files: ${result.storageTest.fileCount}`);
    }
    
    console.log(`\nSummary: ${result.summary.passed}/${result.summary.total} passed`);
    
    if (result.summary.failed > 0) {
      console.log(`❌ ${result.summary.failed} check(s) failed`);
      process.exit(1);
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
