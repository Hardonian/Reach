/**
 * Trust Drop Junction Template
 *
 * Triggers when trust score drops below threshold.
 */

import { JunctionTemplateResult, JunctionType } from "../types";

/**
 * Evidence from trust analysis
 */
export interface TrustEvidence {
  runId: string;
  previousScore: number;
  currentScore: number;
  threshold: number;
  factors: string[];
}

/**
 * Evaluate trust evidence for drop junction
 */
export function evaluateTrustDrop(
  evidence: TrustEvidence,
): JunctionTemplateResult {
  const traces: string[] = [];

  // Calculate severity based on drop magnitude
  const drop = evidence.previousScore - evidence.currentScore;
  let severityScore = Math.min(drop * 1.5, 1.0);

  traces.push(
    `Trust dropped from ${evidence.previousScore.toFixed(2)} to ${evidence.currentScore.toFixed(2)}`,
  );

  // Boost if below threshold
  if (evidence.currentScore < evidence.threshold) {
    severityScore = Math.min(severityScore + 0.3, 1.0);
    traces.push(`Below threshold: ${evidence.threshold}`);
  }

  // Note factors
  if (evidence.factors.length > 0) {
    traces.push(`Factors: ${evidence.factors.join(", ")}`);
  }

  // Determine if should trigger
  const shouldTrigger =
    severityScore >= 0.4 || evidence.currentScore < evidence.threshold;

  // Generate deterministic fingerprint
  const fingerprint = generateFingerprint("trust_drop", evidence);

  const result: JunctionTemplateResult = {
    type: "trust_drop" as JunctionType,
    severityScore: Math.round(severityScore * 100) / 100,
    fingerprint,
    triggerSourceRef: evidence.runId,
    triggerData: JSON.stringify(evidence),
    triggerTrace: traces,
    shouldTrigger,
    reason: shouldTrigger
      ? `Trust drop detected: ${drop.toFixed(2)} points`
      : `Trust change within acceptable range`,
  };

  return result;
}

function generateFingerprint(type: string, evidence: TrustEvidence): string {
  const canonical = JSON.stringify({
    type,
    runId: evidence.runId,
    previousScore: evidence.previousScore,
    currentScore: evidence.currentScore,
    factors: [...evidence.factors].sort(),
  });

  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}
