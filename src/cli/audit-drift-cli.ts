// @ts-nocheck
import { listRecentArtifacts } from "@zeo/ledger";

const DRIFT_FLIP_DISTANCE_THRESHOLD = 3;

export async function runAuditCommand(args: string[]): Promise<number> {
  const recent = listRecentArtifacts(20);
  console.log("\n=== Zeo Autopilot Drift Audit ===");

  if (recent.length === 0) {
    console.log("No recent decisions to audit.");
    return 0;
  }

  const flagged = recent.filter((a) => {
    if (a.flip_distance_summary.length === 0) return false;
    return a.flip_distance_summary.some(
      (s: { distance?: number }) =>
        typeof s.distance === "number" &&
        s.distance < DRIFT_FLIP_DISTANCE_THRESHOLD,
    );
  });

  console.log(`Audited ${recent.length} decisions.`);
  console.log(`Flagged for drift: ${flagged.length}`);

  if (flagged.length > 0) {
    console.log("\nRecommended Re-evaluations:");
    flagged.forEach((f) => {
      const breachedCount = f.flip_distance_summary.filter(
        (s: { distance?: number }) =>
          typeof s.distance === "number" &&
          s.distance < DRIFT_FLIP_DISTANCE_THRESHOLD,
      ).length;
      const riskTier = breachedCount >= 2 ? "HIGH" : "MEDIUM";
      console.log(`- ${f.decision_id}: RISK TIER ${riskTier}`);
      console.log(
        `  Reason: Input distributions shifted; ${f.flip_distance_summary[0]?.assumption_id} boundary breached.`,
      );
    });
  } else {
    console.log("\n✅ All recent decisions within drift tolerances.");
  }

  return 0;
}
