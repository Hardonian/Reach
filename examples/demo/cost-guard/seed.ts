/**
 * Cost Guard Example - Seed Script
 *
 * Generates cost estimates and routing scenarios for testing.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface CostScenario {
  name: string;
  budget: number;
  task: {
    type: string;
    complexity: "low" | "medium" | "high";
    estimatedTokens: number;
  };
  expectedTier: string;
  expectedModel: string;
  estimatedCost: number;
}

const SCENARIOS: CostScenario[] = [
  {
    name: "minimal-budget",
    budget: 0.1,
    task: {
      type: "summarization",
      complexity: "low",
      estimatedTokens: 1500,
    },
    expectedTier: "minimal",
    expectedModel: "gpt-3.5-turbo",
    estimatedCost: 0.0023,
  },
  {
    name: "standard-budget",
    budget: 1.0,
    task: {
      type: "code-review",
      complexity: "medium",
      estimatedTokens: 3500,
    },
    expectedTier: "standard",
    expectedModel: "claude-3-sonnet",
    estimatedCost: 0.0525,
  },
  {
    name: "premium-budget",
    budget: 10.0,
    task: {
      type: "architecture-design",
      complexity: "high",
      estimatedTokens: 8000,
    },
    expectedTier: "premium",
    expectedModel: "claude-3-opus",
    estimatedCost: 0.48,
  },
  {
    name: "tight-budget-downgrade",
    budget: 0.5,
    task: {
      type: "analysis",
      complexity: "medium",
      estimatedTokens: 5000,
    },
    expectedTier: "minimal",
    expectedModel: "gpt-3.5-turbo",
    estimatedCost: 0.0075,
  },
];

interface ModelRates {
  models: Array<{
    id: string;
    name: string;
    tier: string;
    rates: {
      input: number;
      output: number;
    };
    contextWindow: number;
  }>;
}

const MODEL_RATES: ModelRates = {
  models: [
    {
      id: "gpt-3.5-turbo",
      name: "GPT-3.5 Turbo",
      tier: "minimal",
      rates: {
        input: 0.0005,
        output: 0.0015,
      },
      contextWindow: 16385,
    },
    {
      id: "gpt-4",
      name: "GPT-4",
      tier: "standard",
      rates: {
        input: 0.03,
        output: 0.06,
      },
      contextWindow: 8192,
    },
    {
      id: "claude-3-sonnet",
      name: "Claude 3 Sonnet",
      tier: "standard",
      rates: {
        input: 0.003,
        output: 0.015,
      },
      contextWindow: 200000,
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      tier: "premium",
      rates: {
        input: 0.01,
        output: 0.03,
      },
      contextWindow: 128000,
    },
    {
      id: "claude-3-opus",
      name: "Claude 3 Opus",
      tier: "premium",
      rates: {
        input: 0.015,
        output: 0.075,
      },
      contextWindow: 200000,
    },
  ],
};

export function seed(): { success: boolean; message: string } {
  console.log("🌱 Seeding cost-guard example...");

  const dataDir = resolve(__dirname, ".data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Write scenarios
  writeFileSync(
    resolve(dataDir, "scenarios.json"),
    JSON.stringify({ scenarios: SCENARIOS }, null, 2),
  );

  // Write model rates
  writeFileSync(resolve(dataDir, "model-rates.json"), JSON.stringify(MODEL_RATES, null, 2));

  // Generate routing table
  const routingTable = {
    tiers: {
      minimal: { maxCost: 0.1, models: ["gpt-3.5-turbo"] },
      standard: { maxCost: 1.0, models: ["gpt-4", "claude-3-sonnet"] },
      premium: { maxCost: 10.0, models: ["gpt-4-turbo", "claude-3-opus"] },
    },
  };
  writeFileSync(resolve(dataDir, "routing-table.json"), JSON.stringify(routingTable, null, 2));

  console.log("\n✅ Cost guard data generated:");
  console.log("   Scenarios:", SCENARIOS.length);
  console.log("   Models:", MODEL_RATES.models.length);
  console.log("   Tiers:", Object.keys(routingTable.tiers).length);

  console.log("\n📊 Scenario Summary:");
  for (const s of SCENARIOS) {
    console.log(`   ${s.name}: $${s.budget} budget → ${s.expectedTier} tier (${s.expectedModel})`);
  }

  return { success: true, message: "Cost scenarios generated" };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = seed();
  process.exit(result.success ? 0 : 1);
}
