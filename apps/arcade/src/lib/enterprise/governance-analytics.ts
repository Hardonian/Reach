import type { GovernanceSpecRecord } from "@/lib/db/governance";

export interface EnterpriseGovernanceAnalytics {
  totalSpecs: number;
  dryRunSpecs: number;
  enforcedSpecs: number;
  avgThresholdsPerSpec: number;
  topIntentKeywords: Array<{ keyword: string; count: number }>;
  simulationRecommendation: string;
}

function tokenize(intent: string): string[] {
  return intent
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

export function buildEnterpriseGovernanceAnalytics(
  specs: GovernanceSpecRecord[],
): EnterpriseGovernanceAnalytics {
  const totalSpecs = specs.length;
  const dryRunSpecs = specs.filter((spec) => spec.rollout_mode === "dry-run").length;
  const enforcedSpecs = totalSpecs - dryRunSpecs;

  const thresholdCount = specs.reduce((count, spec) => {
    const thresholds = Array.isArray((spec.spec as Record<string, unknown>).thresholds)
      ? ((spec.spec as Record<string, unknown>).thresholds as unknown[])
      : [];
    return count + thresholds.length;
  }, 0);

  const keywordCounts = new Map<string, number>();
  for (const spec of specs) {
    for (const token of tokenize(spec.source_intent)) {
      keywordCounts.set(token, (keywordCounts.get(token) ?? 0) + 1);
    }
  }

  const topIntentKeywords = Array.from(keywordCounts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => {
      if (a.count > b.count) return -1;
      if (a.count < b.count) return 1;
      if (a.keyword < b.keyword) return -1;
      if (a.keyword > b.keyword) return 1;
      return 0;
    })
    .slice(0, 8);

  return {
    totalSpecs,
    dryRunSpecs,
    enforcedSpecs,
    avgThresholdsPerSpec: totalSpecs > 0 ? Number((thresholdCount / totalSpecs).toFixed(2)) : 0,
    topIntentKeywords,
    simulationRecommendation:
      enforcedSpecs > dryRunSpecs
        ? "Increase dry-run simulations before enforcement to reduce rollout risk."
        : "Current rollout strategy is simulation-first.",
  };
}
