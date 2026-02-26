/**
 * Dual Engine Ghost Comparison
 * 
 * Executes dual-run comparisons asynchronously after returning results to the user.
 * This runs both Requiem and Rust engines in parallel, compares their outputs,
 * and logs the results for audit/verification purposes without adding latency
 * to the user's request.
 * 
 * @module engine/adapters/dual
 */

import { ExecRequest, ExecResult } from '../contract';
import { compareExecResults } from '../translate';
import { getRequiemEngine } from './requiem';
import { getRustEngine } from './rust';
import { deriveSeed } from './base';

/**
 * Result of a ghost comparison between two engines
 */
export interface GhostComparisonResult {
  requestId: string;
  timestamp: string;
  match: boolean;
  differences: string[];
  requiemResult?: ExecResult;
  rustResult?: ExecResult;
  comparisonDurationMs: number;
  error?: string;
}

/**
 * Configuration for ghost comparison
 */
export interface GhostComparisonConfig {
  /**
   * Enable or disable ghost comparison (default: true in production)
   */
  enabled?: boolean;
  
  /**
   * Store comparison results for later retrieval (default: true)
   */
  storeResults?: boolean;
  
  /**
   * Log comparison results to console (default: false - use structured logging)
   */
  verbose?: boolean;
}

// In-memory store for comparison results (production would use proper storage)
const comparisonResultsStore = new Map<string, GhostComparisonResult>();

/**
 * Execute ghost comparison asynchronously (fire-and-forget)
 * 
 * This runs after the user response has been sent to avoid P99 latency regressions.
 * Both engines run in parallel, then results are compared.
 * 
 * @param request - The original execution request
 * @param primaryResult - The result already returned to the user
 * @param config - Optional configuration
 */
export function runGhostComparison(
  request: ExecRequest,
  primaryResult: ExecResult,
  config: GhostComparisonConfig = {}
): void {
  const { enabled = true, storeResults = true, verbose = false } = config;
  
  if (!enabled) {
    return;
  }
  
  // Fire-and-forget - don't await, don't block user response
  (async () => {
    try {
      const comparisonResult = await executeGhostComparison(request, primaryResult, verbose);
      
      if (storeResults) {
        storeComparisonResult(comparisonResult);
      }
    } catch (error) {
      // Log error but don't fail - ghost comparison should not affect user experience
      console.error('[GhostComparison] Error during comparison:', error);
    }
  })();
}

/**
 * Execute the actual ghost comparison
 */
async function executeGhostComparison(
  request: ExecRequest,
  primaryResult: ExecResult,
  verbose: boolean
): Promise<GhostComparisonResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Ensure seed is derived for deterministic execution
  const seed = request.params.seed ?? deriveSeed(request.requestId);
  const requestWithSeed: ExecRequest = {
    ...request,
    params: {
      ...request.params,
      seed,
    },
  };
  
  // Run both engines in parallel
  const [requiemResult, rustResult] = await Promise.all([
    executeWithRequiem(requestWithSeed),
    executeWithRust(requestWithSeed),
  ]);
  
  const comparisonDurationMs = Date.now() - startTime;
  
  // Determine which engine was the primary (user-facing)
  const primaryEngine = primaryResult.meta.engine;
  
  // Compare results
  let comparison: { match: boolean; differences: string[] };
  
  if (primaryEngine === 'requiem' && requiemResult) {
    comparison = compareExecResults(primaryResult, requiemResult);
  } else if (primaryEngine === 'rust' && rustResult) {
    comparison = compareExecResults(primaryResult, rustResult);
  } else {
    // Fallback: compare both results if primary engine result not available
    if (requiemResult && rustResult) {
      comparison = compareExecResults(requiemResult, rustResult);
    } else {
      comparison = {
        match: false,
        differences: ['One or both engine results unavailable for comparison'],
      };
    }
  }
  
  const result: GhostComparisonResult = {
    requestId: request.requestId,
    timestamp,
    match: comparison.match,
    differences: comparison.differences,
    requiemResult,
    rustResult,
    comparisonDurationMs,
  };
  
  // Log comparison results
  if (verbose || !comparison.match) {
    logComparisonResult(result);
  }
  
  return result;
}

/**
 * Execute with Requiem engine
 */
async function executeWithRequiem(request: ExecRequest): Promise<ExecResult | undefined> {
  try {
    const engine = getRequiemEngine();
    
    if (!engine.isReady()) {
      const configured = await engine.configure();
      if (!configured) {
        return undefined;
      }
    }
    
    return await engine.evaluate(request);
  } catch (error) {
    console.warn('[GhostComparison] Requiem engine error:', error);
    return undefined;
  }
}

/**
 * Execute with Rust engine
 */
async function executeWithRust(request: ExecRequest): Promise<ExecResult | undefined> {
  try {
    const engine = getRustEngine();
    
    if (!engine.isReady()) {
      // Try to initialize - this might fail if WASM not available
      try {
        await engine.initialize();
      } catch {
        return undefined;
      }
    }
    
    return await engine.evaluate(request);
  } catch (error) {
    console.warn('[GhostComparison] Rust engine error:', error);
    return undefined;
  }
}

/**
 * Log comparison result in structured format for audit
 */
function logComparisonResult(result: GhostComparisonResult): void {
  const logEntry = {
    type: 'GHOST_COMPARISON',
    requestId: result.requestId,
    timestamp: result.timestamp,
    match: result.match,
    differences: result.differences,
    durationMs: result.comparisonDurationMs,
    engines: {
      requiem: result.requiemResult ? {
        recommendedAction: result.requiemResult.recommendedAction,
        fingerprint: result.requiemResult.fingerprint,
        status: result.requiemResult.status,
      } : null,
      rust: result.rustResult ? {
        recommendedAction: result.rustResult.recommendedAction,
        fingerprint: result.rustResult.fingerprint,
        status: result.rustResult.status,
      } : null,
    },
  };
  
  if (result.match) {
    console.log('[GhostComparison] ✅ Match:', JSON.stringify(logEntry));
  } else {
    console.warn('[GhostComparison] ❌ Mismatch:', JSON.stringify(logEntry));
  }
}

/**
 * Store comparison result for later retrieval
 */
function storeComparisonResult(result: GhostComparisonResult): void {
  // Store by requestId for easy retrieval
  comparisonResultsStore.set(result.requestId, result);
  
  // Prune old entries if store gets too large (keep last 1000)
  if (comparisonResultsStore.size > 1000) {
    const keys = Array.from(comparisonResultsStore.keys()).slice(0, 100);
    for (const key of keys) {
      comparisonResultsStore.delete(key);
    }
  }
}

/**
 * Get comparison result for a specific request
 */
export function getComparisonResult(requestId: string): GhostComparisonResult | undefined {
  return comparisonResultsStore.get(requestId);
}

/**
 * Get all comparison results
 */
export function getAllComparisonResults(): GhostComparisonResult[] {
  return Array.from(comparisonResultsStore.values());
}

/**
 * Clear comparison results store (useful for testing)
 */
export function clearComparisonResults(): void {
  comparisonResultsStore.clear();
}

/**
 * Get comparison statistics
 */
export function getComparisonStats(): {
  total: number;
  matches: number;
  mismatches: number;
  matchRate: number;
  averageDurationMs: number;
} {
  const results = getAllComparisonResults();
  
  if (results.length === 0) {
    return {
      total: 0,
      matches: 0,
      mismatches: 0,
      matchRate: 0,
      averageDurationMs: 0,
    };
  }
  
  const matches = results.filter(r => r.match).length;
  const mismatches = results.filter(r => !r.match).length;
  const totalDuration = results.reduce((sum, r) => sum + r.comparisonDurationMs, 0);
  
  return {
    total: results.length,
    matches,
    mismatches,
    matchRate: matches / results.length,
    averageDurationMs: Math.round(totalDuration / results.length),
  };
}

// ============================================================================
// Dual Engine Evaluator (Synchronous for cases that need dual results)
// ============================================================================

/**
 * Execute with both engines and return both results
 * Unlike ghost comparison, this is synchronous and waits for both results
 * 
 * @param request - The execution request
 * @returns Object containing results from both engines
 */
export async function evaluateWithBothEngines(
  request: ExecRequest
): Promise<{
  requiem: ExecResult | null;
  rust: ExecResult | null;
  comparison: { match: boolean; differences: string[] };
}> {
  // Ensure seed is derived for deterministic execution
  const seed = request.params.seed ?? deriveSeed(request.requestId);
  const requestWithSeed: ExecRequest = {
    ...request,
    params: {
      ...request.params,
      seed,
    },
  };
  
  // Execute both engines in parallel
  const [requiemResult, rustResult] = await Promise.all([
    executeWithRequiem(requestWithSeed),
    executeWithRust(requestWithSeed),
  ]);
  
  // Compare results
  let comparison = { match: false, differences: ['One or both results unavailable'] as string[] };
  
  if (requiemResult && rustResult) {
    comparison = compareExecResults(requiemResult, rustResult);
  }
  
  return {
    requiem: requiemResult ?? null,
    rust: rustResult ?? null,
    comparison,
  };
}

/**
 * Create a dual engine adapter that can be used like a regular adapter
 * but always executes with both engines
 */
export class DualEngineAdapter {
  /**
   * Evaluate with both engines and return primary result with ghost comparison
   */
  async evaluate(request: ExecRequest): Promise<ExecResult> {
    // Execute with both engines
    const { requiem, rust } = await evaluateWithBothEngines(request);
    
    // Use Requiem as primary if available, otherwise Rust
    const primary = requiem ?? rust;
    
    if (!primary) {
      throw new Error('No engine available for execution');
    }
    
    // Run ghost comparison asynchronously (fire-and-forget)
    runGhostComparison(request, primary, { enabled: true, storeResults: true });
    
    return primary;
  }
  
  /**
   * Check if engines are ready
   */
  async isReady(): Promise<boolean> {
    const requiem = getRequiemEngine();
    const rust = getRustEngine();
    
    let requiemReady = false;
    try {
      requiemReady = requiem.isReady() || await requiem.configure();
    } catch {
      // Already false
    }
    
    let rustReady = false;
    try {
      rustReady = rust.isReady() || await rust.initialize();
    } catch {
      // Already false
    }
    
    return requiemReady || rustReady;
  }
}

// Singleton instance
let dualEngineInstance: DualEngineAdapter | undefined;

/**
 * Get or create the singleton dual engine adapter
 */
export function getDualEngine(): DualEngineAdapter {
  if (!dualEngineInstance) {
    dualEngineInstance = new DualEngineAdapter();
  }
  return dualEngineInstance;
}
