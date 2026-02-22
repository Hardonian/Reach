/**
 * Policy Violation Junction Template
 * 
 * Triggers when policy violations are detected.
 */

import { JunctionTemplateResult, JunctionType } from '../types';

/**
 * Evidence from policy evaluation
 */
export interface PolicyViolationEvidence {
  runId: string;
  policyName: string;
  violations: Array<{
    rule: string;
    severity: number;
    message: string;
    resource?: string;
  }>;
}

/**
 * Evaluate policy evidence for violation junction
 */
export function evaluatePolicyViolation(evidence: PolicyViolationEvidence): JunctionTemplateResult {
  const traces: string[] = [];
  
  // Calculate average severity
  const severities = evidence.violations.map(v => v.severity);
  const avgSeverity = severities.reduce((a, b) => a + b, 0) / severities.length;
  const maxSeverity = Math.max(...severities);
  
  let severityScore = avgSeverity;
  
  traces.push(`Policy: ${evidence.policyName}`);
  traces.push(`Violations: ${evidence.violations.length}`);
  
  // Boost for high-severity violations
  if (maxSeverity >= 0.8) {
    severityScore = Math.min(severityScore + 0.2, 1.0);
    traces.push('Critical severity violation detected');
  }
  
  // Boost for multiple violations
  if (evidence.violations.length > 5) {
    severityScore = Math.min(severityScore + 0.1, 1.0);
    traces.push('Multiple violations');
  }
  
  // List violation rules
  const rules = [...new Set(evidence.violations.map(v => v.rule))];
  traces.push(`Rules violated: ${rules.join(', ')}`);
  
  // Determine if should trigger
  const shouldTrigger = severityScore >= 0.4;
  
  // Generate deterministic fingerprint
  const fingerprint = generateFingerprint('policy_violation', evidence);
  
  const result: JunctionTemplateResult = {
    type: 'policy_violation' as JunctionType,
    severityScore: Math.round(severityScore * 100) / 100,
    fingerprint,
    triggerSourceRef: evidence.runId,
    triggerData: JSON.stringify(evidence),
    triggerTrace: traces,
    shouldTrigger,
    reason: shouldTrigger 
      ? `Policy violation: ${evidence.violations.length} violation(s) with avg severity ${avgSeverity.toFixed(2)}`
      : `Policy violations below trigger threshold`,
  };
  
  return result;
}

function generateFingerprint(type: string, evidence: PolicyViolationEvidence): string {
  const rules = [...new Set(evidence.violations.map(v => v.rule))].sort();
  const canonical = JSON.stringify({
    type,
    runId: evidence.runId,
    policyName: evidence.policyName,
    rules,
  });
  
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}
