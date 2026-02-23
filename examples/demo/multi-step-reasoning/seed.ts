/**
 * Multi-Step Reasoning Example - Seed Script
 *
 * Generates decision scenarios with evidence graphs for testing.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface EvidenceNode {
  id: string;
  type: "evidence" | "hypothesis" | "decision";
  label: string;
  confidence?: number;
  value?: number;
  dependencies: string[];
}

interface DecisionGraph {
  scenario: string;
  nodes: EvidenceNode[];
  voi: Array<{
    evidenceId: string;
    currentConfidence: number;
    expectedConfidence: number;
    cost: number;
  }>;
}

const CLOUD_REGION_SCENARIO: DecisionGraph = {
  scenario: "cloud-region-selection",
  nodes: [
    {
      id: "problem",
      type: "evidence",
      label: "Select optimal cloud region",
      confidence: 0.33,
      dependencies: [],
    },
    {
      id: "latency-data",
      type: "evidence",
      label: "Latency measurements",
      confidence: 0.85,
      value: 0.12,
      dependencies: ["problem"],
    },
    {
      id: "cost-data",
      type: "evidence",
      label: "Cost projections",
      confidence: 0.9,
      value: 0.08,
      dependencies: ["problem"],
    },
    {
      id: "compliance-data",
      type: "evidence",
      label: "Compliance requirements",
      confidence: 0.95,
      value: 0.18,
      dependencies: ["problem"],
    },
    {
      id: "hypothesis-east",
      type: "hypothesis",
      label: "us-east is optimal",
      confidence: 0.42,
      dependencies: ["latency-data", "cost-data"],
    },
    {
      id: "hypothesis-west",
      type: "hypothesis",
      label: "us-west is optimal",
      confidence: 0.28,
      dependencies: ["latency-data", "cost-data"],
    },
    {
      id: "hypothesis-eu",
      type: "hypothesis",
      label: "eu-west is optimal",
      confidence: 0.58,
      dependencies: ["latency-data", "cost-data", "compliance-data"],
    },
    {
      id: "decision",
      type: "decision",
      label: "Deploy to eu-west",
      confidence: 0.78,
      dependencies: ["hypothesis-east", "hypothesis-west", "hypothesis-eu"],
    },
  ],
  voi: [
    {
      evidenceId: "traffic-patterns",
      currentConfidence: 0.78,
      expectedConfidence: 0.91,
      cost: 50,
    },
    {
      evidenceId: "reliability-history",
      currentConfidence: 0.78,
      expectedConfidence: 0.85,
      cost: 0,
    },
    {
      evidenceId: "user-distribution",
      currentConfidence: 0.78,
      expectedConfidence: 0.88,
      cost: 25,
    },
  ],
};

const ARCHITECTURE_DECISION_SCENARIO: DecisionGraph = {
  scenario: "architecture-pattern-selection",
  nodes: [
    {
      id: "problem",
      type: "evidence",
      label: "Select system architecture",
      confidence: 0.25,
      dependencies: [],
    },
    {
      id: "scale-req",
      type: "evidence",
      label: "Scale requirements: 10K RPS",
      confidence: 0.9,
      value: 0.15,
      dependencies: ["problem"],
    },
    {
      id: "team-size",
      type: "evidence",
      label: "Team size: 8 engineers",
      confidence: 1.0,
      value: 0.1,
      dependencies: ["problem"],
    },
    {
      id: "latency-req",
      type: "evidence",
      label: "Latency requirement: <100ms p99",
      confidence: 0.85,
      value: 0.2,
      dependencies: ["problem"],
    },
    {
      id: "hypothesis-monolith",
      type: "hypothesis",
      label: "Monolithic architecture",
      confidence: 0.35,
      dependencies: ["scale-req", "team-size"],
    },
    {
      id: "hypothesis-microservices",
      type: "hypothesis",
      label: "Microservices architecture",
      confidence: 0.65,
      dependencies: ["scale-req", "team-size", "latency-req"],
    },
    {
      id: "decision",
      type: "decision",
      label: "Adopt microservices with modular monolith phase",
      confidence: 0.72,
      dependencies: ["hypothesis-monolith", "hypothesis-microservices"],
    },
  ],
  voi: [
    {
      evidenceId: "team-experience",
      currentConfidence: 0.72,
      expectedConfidence: 0.85,
      cost: 0,
    },
    {
      evidenceId: "vendor-benchmarks",
      currentConfidence: 0.72,
      expectedConfidence: 0.8,
      cost: 100,
    },
  ],
};

export function seed(): { success: boolean; message: string } {
  console.log("🌱 Seeding multi-step-reasoning example...");

  const dataDir = resolve(__dirname, ".scenarios");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const scenarios = {
    "cloud-region.json": CLOUD_REGION_SCENARIO,
    "architecture-decision.json": ARCHITECTURE_DECISION_SCENARIO,
  };

  for (const [filename, scenario] of Object.entries(scenarios)) {
    writeFileSync(
      resolve(dataDir, filename),
      JSON.stringify(scenario, null, 2)
    );
    console.log(`   Generated: ${filename}`);
  }

  // Generate summary
  console.log("\n✅ Decision scenarios generated:");

  for (const [name, scenario] of Object.entries(scenarios)) {
    console.log(`\n   ${scenario.scenario}:`);
    console.log(`     Nodes: ${scenario.nodes.length}`);
    console.log(
      `     Evidence: ${scenario.nodes.filter((n) => n.type === "evidence").length}`
    );
    console.log(
      `     Hypotheses: ${scenario.nodes.filter((n) => n.type === "hypothesis").length}`
    );
    console.log(`     VOI opportunities: ${scenario.voi.length}`);
  }

  return { success: true, message: "Decision scenarios generated" };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = seed();
  process.exit(result.success ? 0 : 1);
}
