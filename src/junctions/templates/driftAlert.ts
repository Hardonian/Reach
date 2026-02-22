/**
 * Drift Alert Junction Template
 * Triggers when behavioral drift is detected beyond acceptable thresholds
 */

import { JunctionTrigger } from '../types';

export interface DriftAlertData {
  runId: string;
  baselineRunId: string;
  driftMetrics: {
    outputDrift: number;
    behaviorDrift: number;
    semanticDrift: number;
  };
  driftCategory: 'output' | 'behavior' | 'semantic' | 'mixed';
  affectedMetrics: string[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface DriftAlertTrigger extends JunctionTrigger {
  type: 'drift_alert';
  sourceType: 'drift';
  triggerData: DriftAlertData;
}

/**
 * Evaluates if drift meets the threshold for an alert junction
 */
export function evaluateDriftAlert(data: DriftAlertData): {
  shouldTrigger: boolean;
  severityScore: number;
  triggerTrace: Record<string, any>;
} {
  // Different thresholds for different drift categories
  const thresholds = {
    output: 0.5,
    behavior: 0.4,
    semantic: 0.3,
    mixed: 0.35,
  };
  
  const threshold = thresholds[data.driftCategory] || 0.5;
  
  // Calculate composite drift score
  const compositeDrift = (
    data.driftMetrics.outputDrift * 0.3 +
    data.driftMetrics.behaviorDrift * 0.4 +
    data.driftMetrics.semanticDrift * 0.3
  );
  
  let severityScore = compositeDrift;
  
  // Increase severity for increasing trend
  if (data.trend === 'increasing') {
    severityScore = Math.min(1.0, severityScore + 0.15);
  }
  
  // Increase severity for mixed drift
  if (data.driftCategory === 'mixed') {
    severityScore = Math.min(1.0, severityScore + 0.1);
  }
  
  const shouldTrigger = severityScore >= threshold;
  
  const triggerTrace = {
    algorithm: 'drift_alert_evaluation',
    thresholds: {
      categoryThreshold: threshold,
    },
    factors: {
      outputDrift: data.driftMetrics.outputDrift,
      behaviorDrift: data.driftMetrics.behaviorDrift,
      semanticDrift: data.driftMetrics.semanticDrift,
      compositeDrift,
      trend: data.trend,
      category: data.driftCategory,
    },
    computedSeverity: severityScore,
    shouldTrigger,
  };
  
  return { shouldTrigger, severityScore, triggerTrace };
}

/**
 * Creates a drift alert trigger
 */
export function createDriftAlertTrigger(
  data: DriftAlertData,
  scopeKeys?: Record<string, string>
): DriftAlertTrigger {
  const { shouldTrigger, severityScore, triggerTrace } = evaluateDriftAlert(data);
  
  return {
    type: 'drift_alert',
    sourceType: 'drift',
    sourceRef: data.runId,
    severityScore,
    triggerData: data,
    triggerTrace,
    scopeKeys,
  };
}

/**
 * Default drift alert data for testing
 */
export const DRIFT_ALERT_FIXTURE: DriftAlertData = {
  runId: 'run_test_002',
  baselineRunId: 'run_baseline_001',
  driftMetrics: {
    outputDrift: 0.45,
    behaviorDrift: 0.55,
    semanticDrift: 0.3,
  },
  driftCategory: 'behavior',
  affectedMetrics: ['pass_rate', 'latency', 'error_rate'],
  trend: 'increasing',
};
