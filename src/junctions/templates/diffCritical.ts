/**
 * Diff Critical Junction Template
 * Triggers when a significant change is detected in run diffs
 */

import { JunctionTrigger, JunctionType, SourceType } from '../types';

export interface DiffCriticalData {
  runId: string;
  previousRunId?: string;
  diffSummary: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    breakingChanges: string[];
  };
  significanceScore: number;
  affectedComponents: string[];
}

export interface DiffCriticalTrigger extends JunctionTrigger {
  type: 'diff_critical';
  sourceType: 'diff';
  triggerData: DiffCriticalData;
}

/**
 * Evaluates if a diff meets the threshold for a critical junction
 */
export function evaluateDiffCritical(data: DiffCriticalData): {
  shouldTrigger: boolean;
  severityScore: number;
  triggerTrace: Record<string, any>;
} {
  const threshold = 0.7; // 70% significance triggers critical
  
  // Calculate base severity from significance score
  let severityScore = data.significanceScore;
  
  // Increase severity for breaking changes
  if (data.diffSummary.breakingChanges.length > 0) {
    severityScore = Math.min(1.0, severityScore + 0.2 * data.diffSummary.breakingChanges.length);
  }
  
  // Increase severity for high file change count
  if (data.diffSummary.filesChanged > 10) {
    severityScore = Math.min(1.0, severityScore + 0.1);
  }
  
  const shouldTrigger = severityScore >= threshold;
  
  const triggerTrace = {
    algorithm: 'diff_critical_evaluation',
    thresholds: {
      significanceThreshold: threshold,
    },
    factors: {
      baseSignificance: data.significanceScore,
      breakingChangesCount: data.diffSummary.breakingChanges.length,
      filesChanged: data.diffSummary.filesChanged,
    },
    computedSeverity: severityScore,
    shouldTrigger,
  };
  
  return { shouldTrigger, severityScore, triggerTrace };
}

/**
 * Creates a diff critical trigger
 */
export function createDiffCriticalTrigger(
  data: DiffCriticalData,
  scopeKeys?: Record<string, string>
): DiffCriticalTrigger {
  const { shouldTrigger, severityScore, triggerTrace } = evaluateDiffCritical(data);
  
  return {
    type: 'diff_critical',
    sourceType: 'diff',
    sourceRef: data.runId,
    severityScore,
    triggerData: data,
    triggerTrace,
    scopeKeys,
  };
}

/**
 * Default diff critical data for testing
 */
export const DIFF_CRITICAL_FIXTURE: DiffCriticalData = {
  runId: 'run_test_001',
  previousRunId: 'run_test_000',
  diffSummary: {
    filesChanged: 15,
    linesAdded: 500,
    linesRemoved: 200,
    breakingChanges: ['auth_middleware_api_change', 'database_schema_v2'],
  },
  significanceScore: 0.75,
  affectedComponents: ['auth', 'database', 'api'],
};
