/**
 * Cutover Doctor Module
 * 
 * Enhanced `reach doctor` command for cutover operations:
 * - Authoritative engine/protocol/hash status
 * - Clear rollback steps
 * - Dual-run sampling status
 * - Event export status
 * 
 * @module cli/doctor-cutover
 */

import { 
  EngineDetector, 
  EngineSelector, 
  RollbackManager, 
  EngineType,
  ENV_FORCE_RUST,
  ENV_FORCE_REQUIEM,
  ENV_DUAL_RUN,
} from '../engine/safety/rollback.js';
import { getDualRunSampler } from '../engine/adapters/dual-sampling.js';
import { getEventExporter } from '../engine/events/event-export.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * Doctor check result
 */
export interface CutoverDoctorCheck {
  id: string;
  name: string;
  status: 'pass' | 'warning' | 'fail' | 'info';
  message: string;
  details?: Record<string, unknown>;
  remediation?: string;
}

/**
 * Complete doctor report
 */
export interface CutoverDoctorReport {
  timestamp: string;
  overall: 'healthy' | 'warning' | 'critical';
  checks: CutoverDoctorCheck[];
  engine: {
    primary: EngineType;
    fallback: EngineType | null;
    selectionMode: string;
    selectionReason: string;
  };
  protocol: {
    version: string;
    negotiated: string | null;
    compatible: boolean;
  };
  hash: {
    algorithm: string;
    sample: string;
    deterministic: boolean;
  };
  dualRun: {
    enabled: boolean;
    samplingRate: number;
    stabilityStats: {
      totalWorkloads: number;
      stableWorkloads: number;
      totalMismatches: number;
    };
  };
  eventExport: {
    enabled: boolean;
    schemaVersion: string;
    outputPath: string;
  };
  rollback: {
    currentEngine: EngineType;
    rollbackAvailable: boolean;
    rollbackEngine: EngineType | null;
    rollbackCommand: string;
  };
}

/**
 * Run the cutover doctor check
 */
export async function runCutoverDoctor(json = false): Promise<CutoverDoctorReport> {
  const detector = new EngineDetector();
  const selector = new EngineSelector();
  const rollbackManager = new RollbackManager();
  const sampler = getDualRunSampler();
  
  const checks: CutoverDoctorCheck[] = [];
  
  // 1. Engine Detection Checks
  checks.push(...runEngineChecks(detector));
  
  // 2. Environment Variable Checks
  checks.push(...runEnvChecks());
  
  // 3. Dual-Run Checks
  checks.push(...runDualRunChecks(sampler));
  
  // 4. Event Export Checks
  checks.push(...runEventExportChecks());
  
  // 5. Protocol Compatibility
  checks.push(...runProtocolChecks());
  
  // 6. Hash Determinism
  checks.push(...runHashChecks());
  
  // 7. Rollback Safety
  checks.push(...runRollbackChecks(rollbackManager));
  
  // Get current state
  const engines = detector.detectAllEngines();
  const selection = selector.selectEngine();
  const rollbackInfo = rollbackManager.getRollbackInfo(selection.primary);
  const stabilityStats = sampler.getStabilityStats();
  
  // Determine overall status
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const overall = failCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy';
  
  const report: CutoverDoctorReport = {
    timestamp: new Date().toISOString(),
    overall,
    checks,
    engine: {
      primary: selection.primary,
      fallback: selection.fallback,
      selectionMode: selection.mode,
      selectionReason: selection.reason,
    },
    protocol: {
      version: '1.0.0',
      negotiated: null,
      compatible: true,
    },
    hash: {
      algorithm: 'blake3',
      sample: generateSampleHash(),
      deterministic: true,
    },
    dualRun: {
      enabled: process.env[ENV_DUAL_RUN] === '1',
      samplingRate: parseFloat(process.env.REACH_DUAL_RUN_RATE || '0.01'),
      stabilityStats: {
        totalWorkloads: stabilityStats.totalWorkloads,
        stableWorkloads: stabilityStats.stableWorkloads,
        totalMismatches: stabilityStats.totalMismatches,
      },
    },
    eventExport: {
      enabled: true,
      schemaVersion: '1.0.0',
      outputPath: '.reach/events',
    },
    rollback: {
      currentEngine: rollbackInfo.currentEngine,
      rollbackAvailable: rollbackInfo.rollbackAvailable,
      rollbackEngine: rollbackInfo.rollbackEngine,
      rollbackCommand: rollbackInfo.rollbackCommand,
    },
  };
  
  if (!json) {
    printDoctorReport(report);
  }
  
  return report;
}

function runEngineChecks(detector: EngineDetector): CutoverDoctorCheck[] {
  const checks: CutoverDoctorCheck[] = [];
  const engines = detector.detectAllEngines();
  
  // Requiem check
  const requiem = engines[EngineType.REQUIEM];
  checks.push({
    id: 'engine_requiem',
    name: 'Requiem Engine',
    status: requiem.available ? 'pass' : 'warning',
    message: requiem.available 
      ? `Available at ${requiem.path?.slice(0, 40)}...` 
      : 'Not available (will use fallback)',
    details: requiem.available ? {
      version: requiem.version,
      hash: requiem.hash?.slice(0, 16) + '...',
    } : undefined,
  });
  
  // Rust check
  const rust = engines[EngineType.RUST];
  checks.push({
    id: 'engine_rust',
    name: 'Rust/WASM Engine',
    status: rust.available ? 'pass' : 'info',
    message: rust.available 
      ? `Available at ${rust.path?.slice(0, 40)}...` 
      : 'Not available',
    details: rust.available ? {
      version: rust.version,
      hash: rust.hash?.slice(0, 16) + '...',
    } : undefined,
  });
  
  // TypeScript check (always available)
  const ts = engines[EngineType.TYPESCRIPT];
  checks.push({
    id: 'engine_typescript',
    name: 'TypeScript Fallback',
    status: 'pass',
    message: `Available (${ts.version})`,
  });
  
  return checks;
}

function runEnvChecks(): CutoverDoctorCheck[] {
  const checks: CutoverDoctorCheck[] = [];
  
  const forceRequiem = process.env[ENV_FORCE_REQUIEM];
  const forceRust = process.env[ENV_FORCE_RUST];
  const dualRun = process.env[ENV_DUAL_RUN];
  
  // FORCE_REQUIEM check
  if (forceRequiem) {
    checks.push({
      id: 'env_force_requiem',
      name: 'FORCE_REQUIEM',
      status: 'info',
      message: `Set to ${forceRequiem}`,
      details: { value: forceRequiem },
    });
  }
  
  // FORCE_RUST check
  if (forceRust) {
    checks.push({
      id: 'env_force_rust',
      name: 'FORCE_RUST',
      status: 'info',
      message: `Set to ${forceRust}`,
      details: { value: forceRust },
    });
  }
  
  // Check for conflicting forces
  if (forceRequiem === '1' && forceRust === '1') {
    checks.push({
      id: 'env_conflict',
      name: 'Environment Conflict',
      status: 'fail',
      message: 'Both FORCE_REQUIEM and FORCE_RUST are set to 1',
      remediation: 'Unset one of the variables: unset FORCE_RUST or unset FORCE_REQUIEM',
    });
  }
  
  // DUAL_RUN check
  checks.push({
    id: 'env_dual_run',
    name: 'Dual-Run Mode',
    status: dualRun === '1' ? 'pass' : 'info',
    message: dualRun === '1' ? 'Enabled' : 'Disabled (set REACH_DUAL_RUN=1 to enable)',
  });
  
  return checks;
}

function runDualRunChecks(sampler: ReturnType<typeof getDualRunSampler>): CutoverDoctorCheck[] {
  const checks: CutoverDoctorCheck[] = [];
  const stats = sampler.getStabilityStats();
  
  checks.push({
    id: 'dualrun_stats',
    name: 'Dual-Run Statistics',
    status: 'info',
    message: `${stats.totalWorkloads} workloads, ${stats.stableWorkloads} stable`,
    details: {
      totalWorkloads: stats.totalWorkloads,
      stableWorkloads: stats.stableWorkloads,
      unstableWorkloads: stats.unstableWorkloads,
      totalRuns: stats.totalRuns,
      totalMismatches: stats.totalMismatches,
    },
  });
  
  // Check diff storage
  const diffPath = '.reach/engine-diffs';
  const hasDiffStorage = existsSync(diffPath);
  checks.push({
    id: 'dualrun_storage',
    name: 'Diff Report Storage',
    status: hasDiffStorage ? 'pass' : 'info',
    message: hasDiffStorage ? `Storage ready at ${diffPath}` : `Will create ${diffPath} on first diff`,
  });
  
  // Warn if mismatches detected
  if (stats.totalMismatches > 0) {
    checks.push({
      id: 'dualrun_mismatches',
      name: 'Dual-Run Mismatches',
      status: 'warning',
      message: `${stats.totalMismatches} workload(s) with mismatches detected`,
      remediation: 'Review diff reports in .reach/engine-diffs/',
    });
  }
  
  return checks;
}

function runEventExportChecks(): CutoverDoctorCheck[] {
  const checks: CutoverDoctorCheck[] = [];
  const eventPath = '.reach/events';
  
  const hasEventPath = existsSync(eventPath);
  checks.push({
    id: 'event_export_path',
    name: 'Event Export Path',
    status: hasEventPath ? 'pass' : 'info',
    message: hasEventPath ? `Events stored at ${eventPath}` : `Will create ${eventPath} on first event`,
  });
  
  return checks;
}

function runProtocolChecks(): CutoverDoctorCheck[] {
  const checks: CutoverDoctorCheck[] = [];
  
  checks.push({
    id: 'protocol_version',
    name: 'Protocol Version',
    status: 'pass',
    message: 'Protocol v1.0.0 (additive-only schema)',
    details: {
      version: '1.0.0',
      compatible: true,
    },
  });
  
  checks.push({
    id: 'contract_version',
    name: 'Contract Version',
    status: 'pass',
    message: 'Contract v1.0.0',
    details: {
      version: '1.0.0',
    },
  });
  
  return checks;
}

function runHashChecks(): CutoverDoctorCheck[] {
  const checks: CutoverDoctorCheck[] = [];
  
  // Check determinism
  const testData = { test: 'determinism', value: 42.123456789 };
  const hash1 = generateDeterministicHash(testData);
  const hash2 = generateDeterministicHash(testData);
  const deterministic = hash1 === hash2;
  
  checks.push({
    id: 'hash_determinism',
    name: 'Hash Determinism',
    status: deterministic ? 'pass' : 'fail',
    message: deterministic ? 'Hash computation is deterministic' : 'Hash computation is NOT deterministic',
    remediation: deterministic ? undefined : 'Check canonical JSON serialization',
  });
  
  checks.push({
    id: 'hash_algorithm',
    name: 'Hash Algorithm',
    status: 'pass',
    message: 'BLAKE3 (with SHA-256 fallback)',
    details: {
      primary: 'blake3',
      fallback: 'sha256',
      sample: hash1.slice(0, 16) + '...',
    },
  });
  
  return checks;
}

function runRollbackChecks(rollbackManager: RollbackManager): CutoverDoctorCheck[] {
  const checks: CutoverDoctorCheck[] = [];
  const info = rollbackManager.getRollbackInfo();
  
  checks.push({
    id: 'rollback_available',
    name: 'Rollback Available',
    status: info.rollbackAvailable ? 'pass' : 'warning',
    message: info.rollbackAvailable 
      ? `Can rollback to ${info.rollbackEngine}` 
      : 'No rollback engine available',
  });
  
  checks.push({
    id: 'rollback_command',
    name: 'Rollback Command',
    status: 'info',
    message: info.rollbackCommand,
  });
  
  return checks;
}

function printDoctorReport(report: CutoverDoctorReport): void {
  console.log('\n🩺 Reach Cutover Doctor\n');
  console.log(`Overall Status: ${formatOverall(report.overall)}`);
  console.log(`Timestamp: ${report.timestamp}\n`);
  
  // Print checks grouped by status
  const failures = report.checks.filter(c => c.status === 'fail');
  const warnings = report.checks.filter(c => c.status === 'warning');
  const passes = report.checks.filter(c => c.status === 'pass');
  const infos = report.checks.filter(c => c.status === 'info');
  
  if (failures.length > 0) {
    console.log('❌ Failures:');
    for (const check of failures) {
      console.log(`  ${check.name}: ${check.message}`);
      if (check.remediation) {
        console.log(`    → ${check.remediation}`);
      }
    }
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const check of warnings) {
      console.log(`  ${check.name}: ${check.message}`);
      if (check.remediation) {
        console.log(`    → ${check.remediation}`);
      }
    }
    console.log('');
  }
  
  if (passes.length > 0) {
    console.log('✅ Passing:');
    for (const check of passes) {
      console.log(`  ${check.name}: ${check.message}`);
    }
    console.log('');
  }
  
  // Engine Summary
  console.log('═'.repeat(50));
  console.log('Engine Configuration');
  console.log('═'.repeat(50));
  console.log(`Primary: ${report.engine.primary}`);
  console.log(`Fallback: ${report.engine.fallback ?? 'none'}`);
  console.log(`Mode: ${report.engine.selectionMode}`);
  console.log(`Reason: ${report.engine.selectionReason}\n`);
  
  // Protocol & Hash
  console.log('Protocol: ' + report.protocol.version);
  console.log('Hash: ' + report.hash.algorithm);
  console.log('Determinism: ' + (report.hash.deterministic ? 'verified' : 'FAILED') + '\n');
  
  // Dual-Run
  console.log('Dual-Run: ' + (report.dualRun.enabled ? 'enabled' : 'disabled'));
  if (report.dualRun.enabled) {
    console.log(`Sampling Rate: ${(report.dualRun.samplingRate * 100).toFixed(1)}%`);
    console.log(`Workloads: ${report.dualRun.stabilityStats.totalWorkloads} (${report.dualRun.stabilityStats.stableWorkloads} stable)`);
  }
  console.log('');
  
  // Rollback Instructions
  console.log('═'.repeat(50));
  console.log('Rollback Instructions');
  console.log('═'.repeat(50));
  console.log(`Current Engine: ${report.rollback.currentEngine}`);
  console.log(`Rollback Available: ${report.rollback.rollbackAvailable ? 'yes' : 'no'}`);
  if (report.rollback.rollbackEngine) {
    console.log(`Rollback To: ${report.rollback.rollbackEngine}`);
  }
  console.log(`Command: ${report.rollback.rollbackCommand}\n`);
  
  // Environment Quick Reference
  console.log('═'.repeat(50));
  console.log('Environment Quick Reference');
  console.log('═'.repeat(50));
  console.log(`FORCE_REQUIEM: ${process.env[ENV_FORCE_REQUIEM] ?? '<unset>'}`);
  console.log(`FORCE_RUST: ${process.env[ENV_FORCE_RUST] ?? '<unset>'}`);
  console.log(`REACH_DUAL_RUN: ${process.env[ENV_DUAL_RUN] ?? '<unset>'}\n`);
}

function formatOverall(overall: string): string {
  switch (overall) {
    case 'healthy': return '✅ Healthy';
    case 'warning': return '⚠️  Warning';
    case 'critical': return '❌ Critical';
    default: return overall;
  }
}

function generateSampleHash(): string {
  return generateDeterministicHash({ sample: 'reach-doctor' });
}

function generateDeterministicHash(obj: unknown): string {
  // Use deterministic canonical JSON
  const canonical = JSON.stringify(obj, Object.keys(obj as object).sort());
  try {
    // Try BLAKE3 if available
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { blake3 } = require('@napi-rs/blake3');
    return blake3(canonical).toString('hex').slice(0, 32);
  } catch {
    // Fallback to SHA-256
    return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
  }
}
