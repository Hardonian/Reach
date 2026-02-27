/**
 * Adaptive Dual-Run Sampling
 * 
 * Implements intelligent sampling for dual-run comparisons:
 * - 100% sampling for new tenants, versions, or algorithms
 * - Tapers down after stability is established
 * - Stores diff reports under .reach/engine-diffs/
 * - Compares canonical bytes/normalized structs (not presentation)
 * 
 * @module engine/adapters/dual-sampling
 */

import { ExecRequest, ExecResult } from '../contract';
import { compareExecResults } from '../translate';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { hasFloatingPointValues } from '../utils/validation';

/**
 * Sampling configuration for adaptive dual-run
 */
export interface SamplingConfig {
  /** Base sampling rate (0-1) for stable workloads */
  baseRate: number;
  /** Rate for new tenants (0-1) */
  newTenantRate: number;
  /** Rate for new engine versions (0-1) */
  newVersionRate: number;
  /** Rate for new algorithms (0-1) */
  newAlgorithmRate: number;
  /** Number of stable runs before tapering to base rate */
  stabilityThreshold: number;
  /** Storage path for diff reports */
  diffStoragePath: string;
}

/**
 * Diff report structure for storage
 */
export interface DiffReport {
  version: 'dual-run-diff.v1';
  requestId: string;
  timestamp: string;
  tenantId: string;
  engineVersion: string;
  contractVersion: string;
  algorithm: string;
  match: boolean;
  differences: string[];
  canonicalComparison: {
    primaryFingerprint: string;
    secondaryFingerprint: string;
    fingerprintMatch: boolean;
  };
  samplingMetadata: {
    rateApplied: number;
    isNewTenant: boolean;
    isNewVersion: boolean;
    isNewAlgorithm: boolean;
    stabilityCount: number;
  };
}

/**
 * Stability tracker for workloads
 */
interface WorkloadStability {
  tenantId: string;
  engineVersion: string;
  algorithm: string;
  runCount: number;
  lastMismatchAt: number | null;
  consecutiveMatches: number;
}

/**
 * Default sampling configuration
 */
export const DEFAULT_SAMPLING_CONFIG: SamplingConfig = {
  baseRate: 0.01, // 1% for stable workloads
  newTenantRate: 1.0, // 100% for new tenants
  newVersionRate: 1.0, // 100% for new engine versions
  newAlgorithmRate: 1.0, // 100% for new algorithms
  stabilityThreshold: 100, // 100 stable runs before tapering
  diffStoragePath: '.reach/engine-diffs',
};

/**
 * Adaptive dual-run sampler
 */
export class AdaptiveDualRunSampler {
  private config: SamplingConfig;
  private stabilityMap = new Map<string, WorkloadStability>();
  private knownTenants = new Set<string>();
  private knownVersions = new Set<string>();
  private knownAlgorithms = new Set<string>();
  
  // Contract version for compatibility checks
  private readonly CONTRACT_VERSION = '1.0.0';
  
  constructor(config: Partial<SamplingConfig> = {}) {
    this.config = { ...DEFAULT_SAMPLING_CONFIG, ...config };
    this.ensureStorageDirectory();
    this.loadKnownWorkloads();
  }
  
  /**
   * Determine if dual-run should be executed for this request
   */
  shouldSample(request: ExecRequest, engineVersion: string): boolean {
    // Do not sample invalid requests (e.g. containing floats)
    if (!this.validateInput(request).valid) {
      return false;
    }

    const tenantId = this.extractTenantId(request);
    const algorithm = request.params.algorithm;
    
    const isNewTenant = !this.knownTenants.has(tenantId);
    const isNewVersion = !this.knownVersions.has(engineVersion);
    const isNewAlgorithm = !this.knownAlgorithms.has(algorithm);
    
    // Always sample new workloads at 100%
    if (isNewTenant || isNewVersion || isNewAlgorithm) {
      return true;
    }
    
    // For known workloads, check stability and apply base rate
    const key = this.getStabilityKey(tenantId, engineVersion, algorithm);
    const stability = this.stabilityMap.get(key);
    
    if (!stability) {
      // First time seeing this combination
      return true;
    }
    
    // If we haven't reached stability threshold, keep sampling
    if (stability.consecutiveMatches < this.config.stabilityThreshold) {
      // Gradual taper: sample at 100% initially, taper down
      const taperRate = Math.max(
        this.config.baseRate,
        1.0 - (stability.consecutiveMatches / this.config.stabilityThreshold)
      );
      return Math.random() < taperRate;
    }
    
    // Stable workload - use base rate
    return Math.random() < this.config.baseRate;
  }
  
  /**
   * Validate that input is suitable for sampling
   */
  validateInput(request: ExecRequest): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    // Check for floating point values
    if (request.params.outcomes && hasFloatingPointValues(request.params.outcomes)) {
      errors.push('floating_point_values_detected: outcomes must be integers for deterministic fixed-point arithmetic');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get the sampling rate that will be applied for a request
   */
  getSamplingRate(request: ExecRequest, engineVersion: string): number {
    const tenantId = this.extractTenantId(request);
    const algorithm = request.params.algorithm;
    
    const isNewTenant = !this.knownTenants.has(tenantId);
    const isNewVersion = !this.knownVersions.has(engineVersion);
    const isNewAlgorithm = !this.knownAlgorithms.has(algorithm);
    
    if (isNewTenant) return this.config.newTenantRate;
    if (isNewVersion) return this.config.newVersionRate;
    if (isNewAlgorithm) return this.config.newAlgorithmRate;
    
    const key = this.getStabilityKey(tenantId, engineVersion, algorithm);
    const stability = this.stabilityMap.get(key);
    
    if (!stability || stability.consecutiveMatches < this.config.stabilityThreshold) {
      // Gradual taper
      return Math.max(
        this.config.baseRate,
        1.0 - (stability?.consecutiveMatches ?? 0 / this.config.stabilityThreshold)
      );
    }
    
    return this.config.baseRate;
  }
  
  /**
   * Record a comparison result and update stability tracking
   */
  recordResult(
    request: ExecRequest,
    primaryResult: ExecResult,
    secondaryResult: ExecResult,
    engineVersion: string
  ): DiffReport {
    const tenantId = this.extractTenantId(request);
    const algorithm = request.params.algorithm;
    
    const comparison = compareExecResults(primaryResult, secondaryResult);
    
    // Update stability tracking
    const key = this.getStabilityKey(tenantId, engineVersion, algorithm);
    let stability = this.stabilityMap.get(key);
    
    if (!stability) {
      stability = {
        tenantId,
        engineVersion,
        algorithm,
        runCount: 0,
        lastMismatchAt: null,
        consecutiveMatches: 0,
      };
      this.stabilityMap.set(key, stability);
    }
    
    stability.runCount++;
    
    if (comparison.match) {
      stability.consecutiveMatches++;
    } else {
      stability.consecutiveMatches = 0;
      stability.lastMismatchAt = Date.now();
    }
    
    // Mark as known after first observation
    this.knownTenants.add(tenantId);
    this.knownVersions.add(engineVersion);
    this.knownAlgorithms.add(algorithm);
    
    // Generate and store diff report
    const report: DiffReport = {
      version: 'dual-run-diff.v1',
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      tenantId,
      engineVersion,
      contractVersion: this.CONTRACT_VERSION,
      algorithm,
      match: comparison.match,
      differences: comparison.differences,
      canonicalComparison: {
        primaryFingerprint: primaryResult.fingerprint,
        secondaryFingerprint: secondaryResult.fingerprint,
        fingerprintMatch: primaryResult.fingerprint === secondaryResult.fingerprint,
      },
      samplingMetadata: {
        rateApplied: this.getSamplingRate(request, engineVersion),
        isNewTenant: !this.knownTenants.has(tenantId) || stability.runCount <= 1,
        isNewVersion: !this.knownVersions.has(engineVersion) || stability.runCount <= 1,
        isNewAlgorithm: !this.knownAlgorithms.has(algorithm) || stability.runCount <= 1,
        stabilityCount: stability.consecutiveMatches,
      },
    };
    
    this.storeDiffReport(report);
    
    return report;
  }
  
  /**
   * Store a diff report to disk
   */
  private storeDiffReport(report: DiffReport): void {
    try {
      // Sanitize requestId for filename
      const sanitizedId = report.requestId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
      const filename = `${sanitizedId}.json`;
      const filepath = join(this.config.diffStoragePath, filename);
      
      // Write atomically using temp file
      const tempPath = filepath + '.tmp';
      writeFileSync(tempPath, JSON.stringify(report, null, 2));
      
      // Atomic rename (works on POSIX, best effort on Windows)
      try {
        // Use fs module directly for sync rename
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        fs.renameSync(tempPath, filepath);
      } catch {
        // Fallback: just write directly if rename fails
        writeFileSync(filepath, JSON.stringify(report, null, 2));
      }
    } catch (error) {
      // Log but don't fail - dual-run is best-effort
      console.error('[DualRun] Failed to store diff report:', error);
    }
  }
  
  /**
   * Ensure the storage directory exists
   */
  private ensureStorageDirectory(): void {
    if (!existsSync(this.config.diffStoragePath)) {
      mkdirSync(this.config.diffStoragePath, { recursive: true });
    }
  }
  
  /**
   * Load known workloads from existing diff reports
   */
  private loadKnownWorkloads(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readdirSync, readFileSync } = require('fs');
      
      if (!existsSync(this.config.diffStoragePath)) {
        return;
      }
      
      const files = readdirSync(this.config.diffStoragePath)
        .filter((f: string) => f.endsWith('.json') && !f.endsWith('.tmp'));
      
      for (const file of files.slice(-1000)) { // Load last 1000 reports
        try {
          const content = readFileSync(join(this.config.diffStoragePath, file), 'utf-8');
          const report = JSON.parse(content) as DiffReport;
          
          if (report.tenantId) this.knownTenants.add(report.tenantId);
          if (report.engineVersion) this.knownVersions.add(report.engineVersion);
          if (report.algorithm) this.knownAlgorithms.add(report.algorithm);
          
          // Restore stability tracking
          const key = this.getStabilityKey(report.tenantId, report.engineVersion, report.algorithm);
          const existing = this.stabilityMap.get(key);
          
          if (!existing || new Date(report.timestamp) > new Date(existing.lastMismatchAt || 0)) {
            this.stabilityMap.set(key, {
              tenantId: report.tenantId,
              engineVersion: report.engineVersion,
              algorithm: report.algorithm,
              runCount: existing?.runCount ?? 0 + 1,
              lastMismatchAt: report.match ? (existing?.lastMismatchAt ?? null) : Date.now(),
              consecutiveMatches: report.match ? (existing?.consecutiveMatches ?? 0 + 1) : 0,
            });
          }
        } catch {
          // Skip corrupted files
        }
      }
    } catch (error) {
      console.error('[DualRun] Failed to load known workloads:', error);
    }
  }
  
  /**
   * Extract tenant ID from request
   */
  private extractTenantId(request: ExecRequest): string {
    // First check metadata if present
    const metadata = (request as unknown as Record<string, unknown>).metadata;
    if (metadata && typeof metadata === 'object' && 'tenantId' in metadata) {
      return String(metadata.tenantId);
    }
    
    // Fall back to deriving from requestId (deterministic)
    return this.deriveTenantFromRequestId(request.requestId);
  }
  
  /**
   * Derive a stable tenant ID from requestId
   */
  private deriveTenantFromRequestId(requestId: string): string {
    // Use hash prefix as tenant discriminator
    const hash = createHash('sha256').update(requestId).digest('hex');
    return `tenant_${hash.slice(0, 8)}`;
  }
  
  /**
   * Get stability tracking key
   */
  private getStabilityKey(tenantId: string, engineVersion: string, algorithm: string): string {
    return `${tenantId}:${engineVersion}:${algorithm}`;
  }
  
  /**
   * Get current stability statistics
   */
  getStabilityStats(): {
    totalWorkloads: number;
    stableWorkloads: number;
    unstableWorkloads: number;
    totalRuns: number;
    totalMismatches: number;
  } {
    let totalRuns = 0;
    let totalMismatches = 0;
    let stableWorkloads = 0;
    
    for (const stability of Array.from(this.stabilityMap.values())) {
      totalRuns += stability.runCount;
      if (stability.lastMismatchAt) totalMismatches++;
      if (stability.consecutiveMatches >= this.config.stabilityThreshold) {
        stableWorkloads++;
      }
    }
    
    return {
      totalWorkloads: this.stabilityMap.size,
      stableWorkloads,
      unstableWorkloads: this.stabilityMap.size - stableWorkloads,
      totalRuns,
      totalMismatches,
    };
  }
  
  /**
   * Reset stability for a specific workload (e.g., after engine update)
   */
  resetStability(tenantId?: string, engineVersion?: string, algorithm?: string): void {
    for (const [, stability] of Array.from(this.stabilityMap.entries())) {
      if (
        (!tenantId || stability.tenantId === tenantId) &&
        (!engineVersion || stability.engineVersion === engineVersion) &&
        (!algorithm || stability.algorithm === algorithm)
      ) {
        stability.consecutiveMatches = 0;
        stability.runCount = 0;
      }
    }
  }
}

// Singleton instance
let samplerInstance: AdaptiveDualRunSampler | undefined;

/**
 * Get or create the singleton sampler
 */
export function getDualRunSampler(config?: Partial<SamplingConfig>): AdaptiveDualRunSampler {
  if (!samplerInstance) {
    samplerInstance = new AdaptiveDualRunSampler(config);
  }
  return samplerInstance;
}

/**
 * Reset the sampler instance (for testing)
 */
export function resetDualRunSampler(): void {
  samplerInstance = undefined;
}
