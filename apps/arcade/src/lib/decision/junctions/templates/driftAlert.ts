/**
 * Drift Alert Junction Template
 *
 * Triggers when configuration drift is detected.
 */

import { JunctionTemplateResult, JunctionType } from "../types";

/**
 * Evidence from drift detection
 */
export interface DriftEvidence {
  runId: string;
  resourceType: string;
  resourceName: string;
  driftType: "state" | "config" | "permission";
  severity: number;
  driftedKeys: string[];
  baseline: Record<string, unknown>;
  current: Record<string, unknown>;
}

/**
 * Evaluate drift evidence for alert junction
 */
export function evaluateDriftAlert(
  evidence: DriftEvidence,
): JunctionTemplateResult {
  const traces: string[] = [];

  let severityScore = evidence.severity;

  // Boost severity for certain drift types
  if (evidence.driftType === "permission") {
    severityScore = Math.min(severityScore + 0.2, 1.0);
    traces.push("Permission drift detected - high impact");
  } else if (evidence.driftType === "config") {
    severityScore = Math.min(severityScore + 0.1, 1.0);
    traces.push("Configuration drift detected");
  }

  // Boost for number of drifted keys
  const keyCount = evidence.driftedKeys.length;
  if (keyCount > 10) {
    severityScore = Math.min(severityScore + 0.15, 1.0);
    traces.push(`Many drifted keys: ${keyCount}`);
  }

  traces.push(`Drift type: ${evidence.driftType}`);
  traces.push(`Resource: ${evidence.resourceType}/${evidence.resourceName}`);

  // Determine if should trigger
  const shouldTrigger = severityScore >= 0.5;

  // Generate deterministic fingerprint
  const fingerprint = generateFingerprint("drift_alert", evidence);

  const result: JunctionTemplateResult = {
    type: "drift_alert" as JunctionType,
    severityScore: Math.round(severityScore * 100) / 100,
    fingerprint,
    triggerSourceRef: evidence.runId,
    triggerData: JSON.stringify(evidence),
    triggerTrace: traces,
    shouldTrigger,
    reason: shouldTrigger
      ? `Drift alert triggered with severity ${severityScore.toFixed(2)}`
      : `Drift severity ${severityScore.toFixed(2)} below threshold`,
  };

  return result;
}

/**
 * Generate deterministic fingerprint
 */
function generateFingerprint(type: string, evidence: DriftEvidence): string {
  const canonical = JSON.stringify({
    type,
    runId: evidence.runId,
    resourceType: evidence.resourceType,
    resourceName: evidence.resourceName,
    driftType: evidence.driftType,
    driftedKeys: [...evidence.driftedKeys].sort(),
  });

  return hashString(canonical);
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}
