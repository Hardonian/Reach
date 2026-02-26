/**
 * Dual-Run Engine Adapter
 * 
 * Runs both Requiem and Rust engines in parallel/sequence and compares results.
 * Used for safety validation during engine cutover.
 * 
 * @module engine/adapters/dual
 */

import { BaseEngineAdapter, DualRunAdapter, EngineAdapter } from './base';
import {
  ExecRequest,
  ExecResult,
  EngineHealth,
  EngineCapabilities,
  DualRunResult,
  EngineComparison,
  EngineDifference,
  EngineConfig,
  EngineType,
} from '../contract';
import { createRequiemAdapter, RequiemEngineAdapter } from './requiem';
import { createRustAdapter, RustEngineAdapter } from './rust';
import { compareExecResults, toCanonicalJson } from '../translate';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dual-Run Engine Adapter
 * 
 * Executes requests on both engines and compares results.
 * Primary engine result is returned; secondary is used for comparison.
 */
export class DualRunEngineAdapter extends BaseEngineAdapter implements DualRunAdapter {
  readonly name = 'DualRunEngine';
  readonly engineType: EngineType = 'dual';
  
  private primary: EngineAdapter;
  private secondary: EngineAdapter;
  private config: EngineConfig;
  private diffDir: string;
  
  constructor(
    primary: EngineAdapter,
    secondary: EngineAdapter,
    config?: Partial<EngineConfig>,
  ) {
    super();
    this.primary = primary;
    this.secondary = secondary;
    this.config = {
      ...require('../contract').DEFAULT_ENGINE_CONFIG,
      ...config,
      defaultEngine: 'dual',
    };
    this.diffDir = path.join(process.cwd(), '.reach', 'engine-diffs');
  }
  
  async initialize(): Promise<void> {
    // Initialize both engines
    await Promise.all([
      this.initializeAdapter(this.primary),
      this.initializeAdapter(this.secondary),
    ]);
    
    // Ensure diff directory exists
    if (!fs.existsSync(this.diffDir)) {
      fs.mkdirSync(this.diffDir, { recursive: true });
    }
    
    this.isInitialized = true;
  }
  
  private async initializeAdapter(adapter: EngineAdapter): Promise<void> {
    if (adapter.initialize) {
      await adapter.initialize();
    }
  }
  
  async execute(request: ExecRequest): Promise<ExecResult> {
    // Run dual execution and return primary result
    const dualResult = await this.executeDual(request);
    return dualResult.primary;
  }
  
  async executeDual(request: ExecRequest): Promise<DualRunResult> {
    this.validateRequest(request);
    
    const startTime = Date.now();
    
    // Execute both engines (sequential for determinism, parallel for speed)
    const [primaryResult, secondaryResult] = await this.executeBoth(request);
    
    // Compare results
    const comparison = this.compareResults(primaryResult, secondaryResult);
    
    // Write diff report if there are differences
    let diffReportPath: string | undefined;
    if (!comparison.match || this.config.dualSampleRate > 0) {
      diffReportPath = await this.writeDiffReport(request, primaryResult, secondaryResult, comparison);
    }
    
    // Log comparison results
    if (!comparison.match) {
      console.warn(`[DualRunEngine] Mismatch detected: ${comparison.differences.length} differences`);
      console.warn(`[DualRunEngine] Diff report: ${diffReportPath}`);
      
      if (this.config.dualFailOnMismatch && comparison.severity === 'critical') {
        throw new Error(`Critical engine mismatch: ${comparison.differences.map(d => d.field).join(', ')}`);
      }
    }
    
    return {
      primary: primaryResult,
      secondary: secondaryResult,
      comparison,
      diffReportPath,
    };
  }
  
  /**
   * Execute both engines
   */
  private async executeBoth(request: ExecRequest): Promise<[ExecResult, ExecResult]> {
    // For determinism, execute sequentially (primary first)
    // For speed, could use Promise.all - but that may affect results
    
    const primaryResult = await this.primary.execute(request);
    
    try {
      const secondaryResult = await this.secondary.execute(request);
      return [primaryResult, secondaryResult];
    } catch (error) {
      // If secondary fails, still return primary but log the error
      console.warn('[DualRunEngine] Secondary engine failed:', error);
      
      // Create error result for secondary
      const errorResult: ExecResult = {
        requestId: request.requestId,
        status: 'failure',
        recommendedAction: '',
        ranking: [],
        trace: { algorithm: 'unknown' },
        fingerprint: '',
        meta: {
          engine: this.secondary.engineType as EngineType,
          engineVersion: 'error',
          durationMs: 0,
          completedAt: new Date().toISOString(),
        },
        error: {
          code: 'E_INTERNAL',
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
      };
      
      return [primaryResult, errorResult];
    }
  }
  
  /**
   * Compare two execution results
   */
  private compareResults(primary: ExecResult, secondary: ExecResult): EngineComparison {
    const differences: EngineDifference[] = [];
    
    // Compare status
    if (primary.status !== secondary.status) {
      differences.push({
        field: 'status',
        primary: primary.status,
        secondary: secondary.status,
        type: 'value',
      });
    }
    
    // Compare recommended action
    if (primary.recommendedAction !== secondary.recommendedAction) {
      differences.push({
        field: 'recommendedAction',
        primary: primary.recommendedAction,
        secondary: secondary.recommendedAction,
        type: 'value',
      });
    }
    
    // Compare ranking
    const rankingMatch = this.arraysEqual(primary.ranking, secondary.ranking);
    if (!rankingMatch) {
      differences.push({
        field: 'ranking',
        primary: primary.ranking,
        secondary: secondary.ranking,
        type: 'value',
      });
    }
    
    // Compare fingerprint (only if both have valid fingerprints)
    if (primary.fingerprint && secondary.fingerprint) {
      if (primary.fingerprint !== secondary.fingerprint) {
        differences.push({
          field: 'fingerprint',
          primary: primary.fingerprint,
          secondary: secondary.fingerprint,
          type: 'value',
        });
      }
    }
    
    // Compare algorithm
    if (primary.trace.algorithm !== secondary.trace.algorithm) {
      differences.push({
        field: 'trace.algorithm',
        primary: primary.trace.algorithm,
        secondary: secondary.trace.algorithm,
        type: 'value',
      });
    }
    
    // Determine severity
    let severity: EngineComparison['severity'] = 'none';
    if (differences.length > 0) {
      const hasCritical = differences.some(d => 
        d.field === 'recommendedAction' || d.field === 'fingerprint'
      );
      const hasMajor = differences.some(d => 
        d.field === 'ranking' || d.field === 'status'
      );
      
      if (hasCritical) {
        severity = 'critical';
      } else if (hasMajor) {
        severity = 'major';
      } else {
        severity = 'minor';
      }
    }
    
    return {
      match: differences.length === 0,
      severity,
      differences,
    };
  }
  
  /**
   * Check if two arrays are equal
   */
  private arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  
  /**
   * Write diff report to disk
   */
  private async writeDiffReport(
    request: ExecRequest,
    primary: ExecResult,
    secondary: ExecResult,
    comparison: EngineComparison,
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${request.requestId}.json`;
    const filepath = path.join(this.diffDir, filename);
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: request.requestId,
        primaryEngine: primary.meta.engine,
        secondaryEngine: secondary.meta.engine,
        comparison,
      },
      request: {
        algorithm: request.params.algorithm,
        actions: request.params.actions,
        states: request.params.states,
      },
      results: {
        primary: this.sanitizeResult(primary),
        secondary: this.sanitizeResult(secondary),
      },
      diff: comparison.differences,
    };
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    
    return filepath;
  }
  
  /**
   * Sanitize result for diff report (remove large data structures)
   */
  private sanitizeResult(result: ExecResult): unknown {
    return {
      status: result.status,
      recommendedAction: result.recommendedAction,
      ranking: result.ranking,
      fingerprint: result.fingerprint,
      meta: result.meta,
      error: result.error,
      // Omit full trace to keep diff report manageable
      traceSummary: {
        algorithm: result.trace.algorithm,
      },
    };
  }
  
  async health(): Promise<EngineHealth> {
    const [primaryHealth, secondaryHealth] = await Promise.all([
      this.primary.health(),
      this.secondary.health(),
    ]);
    
    const healthy = primaryHealth.healthy && secondaryHealth.healthy;
    
    return {
      healthy,
      engine: 'dual',
      version: `primary:${primaryHealth.version}/secondary:${secondaryHealth.version}`,
      lastError: !healthy 
        ? `Primary: ${primaryHealth.lastError || 'OK'}, Secondary: ${secondaryHealth.lastError || 'OK'}`
        : undefined,
      checkedAt: new Date().toISOString(),
    };
  }
  
  async capabilities(): Promise<EngineCapabilities> {
    const [primaryCaps, secondaryCaps] = await Promise.all([
      this.primary.capabilities(),
      this.secondary.capabilities(),
    ]);
    
    // Return intersection of capabilities
    return {
      deterministicHashing: primaryCaps.deterministicHashing && secondaryCaps.deterministicHashing,
      casSupport: primaryCaps.casSupport || secondaryCaps.casSupport,
      replayValidation: primaryCaps.replayValidation || secondaryCaps.replayValidation,
      sandboxing: primaryCaps.sandboxing || secondaryCaps.sandboxing,
      windowsSupport: primaryCaps.windowsSupport && secondaryCaps.windowsSupport,
      daemonMode: primaryCaps.daemonMode || secondaryCaps.daemonMode,
      version: `dual:${primaryCaps.version}+${secondaryCaps.version}`,
    };
  }
  
  async version(): Promise<string> {
    const [primaryVersion, secondaryVersion] = await Promise.all([
      this.primary.version(),
      this.secondary.version(),
    ]);
    
    return `dual:${primaryVersion}+${secondaryVersion}`;
  }
  
  async shutdown(): Promise<void> {
    await Promise.all([
      this.shutdownAdapter(this.primary),
      this.shutdownAdapter(this.secondary),
    ]);
    
    this.isInitialized = false;
  }
  
  private async shutdownAdapter(adapter: EngineAdapter): Promise<void> {
    if (adapter.shutdown) {
      await adapter.shutdown();
    }
  }
}

/**
 * Create a dual-run engine adapter with default engines
 */
export function createDualAdapter(
  config?: Partial<EngineConfig>,
): DualRunEngineAdapter {
  const primary = createRequiemAdapter(config);
  const secondary = createRustAdapter();
  
  return new DualRunEngineAdapter(primary, secondary, config);
}

/**
 * Create a dual-run engine adapter with custom engines
 */
export function createCustomDualAdapter(
  primary: EngineAdapter,
  secondary: EngineAdapter,
  config?: Partial<EngineConfig>,
): DualRunEngineAdapter {
  return new DualRunEngineAdapter(primary, secondary, config);
}
