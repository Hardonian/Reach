import type { GovernanceSpec, GovernanceMemoryEntry } from "./types.js";

/**
 * CPX (Control Plane Execution)
 * Handles high-level risk assessment and calibration of governance signals.
 */
export interface CPXReport {
  riskScore: number;
  criticalViolations: string[];
  recommendation: "pass" | "warn" | "block";
}

export class CPX {
  /**
   * Calibrates severity based on DecisionHealth risk scores and GovernanceSpec.
   */
  static assessRisk(
    riskScore: number,
    spec: GovernanceSpec,
    history: GovernanceMemoryEntry[],
  ): CPXReport {
    const criticalViolations: string[] = [];

    // Example: If risk exceeds 80, it's an automatic block if policy is strictly enforced
    let recommendation: "pass" | "warn" | "block" = "pass";

    if (riskScore > 80) {
      recommendation = spec.rolloutMode === "enforced" ? "block" : "warn";
      criticalViolations.push(`Risk score ${riskScore} exceeds critical threshold (80)`);
    } else if (riskScore > 50) {
      recommendation = "warn";
    }

    // Check for "stable" violations in memory
    const volatilePatterns = history.filter(
      (h) => h.memoryType === "risk_pattern" && h.confidence > 0.8,
    );
    if (volatilePatterns.length > 3) {
      criticalViolations.push("Detected high-frequency risk patterns in workspace history");
      if (recommendation !== "block") recommendation = "warn";
    }

    return {
      riskScore,
      criticalViolations,
      recommendation,
    };
  }
}
