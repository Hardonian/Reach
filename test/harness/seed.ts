/**
 * test/harness/seed.ts
 * Deterministic demo seed data for system tests.
 * No Date.now() or Math.random() — all timestamps are fixed epoch values.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Fixed deterministic timestamp — never use Date.now() in test fixtures */
export const FIXED_TIMESTAMP = "1970-01-01T00:00:00.000Z";

/** Deterministic decision input for minimax regret evaluation */
export const DEMO_DECISION_INPUT = {
  actions: ["review_code", "run_tests", "deploy_now"],
  states: ["stable", "unstable", "degraded"],
  outcomes: {
    review_code: { stable: 10, unstable: 8, degraded: 6 },
    run_tests: { stable: 9, unstable: 9, degraded: 7 },
    deploy_now: { stable: 12, unstable: 2, degraded: 0 },
  },
  algorithm: "minimax_regret" as const,
};

/**
 * Expected deterministic output for DEMO_DECISION_INPUT (minimax regret).
 *
 * Regret table:
 *   max per state: stable=12, unstable=9, degraded=7
 *   review_code:  stable=2, unstable=1, degraded=1 → max_regret=2
 *   run_tests:    stable=3, unstable=0, degraded=0 → max_regret=3
 *   deploy_now:   stable=0, unstable=7, degraded=7 → max_regret=7
 *
 * Ranking (ascending by max_regret): review_code < run_tests < deploy_now
 */
export const DEMO_DECISION_EXPECTED = {
  recommended_action: "review_code",
  ranking: ["review_code", "run_tests", "deploy_now"],
};

/** Deterministic junction trigger data */
export const DEMO_JUNCTION_TRIGGER = {
  type: "diff_critical" as const,
  sourceType: "diff" as const,
  sourceRef: "run-demo-001",
  severityScore: 0.85,
  triggerData: {
    changedFiles: 12,
    criticalPaths: ["src/core/engine.ts"],
    riskScore: 0.85,
  },
  triggerTrace: {
    algorithm: "diff_critical_evaluation",
    evaluatedAt: FIXED_TIMESTAMP,
  },
};

/** Deterministic Zeolite context seed */
export const DEMO_ZEOLITE_SEED = {
  example: "negotiation",
  depth: 2,
  seed: "golden-path-v1",
};

/** Deterministic evidence for Zeolite context */
export const DEMO_EVIDENCE = [
  {
    sourceId: "source-001",
    claim: "Customer impact validated",
    capturedAt: FIXED_TIMESTAMP,
  },
  {
    sourceId: "source-002",
    claim: "Security review completed",
    capturedAt: FIXED_TIMESTAMP,
  },
];

/** Full demo seed data structure */
export const DEMO_DATA = {
  id: "demo-seed-golden-path-v1",
  version: "1.0.0",
  timestamp: FIXED_TIMESTAMP,
  decision: DEMO_DECISION_INPUT,
  junction: DEMO_JUNCTION_TRIGGER,
  zeolite: DEMO_ZEOLITE_SEED,
  evidence: DEMO_EVIDENCE,
};

export function seedDemoData(cwd: string): string {
  const seedPath = join(cwd, "demo-seed.json");
  writeFileSync(seedPath, JSON.stringify(DEMO_DATA, null, 2));
  return seedPath;
}
