/**
 * Trust Drop Junction Template
 * Triggers when trust score drops below acceptable levels
 */

import { JunctionTrigger } from '../types';

export interface TrustDropData {
  runId: string;
  previousTrustScore: number;
  currentTrustScore: number;
  trustComponents: {
    reliability: number;
    safety: number;
    correctness: number;
  };
  dropReason: string;
  affectedFactors: string[];
}

export interface TrustDropTrigger extends JunctionTrigger {
  type: 'trust_drop';
  sourceType: 'trust';
  triggerData: TrustDropData;
}

/**
 * Evaluates if trust drop meets the threshold for a junction
 */
export function evaluateTrustDrop(data: TrustDropData): {
  shouldTrigger: boolean;
  severityScore: number;
  triggerTrace: Record<string, any>;
} {
  const dropThreshold = 0.15; // 15% drop triggers alert
  const criticalThreshold = 0.5; // Below 0.5 is critical
  
  // Calculate the drop amount
  const dropAmount = data.previousTrustScore - data.currentTrustScore;
  const dropPercentage = dropAmount / data.previousTrustScore;
  
  // Calculate severity based on drop and absolute level
  let severityScore = dropPercentage;
  
  // If trust is critically low, increase severity
  if (data.currentTrustScore < criticalThreshold) {
    severityScore = Math.min(1.0, severityScore + 0.3);
  }
  
  // Factor in reliability component (most important)
  if (data.trustComponents.reliability < 0.6) {
    severityScore = Math.min(1.0, severityScore + 0.15);
  }
  
  // Factor in safety component
  if (data.trustComponents.safety < 0.5) {
    severityScore = Math.min(1.0, severityScore + 0.2);
  }
  
  const shouldTrigger = dropPercentage >= dropThreshold || data.currentTrustScore < criticalThreshold;
  
  const triggerTrace = {
    algorithm: 'trust_drop_evaluation',
    thresholds: {
      dropThreshold,
      criticalThreshold,
    },
    factors: {
      previousTrustScore: data.previousTrustScore,
      currentTrustScore: data.currentTrustScore,
      dropAmount,
      dropPercentage,
      reliability: data.trustComponents.reliability,
      safety: data.trustComponents.safety,
      correctness: data.trustComponents.correctness,
      dropReason: data.dropReason,
    },
    computedSeverity: severityScore,
    shouldTrigger,
  };
  
  return { shouldTrigger, severityScore, triggerTrace };
}

/**
 * Creates a trust drop trigger
 */
export function createTrustDropTrigger(
  data: TrustDropData,
  scopeKeys?: Record<string, string>
): TrustDropTrigger {
  const { shouldTrigger, severityScore, triggerTrace } = evaluateTrustDrop(data);
  
  return {
    type: 'trust_drop',
    sourceType: 'trust',
    sourceRef: data.runId,
    severityScore,
    triggerData: data,
    triggerTrace,
    scopeKeys,
  };
}

/**
 * Default trust drop data for testing
 */
export const TRUST_DROP_FIXTURE: TrustDropData = {
  runId: 'run_test_003',
  previousTrustScore: 0.92,
  currentTrustScore: 0.68,
  trustComponents: {
    reliability: 0.55,
    safety: 0.75,
    correctness: 0.82,
  },
  dropReason: 'increased_error_rate',
  affectedFactors: ['error_rate', 'timeout_rate', 'inconsistency_count'],
};
