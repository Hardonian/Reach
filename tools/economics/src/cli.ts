#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs-extra";
import path from "path";
import { loadConfig } from "./config";
import { calculateRunCost } from "./cost_model";
import { calculateBreakEven } from "./breakeven";
import { LedgerEntry } from "./types";

const program = new Command();

const TELEMETRY_DIR = path.join(process.cwd(), "telemetry");
const LEDGER_DIR = path.join(TELEMETRY_DIR, "ledger");

async function getLedgerEntries(windowDays: number): Promise<LedgerEntry[]> {
  if (!fs.existsSync(LEDGER_DIR)) return [];

  const files = await fs.readdir(LEDGER_DIR);
  const entries: LedgerEntry[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const content = await fs.readFile(path.join(LEDGER_DIR, file), "utf-8");
    const lines = content.split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LedgerEntry;
        if (new Date(entry.timestamp) >= cutoff) {
          entries.push(entry);
        }
      } catch (e) {
        // ignore bad lines
      }
    }
  }
  return entries;
}

program.name("reach-economics").description("Reach Economics & Metrics Engine");

program
  .command("report")
  .description("Generate cost report")
  .option("-w, --window <days>", "Time window in days", "7")
  .action(async (options) => {
    try {
      const config = await loadConfig();
      const entries = await getLedgerEntries(parseInt(options.window));

      console.log(`
=== Reach Cost Report (Last ${options.window} days) ===
`);

      if (entries.length === 0) {
        console.log("No telemetry data found.");
        return;
      }

      let totalCost = 0;
      let totalTokens = 0;
      let totalDuration = 0;
      const costByWorkflow: Record<string, number> = {};

      for (const entry of entries) {
        const cost = calculateRunCost(entry, config);
        totalCost += cost.total_cost;
        totalTokens += entry.tokens_in + entry.tokens_out;
        totalDuration += entry.duration_ms;

        costByWorkflow[entry.workflow_id] =
          (costByWorkflow[entry.workflow_id] || 0) + cost.total_cost;
      }

      console.log(`Total Runs:       ${entries.length}`);
      console.log(`Total Cost:       $${totalCost.toFixed(4)}`);
      console.log(`Avg Cost/Run:     $${(totalCost / entries.length).toFixed(4)}`);
      console.log(`Avg Latency:      ${(totalDuration / entries.length).toFixed(0)}ms`);
      console.log(`Total Tokens:     ${totalTokens}`);
      console.log(`
Top Expensive Workflows:`);

      Object.entries(costByWorkflow)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([id, cost]) => {
          console.log(`  - ${id}: $${cost.toFixed(4)}`);
        });
    } catch (error: any) {
      console.error("Error generating report:", error.message);
      process.exit(1);
    }
  });

program
  .command("scenarios")
  .description("Run break-even scenarios")
  .option("--tiers <tiers>", "Tiers to run", "all")
  .action(async () => {
    try {
      const config = await loadConfig();
      // Simulate avg cost based on config if no data, or use defaults
      const avgCost = 0.01; // $0.01 per run assumption

      console.log(`
=== Break-Even Analysis ===
`);
      console.log(`Assumptions:`);
      console.log(`  Avg Cost/Run: $${avgCost}`);
      console.log(`  Fixed Costs:  $5000/mo`);
      console.log(`  Price/User:   $29/mo (Pro Tier)`);

      const analysis = calculateBreakEven(avgCost, 29, 5000);

      console.log(`
Results:`);
      console.log(`  Users to Break Even:       ${analysis.users_needed}`);
      console.log(`  Daily Runs to Break Even:  ${analysis.runs_per_day_needed}`);
      console.log(`  Contribution Margin/User:  $${analysis.current_margin.toFixed(2)}`);

      console.log(`
Scale Triggers:`);
      if (analysis.users_needed > 1000)
        console.log(
          `  [!] High break-even point. Consider raising prices or optimizing token usage.`,
        );
      else console.log(`  [OK] Unit economics look healthy.`);
    } catch (error: any) {
      console.error("Error running scenarios:", error.message);
      process.exit(1);
    }
  });

program
  .command("metrics")
  .description("GTM Metrics")
  .option("-w, --window <days>", "Time window", "30")
  .action(async (options) => {
    const entries = await getLedgerEntries(parseInt(options.window));
    const uniqueTenants = new Set(entries.map((e) => e.tenant_id)).size;
    const uniqueWorkflows = new Set(entries.map((e) => e.workflow_id)).size;

    console.log(`
=== GTM Metrics (Last ${options.window} days) ===
`);
    console.log(`Active Tenants:   ${uniqueTenants}`);
    console.log(`Active Workflows: ${uniqueWorkflows}`);
    console.log(`Total Executions: ${entries.length}`);
    if (uniqueTenants > 0) {
      console.log(`Runs/Tenant:      ${(entries.length / uniqueTenants).toFixed(1)}`);
    }
  });

program
  .command("simulate")
  .description("Generate dummy telemetry data for verification")
  .action(async () => {
    await fs.ensureDir(LEDGER_DIR);
    const file = path.join(LEDGER_DIR, `sim-${Date.now()}.jsonl`);
    const models = ["gpt-4", "gpt-3.5-turbo", "claude-3-opus"];
    const workflows = ["research-agent", "code-gen", "data-extractor"];

    let content = "";
    for (let i = 0; i < 50; i++) {
      const entry: LedgerEntry = {
        id: `run-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        tenant_id: Math.random() > 0.5 ? "tenant-a" : "tenant-b",
        workflow_id: workflows[Math.floor(Math.random() * workflows.length)],
        model_id: models[Math.floor(Math.random() * models.length)],
        tokens_in: Math.floor(Math.random() * 1000),
        tokens_out: Math.floor(Math.random() * 500),
        duration_ms: Math.floor(Math.random() * 5000) + 500,
        status: "success",
      };
      content += JSON.stringify(entry) + "\n";
    }

    await fs.writeFile(file, content);
    console.log(`Generated 50 simulated runs in ${file}`);
  });

program.parse(process.argv);
