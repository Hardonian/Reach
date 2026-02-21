/**
 * ReadyLayer Simulation Diff Engine
 * 
 * Provides structured comparison for:
 * - Output text
 * - Structured JSON
 * - Tool invocation sequences
 * - Latency
 * - Cost
 * - Policy violations
 * 
 * Produces semantic diff summary, risk delta score, and highlighted change set.
 * 
 * @module diff-engine
 */

import { z } from 'zod';
import crypto from 'crypto';

// ── Diff Types ────────────────────────────────────────────────────────────────

/**
 * Types of comparisons the diff engine supports.
 */
export type DiffType = 
  | 'output_text'
  | 'structured_json'
  | 'tool_sequence'
  | 'latency'
  | 'cost'
  | 'policy_violations';

/**
 * Diff change type.
 */
export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

/**
 * Individual diff result.
 */
export interface DiffResult {
  diff_type: DiffType;
  baseline: unknown;
  current: unknown;
  change_type: DiffChangeType;
  changes: DiffChange[];
  similarity_score: number;
  risk_delta: number;
  risk_level: RiskLevel;
  metadata: DiffMetadata;
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Individual change within a diff.
 */
export interface DiffChange {
  path: string;
  baseline_value?: unknown;
  current_value?: unknown;
  change_type: DiffChangeType;
  severity: ChangeSeverity;
}

export type ChangeSeverity = 'info' | 'warning' | 'error';

/**
 * Metadata about the diff.
 */
export interface DiffMetadata {
  baseline_id?: string;
  current_id?: string;
  compared_at: string;
  deterministic: boolean;
  runtime_context?: Record<string, unknown>;
}

// ── Comparison Functions ───────────────────────────────────────────────────

/**
 * Compares output text between baseline and current.
 */
export function compareOutputText(
  baseline: string,
  current: string,
  options?: { ignoreWhitespace?: boolean; ignoreCase?: boolean }
): DiffResult {
  const ignoreWhitespace = options?.ignoreWhitespace ?? true;
  const ignoreCase = options?.ignoreCase ?? false;
  
  let baselineNormalized = baseline;
  let currentNormalized = current;
  
  if (ignoreWhitespace) {
    baselineNormalized = baselineNormalized.replace(/\s+/g, ' ').trim();
    currentNormalized = currentNormalized.replace(/\s+/g, ' ').trim();
  }
  
  if (ignoreCase) {
    baselineNormalized = baselineNormalized.toLowerCase();
    currentNormalized = currentNormalized.toLowerCase();
  }
  
  const changes: DiffChange[] = [];
  
  if (baselineNormalized !== currentNormalized) {
    // Find line-by-line differences
    const baselineLines = baselineNormalized.split('\n');
    const currentLines = currentNormalized.split('\n');
    
    const maxLines = Math.max(baselineLines.length, currentLines.length);
    for (let i = 0; i < maxLines; i++) {
      const bLine = baselineLines[i] ?? '';
      const cLine = currentLines[i] ?? '';
      
      if (bLine !== cLine) {
        changes.push({
          path: `line ${i + 1}`,
          baseline_value: bLine,
          current_value: cLine,
          change_type: cLine ? (bLine ? 'modified' : 'added') : 'removed',
          severity: calculateChangeSeverity(bLine, cLine),
        });
      }
    }
  }
  
  const similarity = calculateSimilarity(baselineNormalized, currentNormalized);
  const riskDelta = 1 - similarity;
  
  return {
    diff_type: 'output_text',
    baseline,
    current,
    change_type: changes.length > 0 ? 'modified' : 'unchanged',
    changes,
    similarity_score: similarity,
    risk_delta: riskDelta,
    risk_level: calculateRiskLevel(riskDelta),
    metadata: {
      compared_at: new Date().toISOString(),
      deterministic: true,
    },
  };
}

/**
 * Compares structured JSON between baseline and current.
 */
export function compareStructuredJson(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  options?: { ignoreKeys?: string[] }
): DiffResult {
  const ignoreKeys = options?.ignoreKeys ?? ['timestamp', 'created_at', 'id'];
  
  const changes: DiffChange[] = [];
  const allKeys = new Set([
    ...Object.keys(baseline),
    ...Object.keys(current)
  ]);
  
  for (const key of allKeys) {
    if (ignoreKeys.includes(key)) continue;
    
    const baselineValue = baseline[key];
    const currentValue = current[key];
    
    if (baselineValue === undefined) {
      changes.push({
        path: key,
        current_value: currentValue,
        change_type: 'added',
        severity: 'info',
      });
    } else if (currentValue === undefined) {
      changes.push({
        path: key,
        baseline_value: baselineValue,
        change_type: 'removed',
        severity: 'warning',
      });
    } else if (JSON.stringify(baselineValue) !== JSON.stringify(currentValue)) {
      changes.push({
        path: key,
        baseline_value: baselineValue,
        current_value: currentValue,
        change_type: 'modified',
        severity: calculateChangeSeverity(baselineValue, currentValue),
      });
    }
  }
  
  const similarity = calculateJsonSimilarity(baseline, current, ignoreKeys);
  const riskDelta = 1 - similarity;
  
  return {
    diff_type: 'structured_json',
    baseline,
    current,
    change_type: changes.length > 0 ? 'modified' : 'unchanged',
    changes,
    similarity_score: similarity,
    risk_delta: riskDelta,
    risk_level: calculateRiskLevel(riskDelta),
    metadata: {
      compared_at: new Date().toISOString(),
      deterministic: true,
    },
  };
}

/**
 * Compares tool invocation sequences.
 */
export function compareToolSequences(
  baseline: ToolInvocation[],
  current: ToolInvocation[]
): DiffResult {
  const changes: DiffChange[] = [];
  
  const maxLen = Math.max(baseline.length, current.length);
  
  for (let i = 0; i < maxLen; i++) {
    const bTool = baseline[i];
    const cTool = current[i];
    
    if (!bTool && cTool) {
      changes.push({
        path: `position ${i}`,
        current_value: cTool.name,
        change_type: 'added',
        severity: calculateToolChangeSeverity(cTool.name),
      });
    } else if (bTool && !cTool) {
      changes.push({
        path: `position ${i}`,
        baseline_value: bTool.name,
        change_type: 'removed',
        severity: 'warning',
      });
    } else if (bTool && cTool && bTool.name !== cTool.name) {
      changes.push({
        path: `position ${i}`,
        baseline_value: bTool.name,
        current_value: cTool.name,
        change_type: 'modified',
        severity: calculateToolChangeSeverity(cTool.name),
      });
    }
  }
  
  const similarity = calculateSequenceSimilarity(baseline, current);
  const riskDelta = 1 - similarity;
  
  return {
    diff_type: 'tool_sequence',
    baseline,
    current,
    change_type: changes.length > 0 ? 'modified' : 'unchanged',
    changes,
    similarity_score: similarity,
    risk_delta: riskDelta,
    risk_level: calculateRiskLevel(riskDelta),
    metadata: {
      compared_at: new Date().toISOString(),
      deterministic: true,
    },
  };
}

interface ToolInvocation {
  name: string;
  args?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Compares latency between baseline and current.
 */
export function compareLatency(
  baseline: number,
  current: number,
  thresholdMs = 1000
): DiffResult {
  const deltaMs = current - baseline;
  const deltaPct = baseline > 0 ? ((current - baseline) / baseline) * 100 : 0;
  
  const changes: DiffChange[] = [{
    path: 'latency',
    baseline_value: `${baseline}ms`,
    current_value: `${current}ms`,
    change_type: deltaMs > 0 ? 'added' : 'removed',
    severity: Math.abs(deltaMs) > thresholdMs ? 'error' : 'info',
  }];
  
  const similarity = calculateSimilarity(String(baseline), String(current));
  const riskDelta = Math.min(1, Math.abs(deltaMs) / thresholdMs);
  
  return {
    diff_type: 'latency',
    baseline: `${baseline}ms`,
    current: `${current}ms`,
    change_type: deltaMs > 0 ? 'added' : 'removed',
    changes,
    similarity_score: similarity,
    risk_delta: riskDelta,
    risk_level: calculateRiskLevel(riskDelta),
    metadata: {
      compared_at: new Date().toISOString(),
      deterministic: true,
      runtime_context: { delta_ms: deltaMs, delta_pct: deltaPct },
    },
  };
}

/**
 * Compares cost between baseline and current.
 */
export function compareCost(
  baseline: number,
  current: number,
  thresholdPct = 50
): DiffResult {
  const delta = current - baseline;
  const deltaPct = baseline > 0 ? ((current - baseline) / baseline) * 100 : 0;
  
  const changes: DiffChange[] = [{
    path: 'cost',
    baseline_value: `$${baseline.toFixed(6)}`,
    current_value: `$${current.toFixed(6)}`,
    change_type: delta > 0 ? 'added' : 'removed',
    severity: Math.abs(deltaPct) > thresholdPct ? 'error' : 'warning',
  }];
  
  const similarity = calculateSimilarity(String(baseline), String(current));
  const riskDelta = Math.min(1, Math.abs(deltaPct) / 100);
  
  return {
    diff_type: 'cost',
    baseline: `$${baseline.toFixed(6)}`,
    current: `$${current.toFixed(6)}`,
    change_type: delta > 0 ? 'added' : 'removed',
    changes,
    similarity_score: similarity,
    risk_delta: riskDelta,
    risk_level: calculateRiskLevel(riskDelta),
    metadata: {
      compared_at: new Date().toISOString(),
      deterministic: true,
      runtime_context: { delta_usd: delta, delta_pct: deltaPct },
    },
  };
}

/**
 * Compares policy violations between baseline and current.
 */
export function comparePolicyViolations(
  baseline: PolicyViolation[],
  current: PolicyViolation[]
): DiffResult {
  const changes: DiffChange[] = [];
  
  const baselineIds = new Set(baseline.map(v => v.id));
  const currentIds = new Set(current.map(v => v.id));
  
  // Added violations
  for (const v of current) {
    if (!baselineIds.has(v.id)) {
      changes.push({
        path: `violation/${v.id}`,
        current_value: v.message,
        change_type: 'added',
        severity: v.severity === 'error' ? 'error' : 'warning',
      });
    }
  }
  
  // Removed violations
  for (const v of baseline) {
    if (!currentIds.has(v.id)) {
      changes.push({
        path: `violation/${v.id}`,
        baseline_value: v.message,
        change_type: 'removed',
        severity: 'info',
      });
    }
  }
  
  const similarity = calculateViolationSimilarity(baseline, current);
  const riskDelta = current.length > baseline.length 
    ? Math.min(1, (current.length - baseline.length) / 10)
    : 0;
  
  return {
    diff_type: 'policy_violations',
    baseline: `${baseline.length} violations`,
    current: `${current.length} violations`,
    change_type: current.length > baseline.length ? 'added' : current.length < baseline.length ? 'removed' : 'unchanged',
    changes,
    similarity_score: similarity,
    risk_delta: riskDelta,
    risk_level: calculateRiskLevel(riskDelta),
    metadata: {
      compared_at: new Date().toISOString(),
      deterministic: true,
    },
  };
}

interface PolicyViolation {
  id: string;
  severity: 'info' | 'warning' | 'error';
  rule: string;
  message: string;
}

// ── Comprehensive Diff ─────────────────────────────────────────────────────

/**
 * Comprehensive diff result.
 */
export interface ComprehensiveDiffResult {
  results: DiffResult[];
  overall_similarity: number;
  overall_risk_delta: number;
  overall_risk_level: RiskLevel;
  summary: DiffSummary;
  recommendations: string[];
}

export interface DiffSummary {
  total_changes: number;
  additions: number;
  removals: number;
  modifications: number;
  critical_changes: number;
  warning_changes: number;
}

/**
 * Runs comprehensive diff across all comparison types.
 */
export function runComprehensiveDiff(
  baseline: DiffInput,
  current: DiffInput
): ComprehensiveDiffResult {
  const results: DiffResult[] = [];
  
  // Output text diff
  if (typeof baseline.output === 'string' && typeof current.output === 'string') {
    results.push(compareOutputText(baseline.output, current.output));
  }
  
  // JSON diff
  if (typeof baseline.output === 'object' && typeof current.output === 'object') {
    results.push(compareStructuredJson(
      baseline.output as Record<string, unknown>,
      current.output as Record<string, unknown>
    ));
  }
  
  // Tool sequence diff
  if (baseline.tool_invocations && current.tool_invocations) {
    results.push(compareToolSequences(
      baseline.tool_invocations,
      current.tool_invocations
    ));
  }
  
  // Latency diff
  if (baseline.latency_ms !== undefined && current.latency_ms !== undefined) {
    results.push(compareLatency(baseline.latency_ms, current.latency_ms));
  }
  
  // Cost diff
  if (baseline.cost_usd !== undefined && current.cost_usd !== undefined) {
    results.push(compareCost(baseline.cost_usd, current.cost_usd));
  }
  
  // Policy violations diff
  if (baseline.violations && current.violations) {
    results.push(comparePolicyViolations(baseline.violations, current.violations));
  }
  
  // Aggregate results
  const overallSimilarity = results.reduce((sum, r) => sum + r.similarity_score, 0) / results.length;
  const overallRiskDelta = results.reduce((sum, r) => sum + r.risk_delta, 0) / results.length;
  
  // Count changes
  let totalChanges = 0;
  let additions = 0;
  let removals = 0;
  let modifications = 0;
  let criticalChanges = 0;
  let warningChanges = 0;
  
  for (const result of results) {
    for (const change of result.changes) {
      totalChanges++;
      if (change.change_type === 'added') additions++;
      if (change.change_type === 'removed') removals++;
      if (change.change_type === 'modified') modifications++;
      if (change.severity === 'error') criticalChanges++;
      if (change.severity === 'warning') warningChanges++;
    }
  }
  
  return {
    results,
    overall_similarity: overallSimilarity,
    overall_risk_delta: overallRiskDelta,
    overall_risk_level: calculateRiskLevel(overallRiskDelta),
    summary: {
      total_changes: totalChanges,
      additions,
      removals,
      modifications,
      critical_changes: criticalChanges,
      warning_changes: warningChanges,
    },
    recommendations: generateRecommendations(results),
  };
}

interface DiffInput {
  output?: unknown;
  tool_invocations?: ToolInvocation[];
  latency_ms?: number;
  cost_usd?: number;
  violations?: PolicyViolation[];
}

// ── Helper Functions ─────────────────────────────────────────────────────

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  // Simple Levenshtein-based similarity
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function calculateJsonSimilarity(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  ignoreKeys: string[]
): number {
  const baselineFiltered = { ...baseline };
  const currentFiltered = { ...current };
  
  for (const key of ignoreKeys) {
    delete baselineFiltered[key];
    delete currentFiltered[key];
  }
  
  const baselineJson = JSON.stringify(baselineFiltered);
  const currentJson = JSON.stringify(currentFiltered);
  
  return baselineJson === currentJson ? 1 : calculateSimilarity(baselineJson, currentJson);
}

function calculateSequenceSimilarity(
  baseline: ToolInvocation[],
  current: ToolInvocation[]
): number {
  if (baseline.length === 0 && current.length === 0) return 1;
  if (baseline.length === 0 || current.length === 0) return 0;
  
  // Longest common subsequence ratio
  const lcs = longestCommonSubsequence(
    baseline.map(t => t.name),
    current.map(t => t.name)
  );
  
  const maxLen = Math.max(baseline.length, current.length);
  return lcs / maxLen;
}

function longestCommonSubsequence(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

function calculateViolationSimilarity(
  baseline: PolicyViolation[],
  current: PolicyViolation[]
): number {
  if (baseline.length === 0 && current.length === 0) return 1;
  if (baseline.length === 0 || current.length === 0) return 0;
  
  const baselineIds = new Set(baseline.map(v => v.id));
  const currentIds = new Set(current.map(v => v.id));
  
  let matches = 0;
  for (const id of baselineIds) {
    if (currentIds.has(id)) matches++;
  }
  
  const maxLen = Math.max(baseline.length, current.length);
  return matches / maxLen;
}
function calculateChangeSeverity(baseline: unknown, current: unknown): ChangeSeverity {
  const bStr = String(baseline);
  const cStr = String(current);
  
  // Check for concerning keywords
  const errorKeywords = ['error', 'fail', 'exception', 'denied', 'unauthorized'];
  const warningKeywords = ['warning', 'warn', 'deprecated'];
  
  const combined = (bStr + cStr).toLowerCase();
  
  if (errorKeywords.some(k => combined.includes(k))) return 'error';
  if (warningKeywords.some(k => combined.includes(k))) return 'warning';
  return 'info';
}

function calculateToolChangeSeverity(toolName: string): ChangeSeverity {
  // Certain tools have higher risk when changed
  const highRiskTools = ['execute', 'shell', 'write', 'delete', 'admin'];
  const medRiskTools = ['http', 'fetch', 'api', 'call'];
  
  const nameLower = toolName.toLowerCase();
  
  if (highRiskTools.some(t => nameLower.includes(t))) return 'error';
  if (medRiskTools.some(t => nameLower.includes(t))) return 'warning';
  return 'info';
}

function calculateRiskLevel(delta: number): RiskLevel {
  if (delta >= 0.7) return 'critical';
  if (delta >= 0.5) return 'high';
  if (delta >= 0.3) return 'medium';
  if (delta >= 0.1) return 'low';
  return 'none';
}

function generateRecommendations(results: DiffResult[]): string[] {
  const recommendations: string[] = [];
  
  for (const result of results) {
    if (result.risk_level === 'critical') {
      recommendations.push(`Critical changes detected in ${result.diff_type}. Review immediately.`);
    }
    if (result.risk_level === 'high') {
      recommendations.push(`Significant changes in ${result.diff_type}. Consider manual review.`);
    }
    
    for (const change of result.changes) {
      if (change.severity === 'error') {
        recommendations.push(`Error-level change at ${change.path}: review required.`);
      }
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All changes within acceptable thresholds.');
  }
  
  return recommendations;
}

// ── Zod Schemas ────────────────────────────────────────────────────────────

export const DiffResultSchema = z.object({
  diff_type: z.enum(['output_text', 'structured_json', 'tool_sequence', 'latency', 'cost', 'policy_violations']),
  baseline: z.unknown(),
  current: z.unknown(),
  change_type: z.enum(['added', 'removed', 'modified', 'unchanged']),
  changes: z.array(z.object({
    path: z.string(),
    baseline_value: z.unknown().optional(),
    current_value: z.unknown().optional(),
    change_type: z.enum(['added', 'removed', 'modified', 'unchanged']),
    severity: z.enum(['info', 'warning', 'error']),
  })),
  similarity_score: z.number().min(0).max(1),
  risk_delta: z.number().min(0).max(1),
  risk_level: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  metadata: z.object({
    baseline_id: z.string().optional(),
    current_id: z.string().optional(),
    compared_at: z.string().datetime(),
    deterministic: z.boolean(),
    runtime_context: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const ComprehensiveDiffResultSchema = z.object({
  results: z.array(DiffResultSchema),
  overall_similarity: z.number().min(0).max(1),
  overall_risk_delta: z.number().min(0).max(1),
  overall_risk_level: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  summary: z.object({
    total_changes: z.number().int(),
    additions: z.number().int(),
    removals: z.number().int(),
    modifications: z.number().int(),
    critical_changes: z.number().int(),
    warning_changes: z.number().int(),
  }),
  recommendations: z.array(z.string()),
});
