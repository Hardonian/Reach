/**
 * Diff Critical Junction Template
 *
 * Triggers when critical changes are detected in diffs.
 */

import { JunctionTemplateResult, JunctionType } from "../types";

/**
 * Evidence from diff analysis
 */
export interface DiffEvidence {
  runId: string;
  changedFiles: string[];
  criticalFiles: string[];
  addedLines: number;
  removedLines: number;
  riskScore: number;
}

/**
 * Evaluate diff evidence for critical junction
 */
export function evaluateDiffCritical(evidence: DiffEvidence): JunctionTemplateResult {
  const traces: string[] = [];

  // Calculate severity based on critical files and risk
  let severityScore = evidence.riskScore;

  // Boost severity if critical files are changed
  const criticalCount = evidence.criticalFiles.length;
  if (criticalCount > 0) {
    severityScore = Math.min(severityScore + 0.3, 1.0);
    traces.push(`Critical files affected: ${criticalCount} file(s)`);
  }

  // Boost severity for large diffs
  const totalChanges = evidence.addedLines + evidence.removedLines;
  if (totalChanges > 500) {
    severityScore = Math.min(severityScore + 0.2, 1.0);
    traces.push(`Large diff: ${totalChanges} lines changed`);
  }

  traces.push(`Risk score: ${evidence.riskScore.toFixed(2)}`);

  // Determine if should trigger
  const shouldTrigger = severityScore >= 0.5;

  // Generate deterministic fingerprint
  const fingerprint = generateFingerprint("diff_critical", evidence);

  const result: JunctionTemplateResult = {
    type: "diff_critical" as JunctionType,
    severityScore: Math.round(severityScore * 100) / 100,
    fingerprint,
    triggerSourceRef: evidence.runId,
    triggerData: JSON.stringify(evidence),
    triggerTrace: traces,
    shouldTrigger,
    reason: shouldTrigger
      ? `Critical diff detected with severity ${severityScore.toFixed(2)}`
      : `Diff severity ${severityScore.toFixed(2)} below threshold`,
  };

  return result;
}

/**
 * Generate deterministic fingerprint
 */
function generateFingerprint(type: string, evidence: DiffEvidence): string {
  // Sort keys for deterministic JSON
  const canonical = JSON.stringify({
    type,
    runId: evidence.runId,
    criticalFiles: [...evidence.criticalFiles].sort(),
    riskScore: evidence.riskScore,
  });

  return hashString(canonical);
}

/**
 * Simple hash function for fingerprinting
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}
