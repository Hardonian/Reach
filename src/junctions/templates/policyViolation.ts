/**
 * Policy Violation Junction Template
 * Triggers when policy evaluation fails or thresholds are exceeded
 */

import { JunctionTrigger } from '../types';

export interface PolicyViolationData {
  runId: string;
  policyName: string;
  policyVersion: string;
  violationSeverity: 'error' | 'warning' | 'info';
  violationCount: number;
  violationRules: string[];
  affectedResources: string[];
  remediationAvailable: boolean;
}

export interface PolicyViolationTrigger extends JunctionTrigger {
  type: 'policy_violation';
  sourceType: 'policy';
  triggerData: PolicyViolationData;
}

/**
 * Evaluates if policy violation meets the threshold for a junction
 */
export function evaluatePolicyViolation(data: PolicyViolationData): {
  shouldTrigger: boolean;
  severityScore: number;
  triggerTrace: Record<string, any>;
} {
  // Different thresholds based on severity
  const severityThresholds = {
    error: 0.3,  // Any error triggers
    warning: 0.6, // 60% of violations trigger
    info: 0.9,   // 90% of violations trigger
  };
  
  const threshold = severityThresholds[data.violationSeverity];
  
  // Calculate base severity
  let severityScore = data.violationCount / 10; // Normalize to 0-1
  
  // Adjust for severity level
  if (data.violationSeverity === 'error') {
    severityScore = Math.min(1.0, severityScore + 0.3);
  } else if (data.violationSeverity === 'warning') {
    severityScore = Math.min(1.0, severityScore + 0.15);
  }
  
  // Increase for number of affected rules
  if (data.violationRules.length > 3) {
    severityScore = Math.min(1.0, severityScore + 0.1);
  }
  
  // Increase for critical resources
  const criticalResources = ['security', 'auth', 'billing', 'data'];
  const hasCriticalResources = data.affectedResources.some(r => 
    criticalResources.includes(r.toLowerCase())
  );
  if (hasCriticalResources) {
    severityScore = Math.min(1.0, severityScore + 0.25);
  }
  
  // Decrease if remediation is available
  if (data.remediationAvailable) {
    severityScore = Math.max(0, severityScore - 0.1);
  }
  
  const shouldTrigger = severityScore >= threshold;
  
  const triggerTrace = {
    algorithm: 'policy_violation_evaluation',
    thresholds: {
      severityThreshold: threshold,
    },
    factors: {
      policyName: data.policyName,
      violationSeverity: data.violationSeverity,
      violationCount: data.violationCount,
      violationRulesCount: data.violationRules.length,
      affectedResources: data.affectedResources,
      hasCriticalResources,
      remediationAvailable: data.remediationAvailable,
    },
    computedSeverity: severityScore,
    shouldTrigger,
  };
  
  return { shouldTrigger, severityScore, triggerTrace };
}

/**
 * Creates a policy violation trigger
 */
export function createPolicyViolationTrigger(
  data: PolicyViolationData,
  scopeKeys?: Record<string, string>
): PolicyViolationTrigger {
  const { shouldTrigger, severityScore, triggerTrace } = evaluatePolicyViolation(data);
  
  return {
    type: 'policy_violation',
    sourceType: 'policy',
    sourceRef: data.runId,
    severityScore,
    triggerData: data,
    triggerTrace,
    scopeKeys,
  };
}

/**
 * Default policy violation data for testing
 */
export const POLICY_VIOLATION_FIXTURE: PolicyViolationData = {
  runId: 'run_test_004',
  policyName: 'security_policy_v2',
  policyVersion: '2.1.0',
  violationSeverity: 'error',
  violationCount: 5,
  violationRules: [
    'no_hardcoded_secrets',
    'validate_input_types',
    'escape_output',
    'enforce_authz',
    'log_sensitive_data',
  ],
  affectedResources: ['auth', 'api', 'database'],
  remediationAvailable: true,
};
