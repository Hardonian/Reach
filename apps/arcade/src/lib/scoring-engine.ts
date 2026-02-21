/**
 * ReadyLayer Drift & Regression Scoring Engine
 * 
 * Provides foundational scoring for:
 * - Regression delta score
 * - Drift vector score
 * - Policy violation weighting
 * - Tool reliability score
 * - Latency risk score
 * 
 * Persists score history per workspace with trend metrics.
 * 
 * @module scoring-engine
 */

import { z } from 'zod';

// ── Score Types ────────────────────────────────────────────────────────────────

/**
 * Types of scores tracked by the engine.
 */
export type ScoreType = 
  | 'regression_delta'
  | 'drift_vector'
  | 'policy_violation'
  | 'tool_reliability'
  | 'latency_risk'
  | 'overall_health';

/**
 * Score severity levels.
 */
export type ScoreSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Individual score record.
 */
export interface Score {
  id: string;
  tenant_id: string;
  run_id?: string;
  score_type: ScoreType;
  score_value: number; // 0.0 to 1.0
  baseline_value?: number;
  delta?: number;
  severity: ScoreSeverity;
  metadata: ScoreMetadata;
  created_at: string;
}

/**
 * Additional metadata for scores.
 */
export interface ScoreMetadata {
  component?: string;
  model?: string;
  provider?: string;
  threshold?: number;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Score history entry for trend analysis.
 */
export interface ScoreHistoryEntry {
  score_type: ScoreType;
  score_value: number;
  timestamp: string;
  run_id?: string;
}

/**
 * Trend analysis result.
 */
export interface TrendResult {
  score_type: ScoreType;
  direction: 'improving' | 'degrading' | 'stable';
  delta_pct: number;
  current_value: number;
  baseline_value: number;
  sample_size: number;
  confidence: number;
  last_updated: string;
}

// ── Scoring Weights ───────────────────────────────────────────────────────────

/**
 * Configurable weights for scoring components.
 */
export interface ScoringWeights {
  regression_delta: number;
  drift_vector: number;
  policy_violation: number;
  tool_reliability: number;
  latency_risk: number;
}

/**
 * Default scoring weights.
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  regression_delta: 0.25,
  drift_vector: 0.20,
  policy_violation: 0.25,
  tool_reliability: 0.15,
  latency_risk: 0.15,
};

// ── Threshold Configuration ───────────────────────────────────────────────────

/**
 * Threshold configuration for scoring.
 */
export interface ScoreThresholds {
  warning: number;
  error: number;
  critical: number;
}

/**
 * Default thresholds for each score type.
 */
export const DEFAULT_THRESHOLDS: Record<ScoreType, ScoreThresholds> = {
  regression_delta: { warning: -0.05, error: -0.10, critical: -0.20 },
  drift_vector: { warning: 0.3, error: 0.5, critical: 0.7 },
  policy_violation: { warning: 0.1, error: 0.3, critical: 0.5 },
  tool_reliability: { warning: 0.8, error: 0.6, critical: 0.4 },
  latency_risk: { warning: 0.7, error: 0.85, critical: 0.95 },
  overall_health: { warning: 0.7, error: 0.5, critical: 0.3 },
};

// ── Severity Calculation ─────────────────────────────────────────────────────

/**
 * Calculates severity based on score value and thresholds.
 */
export function calculateSeverity(
  scoreValue: number,
  scoreType: ScoreType,
  thresholds: Record<ScoreType, ScoreThresholds> = DEFAULT_THRESHOLDS
): ScoreSeverity {
  const threshold = thresholds[scoreType];
  
  if (scoreType === 'regression_delta') {
    // Negative scores - lower is worse
    if (scoreValue <= threshold.critical) return 'critical';
    if (scoreValue <= threshold.error) return 'error';
    if (scoreValue <= threshold.warning) return 'warning';
    return 'info';
  } else {
    // Positive scores - higher is worse for most
    if (scoreValue >= threshold.critical) return 'critical';
    if (scoreValue >= threshold.error) return 'error';
    if (scoreValue >= threshold.warning) return 'warning';
    return 'info';
  }
}

// ── Regression Delta Score ─────────────────────────────────────────────────

/**
 * Calculates regression delta between current and baseline scores.
 */
export function calculateRegressionDelta(
  currentScore: number,
  baselineScore: number,
  windowSize = 10
): { delta: number; severity: ScoreSeverity; sampleSize: number } {
  const delta = currentScore - baselineScore;
  
  // Adjust threshold based on sample size (less confidence with smaller samples)
  const confidenceFactor = Math.min(windowSize / 30, 1);
  const adjustedWarning = DEFAULT_THRESHOLDS.regression_delta.warning * confidenceFactor;
  const adjustedError = DEFAULT_THRESHOLDS.regression_delta.error * confidenceFactor;
  const adjustedCritical = DEFAULT_THRESHOLDS.regression_delta.critical * confidenceFactor;
  
  let severity: ScoreSeverity;
  if (delta <= adjustedCritical) severity = 'critical';
  else if (delta <= adjustedError) severity = 'error';
  else if (delta <= adjustedWarning) severity = 'warning';
  else severity = 'info';
  
  return {
    delta,
    severity,
    sampleSize: windowSize,
  };
}

// ── Drift Vector Score ─────────────────────────────────────────────────────

/**
 * Calculates drift vector between two output distributions.
 */
export function calculateDriftVector(
  baselineOutputs: unknown[],
  currentOutputs: unknown[]
): { driftScore: number; driftComponents: DriftComponent[]; severity: ScoreSeverity } {
  if (baselineOutputs.length === 0 || currentOutputs.length === 0) {
    return {
      driftScore: 0,
      driftComponents: [],
      severity: 'info',
    };
  }
  
  const components: DriftComponent[] = [];
  
  // 1. Semantic drift (content distribution)
  const semanticDrift = calculateSemanticDrift(baselineOutputs, currentOutputs);
  components.push({ type: 'semantic', value: semanticDrift });
  
  // 2. Structural drift (format/schema changes)
  const structuralDrift = calculateStructuralDrift(baselineOutputs, currentOutputs);
  components.push({ type: 'structural', value: structuralDrift });
  
  // 3. Behavioral drift (tool usage patterns)
  const behavioralDrift = calculateBehavioralDrift(baselineOutputs, currentOutputs);
  components.push({ type: 'behavioral', value: behavioralDrift });
  
  // Weighted average drift
  const weights = { semantic: 0.5, structural: 0.25, behavioral: 0.25 };
  const driftScore = 
    semanticDrift * weights.semantic +
    structuralDrift * weights.structural +
    behavioralDrift * weights.behavioral;
  
  return {
    driftScore,
    driftComponents: components,
    severity: calculateSeverity(driftScore, 'drift_vector'),
  };
}

interface DriftComponent {
  type: 'semantic' | 'structural' | 'behavioral';
  value: number;
}

function calculateSemanticDrift(baseline: unknown[], current: unknown[]): number {
  // Simple hash-based distribution comparison
  const baselineHashes = new Set(baseline.map((v) => JSON.stringify(v)));
  const currentHashes = new Set(current.map((v) => JSON.stringify(v)));
  
  const intersection = [...baselineHashes].filter(h => currentHashes.has(h)).length;
  const union = new Set([...baselineHashes, ...currentHashes]).size;
  
  // Jaccard distance
  return 1 - (intersection / union);
}

function calculateStructuralDrift(baseline: unknown[], current: unknown[]): number {
  if (baseline.length === 0 || current.length === 0) return 0;
  
  const baselineTypes = getTypeDistribution(baseline);
  const currentTypes = getTypeDistribution(current);
  
  return calculateDistributionDistance(baselineTypes, currentTypes);
}

function calculateBehavioralDrift(baseline: unknown[], current: unknown[]): number {
  // Compare tool usage patterns
  const baselineTools = extractToolUsage(baseline);
  const currentTools = extractToolUsage(current);
  
  return calculateDistributionDistance(baselineTools, currentTools);
}

function getTypeDistribution(items: unknown[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const item of items) {
    const type = typeof item;
    distribution[type] = (distribution[type] || 0) + 1;
  }
  // Normalize
  const total = items.length;
  for (const key of Object.keys(distribution)) {
    distribution[key] /= total;
  }
  return distribution;
}

function extractToolUsage(items: unknown[]): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const item of items) {
    if (item && typeof item === 'object' && 'tool' in item) {
      const toolName = (item as Record<string, unknown>).tool as string;
      usage[toolName] = (usage[toolName] || 0) + 1;
    }
  }
  // Normalize
  const total = Object.values(usage).reduce((a, b) => a + b, 0) || 1;
  for (const key of Object.keys(usage)) {
    usage[key] /= total;
  }
  return usage;
}

function calculateDistributionDistance(
  baseline: Record<string, number>,
  current: Record<string, number>
): number {
  const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  let distance = 0;
  
  for (const key of allKeys) {
    const b = baseline[key] || 0;
    const c = current[key] || 0;
    distance += Math.abs(b - c);
  }
  
  // Normalize to 0-1
  return Math.min(distance / 2, 1);
}

// ── Policy Violation Score ─────────────────────────────────────────────────

/**
 * Calculates policy violation score.
 */
export function calculatePolicyViolationScore(
  violations: PolicyViolation[]
): { score: number; severity: ScoreSeverity; details: PolicyViolationDetails } {
  if (violations.length === 0) {
    return {
      score: 0,
      severity: 'info',
      details: { critical: 0, error: 0, warning: 0, info: 0 },
    };
  }
  
  const weights = { critical: 1.0, error: 0.5, warning: 0.2, info: 0.1 };
  const counts = { critical: 0, error: 0, warning: 0, info: 0 };
  
  for (const v of violations) {
    counts[v.severity]++;
  }
  
  // Weighted score
  const totalViolations = violations.length;
  const weightedSum = 
    counts.critical * weights.critical +
    counts.error * weights.error +
    counts.warning * weights.warning +
    counts.info * weights.info;
  
  const score = Math.min(weightedSum / totalViolations, 1);
  
  return {
    score,
    severity: calculateSeverity(score, 'policy_violation'),
    details: counts,
  };
}

interface PolicyViolation {
  id: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  rule: string;
  message: string;
}

interface PolicyViolationDetails {
  critical: number;
  error: number;
  warning: number;
  info: number;
}

interface ToolReliabilityDetails {
  total: number;
  success: number;
  failed: number;
  timeout: number;
}

// ── Tool Reliability Score ─────────────────────────────────────────────────

/**
 * Calculates tool reliability score based on execution history.
 */
export function calculateToolReliabilityScore(
  toolExecutions: ToolExecution[]
): { score: number; severity: ScoreSeverity; details: ToolReliabilityDetails } {
  if (toolExecutions.length === 0) {
    return {
      score: 1,
      severity: 'info',
      details: { total: 0, success: 0, failed: 0, timeout: 0 },
    };
  }
  
  const success = toolExecutions.filter(e => e.status === 'success').length;
  const failed = toolExecutions.filter(e => e.status === 'error').length;
  const timeout = toolExecutions.filter(e => e.status === 'timeout').length;
  
  const reliabilityScore = success / toolExecutions.length;
  const timeoutPenalty = timeout / toolExecutions.length * 0.5;
  
  const finalScore = Math.max(0, reliabilityScore - timeoutPenalty);
  
  return {
    score: finalScore,
    severity: calculateSeverity(finalScore, 'tool_reliability'),
    details: { total: toolExecutions.length, success, failed, timeout },
  };
}

interface ToolExecution {
  tool_name: string;
  status: 'success' | 'error' | 'timeout';
  duration_ms: number;
}

// ── Latency Risk Score ─────────────────────────────────────────────────────

/**
 * Calculates latency risk score based on percentiles.
 */
export function calculateLatencyRiskScore(
  latencies: number[],
  slaThresholdMs = 5000
): { score: number; severity: ScoreSeverity; details: LatencyDetails } {
  if (latencies.length === 0) {
    return {
      score: 0,
      severity: 'info',
      details: { p50: 0, p95: 0, p99: 0, max: 0, sla_compliance: 1 },
    };
  }
  
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const max = sorted[sorted.length - 1];
  
  // SLA compliance (% of requests within threshold)
  const withinSla = latencies.filter(l => l <= slaThresholdMs).length;
  const slaCompliance = withinSla / latencies.length;
  
  // Risk score: combines p95 latency and SLA compliance
  const latencyRisk = Math.min(p95 / (slaThresholdMs * 2), 1);
  const score = (latencyRisk * 0.6) + ((1 - slaCompliance) * 0.4);
  
  return {
    score,
    severity: calculateSeverity(score, 'latency_risk'),
    details: { p50, p95, p99, max, sla_compliance: slaCompliance },
  };
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

interface LatencyDetails {
  p50: number;
  p95: number;
  p99: number;
  max: number;
  sla_compliance: number;
}

// ── Overall Health Score ─────────────────────────────────────────────────

/**
 * Calculates overall health score from component scores.
 */
export function calculateOverallHealthScore(
  componentScores: Partial<ScoringWeights>,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): { score: number; severity: ScoreSeverity; breakdown: Record<ScoreType, number> } {
  const breakdown: Record<ScoreType, number> = {
    regression_delta: componentScores.regression_delta ?? 0,
    drift_vector: componentScores.drift_vector ?? 0,
    policy_violation: componentScores.policy_violation ?? 0,
    tool_reliability: componentScores.tool_reliability ?? 1,
    latency_risk: componentScores.latency_risk ?? 0,
    overall_health: 0,
  };
  
  // Calculate weighted average
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const [key, value] of Object.entries(breakdown)) {
    if (key !== 'overall_health') {
      const weight = weights[key as keyof ScoringWeights] || 0;
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }
  
  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
  breakdown.overall_health = score;
  
  return {
    score,
    severity: calculateSeverity(score, 'overall_health'),
    breakdown,
  };
}

// ── Trend Analysis ─────────────────────────────────────────────────────────

/**
 * Analyzes trends in score history.
 */
export function analyzeTrend(
  history: ScoreHistoryEntry[],
  windowDays = 7
): TrendResult[] {
  if (history.length < 2) {
    return [];
  }
  
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  
  const relevantHistory = history.filter(e => new Date(e.timestamp) >= cutoff);
  
  const byType = new Map<ScoreType, ScoreHistoryEntry[]>();
  for (const entry of relevantHistory) {
    const existing = byType.get(entry.score_type) || [];
    existing.push(entry);
    byType.set(entry.score_type, existing);
  }
  
  const results: TrendResult[] = [];
  
  for (const [scoreType, entries] of byType) {
    if (entries.length < 2) continue;
    
    const sorted = entries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Compare first half to second half
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);
    
    const firstAvg = firstHalf.reduce((sum, e) => sum + e.score_value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, e) => sum + e.score_value, 0) / secondHalf.length;
    
    const deltaPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    
    let direction: 'improving' | 'degrading' | 'stable';
    if (deltaPct > 5) direction = 'improving';
    else if (deltaPct < -5) direction = 'degrading';
    else direction = 'stable';
    
    // Confidence based on sample size
    const confidence = Math.min(entries.length / 20, 1);
    
    results.push({
      score_type: scoreType,
      direction,
      delta_pct: deltaPct,
      current_value: secondAvg,
      baseline_value: firstAvg,
      sample_size: entries.length,
      confidence,
      last_updated: sorted[sorted.length - 1].timestamp,
    });
  }
  
  return results;
}

// ── Zod Schemas ────────────────────────────────────────────────────────────

export const ScoreSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  run_id: z.string().optional(),
  score_type: z.enum(['regression_delta', 'drift_vector', 'policy_violation', 'tool_reliability', 'latency_risk', 'overall_health']),
  score_value: z.number().min(0).max(1),
  baseline_value: z.number().optional(),
  delta: z.number().optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
});

export const ScoreHistoryEntrySchema = z.object({
  score_type: z.enum(['regression_delta', 'drift_vector', 'policy_violation', 'tool_reliability', 'latency_risk', 'overall_health']),
  score_value: z.number().min(0).max(1),
  timestamp: z.string().datetime(),
  run_id: z.string().optional(),
});

export const TrendResultSchema = z.object({
  score_type: z.enum(['regression_delta', 'drift_vector', 'policy_violation', 'tool_reliability', 'latency_risk', 'overall_health']),
  direction: z.enum(['improving', 'degrading', 'stable']),
  delta_pct: z.number(),
  current_value: z.number(),
  baseline_value: z.number(),
  sample_size: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  last_updated: z.string().datetime(),
});
