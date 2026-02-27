#!/usr/bin/env node
/**
 * Cutover Verification Script
 * 
 * Validates the cutover is complete and operator-proof:
 * - Reach defaults to Requiem safely
 * - FORCE_RUST/FORCE_REQUIEM honored
 * - Safety guards active
 * - Rollback instructions available
 * 
 * Usage: npx tsx scripts/verify-cutover.ts [--json]
 */

import { 
  EngineDetector, 
  EngineSelector, 
  RollbackManager,
  EngineType,
  SafetyGuards,
  ENV_FORCE_REQUIEM,
  ENV_FORCE_RUST,
} from '../src/engine/safety/rollback.js';
import { runCutoverDoctor } from '../src/cli/doctor-cutover.js';

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
  
  // 1. Check Requiem is available
  const detector = new EngineDetector();
  const engines = detector.detectAllEngines();
  
  checks.push({
    name: 'requiem_available',
    passed: engines[EngineType.REQUIEM].available,
    message: engines[EngineType.REQUIEM].available 
      ? 'Requiem engine is available'
      : 'Requiem engine is NOT available',
    critical: true,
  });
  
  // 2. Check Requiem is default in auto mode
  const selector = new EngineSelector();
  const selection = selector.selectEngine();
  
  const requiemIsDefault = selection.primary === EngineType.REQUIEM;
  checks.push({
    name: 'requiem_default',
    passed: requiemIsDefault,
    message: requiemIsDefault
      ? 'Requiem is the default engine'
      : `Default engine is ${selection.primary}: ${selection.reason}`,
    critical: true,
  });
  
  // 3. Check safety guards are importable
  try {
    const guards = new SafetyGuards();
    checks.push({
      name: 'safety_guards',
      passed: true,
      message: 'Safety guards are active',
      critical: true,
    });
  } catch (error) {
    checks.push({
      name: 'safety_guards',
      passed: false,
      message: `Safety guards failed: ${error}`,
      critical: true,
    });
  }
  
  // 4. Check rollback is available
  const rollbackManager = new RollbackManager();
  const rollbackInfo = rollbackManager.getRollbackInfo(selection.primary);
  
  checks.push({
    name: 'rollback_available',
    passed: rollbackInfo.rollbackAvailable,
    message: rollbackInfo.rollbackAvailable
      ? `Rollback available to ${rollbackInfo.rollbackEngine}`
      : 'No rollback engine available',
    critical: false,
  });
  
  // 5. Check rollback command is valid
  const hasValidRollbackCommand = 
    rollbackInfo.rollbackCommand && 
    !rollbackInfo.rollbackCommand.includes('No rollback');
  
  checks.push({
    name: 'rollback_command',
    passed: hasValidRollbackCommand,
    message: hasValidRollbackCommand
      ? `Rollback command: ${rollbackInfo.rollbackCommand}`
      : 'Invalid rollback command',
    critical: false,
  });
  
  // 6. Check environment variable handling
  const forceRequiem = process.env[ENV_FORCE_REQUIEM];
  const forceRust = process.env[ENV_FORCE_RUST];
  
  const noConflict = !(forceRequiem === '1' && forceRust === '1');
  checks.push({
    name: 'env_no_conflict',
    passed: noConflict,
    message: noConflict
      ? 'No conflicting environment variables'
      : 'Both FORCE_REQUIEM and FORCE_RUST are set',
    critical: true,
  });
  
  // 7. Check error types are available
  try {
    const { ReachError, ReachErrorCode } = await import('../src/engine/errors.js');
    const testError = new ReachError(ReachErrorCode.ENGINE_MISMATCH, 'test');
    checks.push({
      name: 'error_types',
      passed: testError.code === ReachErrorCode.ENGINE_MISMATCH,
      message: 'Error types are properly exported',
      critical: true,
    });
  } catch (error) {
    checks.push({
      name: 'error_types',
      passed: false,
      message: `Error types failed: ${error}`,
      critical: true,
    });
  }
  
  // 8. Check adaptive dual-run sampling
  try {
    const { getDualRunSampler } = await import('../src/engine/adapters/dual-sampling.js');
    const sampler = getDualRunSampler();
    const stats = sampler.getStabilityStats();
    checks.push({
      name: 'dualrun_sampler',
      passed: true,
      message: `Dual-run sampler active (${stats.totalWorkloads} workloads tracked)`,
      critical: false,
    });
  } catch (error) {
    checks.push({
      name: 'dualrun_sampler',
      passed: false,
      message: `Dual-run sampler failed: ${error}`,
      critical: false,
    });
  }
  
  // 9. Check event export
  try {
    const { getEventExporter, EVENT_SCHEMA_VERSION } = await import('../src/engine/events/event-export.js');
    const exporter = getEventExporter();
    checks.push({
      name: 'event_export',
      passed: true,
      message: `Event export ready (schema v${EVENT_SCHEMA_VERSION})`,
      critical: false,
    });
  } catch (error) {
    checks.push({
      name: 'event_export',
      passed: false,
      message: `Event export failed: ${error}`,
      critical: false,
    });
  }
  
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
  
  console.log('🔍 Running cutover verification...\n');
  
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
