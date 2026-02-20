#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { loadConfig } from './config';
import { calculateRunCost, aggregateCosts } from './cost_model';
import { calculateBreakEven, analyzeAllTiers } from './breakeven';
import { LedgerEntry, LedgerEntrySchema, PLAN_TIERS } from './types';

const program = new Command();

const TELEMETRY_DIR = path.join(process.cwd(), 'telemetry');
const LEDGER_DIR = path.join(TELEMETRY_DIR, 'ledger');

async function getLedgerEntries(windowDays: number): Promise<LedgerEntry[]> {
  if (!fs.existsSync(LEDGER_DIR)) return [];

  const files = await fs.readdir(LEDGER_DIR);
  const entries: LedgerEntry[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() - (windowDays * 24 * 60 * 60 * 1000));

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;
    const content = await fs.readFile(path.join(LEDGER_DIR, file), 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const raw = JSON.parse(line);
        const entry = LedgerEntrySchema.parse(raw);
        if (new Date(entry.timestamp) >= cutoff) {
          entries.push(entry);
        }
      } catch {
        // skip invalid entries
      }
    }
  }
  return entries;
}

program
  .name('reach-economics')
  .description('Reach Economics & Unit Cost Engine')
  .version('1.0.0');

program
  .command('report')
  .description('Generate cost report with per-model and per-workflow breakdown')
  .option('-w, --window <days>', 'Time window in days', '7')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      const entries = await getLedgerEntries(parseInt(options.window));

      console.log(`\n=== Reach Cost Report (Last ${options.window} days) ===\n`);

      if (entries.length === 0) {
        console.log("No telemetry data found.");
        return;
      }

      const agg = aggregateCosts(entries, config);

      console.log(`Total Runs:       ${agg.total_runs}`);
      console.log(`Total Cost:       $${agg.total_cost.toFixed(4)}`);
      console.log(`Avg Cost/Run:     $${agg.avg_cost_per_run.toFixed(4)}`);
      console.log(`Avg Latency:      ${agg.avg_latency_ms.toFixed(0)}ms`);
      console.log(`Total Tokens:     ${agg.total_tokens}`);
      console.log(`Success Rate:     ${(agg.success_rate * 100).toFixed(1)}%`);

      console.log(`\nCost by Model:`);
      Object.entries(agg.cost_by_model)
        .sort(([, a], [, b]) => b - a)
        .forEach(([id, cost]) => {
          console.log(`  - ${id}: $${cost.toFixed(4)}`);
        });

      console.log(`\nTop Expensive Workflows:`);
      Object.entries(agg.cost_by_workflow)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([id, cost]) => {
          console.log(`  - ${id}: $${cost.toFixed(4)}`);
        });

      console.log(`\nCost by Tenant:`);
      Object.entries(agg.cost_by_tenant)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([id, cost]) => {
          console.log(`  - ${id}: $${cost.toFixed(4)}`);
        });

    } catch (error: any) {
      console.error("Error generating report:", error.message);
      process.exit(1);
    }
  });

program
  .command('scenarios')
  .description('Run break-even scenarios across all plan tiers')
  .option('--fixed-costs <amount>', 'Monthly fixed costs', '5000')
  .option('--avg-cost <amount>', 'Average cost per run (overrides computed)', '')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      const fixedCosts = parseFloat(options.fixedCosts);

      // Compute avg cost from recent data if not overridden
      let avgCost = parseFloat(options.avgCost) || 0;
      if (!avgCost) {
        const entries = await getLedgerEntries(30);
        if (entries.length > 0) {
          const agg = aggregateCosts(entries, config);
          avgCost = agg.avg_cost_per_run;
        } else {
          avgCost = 0.01; // Fallback assumption
        }
      }

      console.log(`\n=== Break-Even Analysis (All Tiers) ===\n`);
      console.log(`Assumptions:`);
      console.log(`  Avg Cost/Run:    $${avgCost.toFixed(4)}`);
      console.log(`  Fixed Costs:     $${fixedCosts.toFixed(0)}/mo`);

      const tiers = analyzeAllTiers(avgCost, fixedCosts);

      for (const tier of tiers) {
        const plan = PLAN_TIERS[tier.tier];
        console.log(`\n  --- ${plan.name} ($${plan.monthly_price}/mo, ${plan.runs_per_month} runs/mo) ---`);
        if (tier.users_needed === Infinity) {
          console.log(`  [!] Negative margin: $${tier.current_margin.toFixed(2)}/user. Tier is loss-making.`);
        } else {
          console.log(`  Users to Break Even:       ${tier.users_needed}`);
          console.log(`  Daily Runs to Break Even:  ${tier.runs_per_day_needed}`);
          console.log(`  Contribution Margin/User:  $${tier.current_margin.toFixed(2)}`);
          console.log(`  Estimated LTV:             $${tier.ltv_estimate.toFixed(2)}`);
          if (tier.users_needed > 1000) {
            console.log(`  [!] High break-even point.`);
          } else {
            console.log(`  [OK] Unit economics look healthy.`);
          }
        }
      }

    } catch (error: any) {
      console.error("Error running scenarios:", error.message);
      process.exit(1);
    }
  });

program
  .command('metrics')
  .description('GTM metrics summary')
  .option('-w, --window <days>', 'Time window', '30')
  .action(async (options) => {
    const config = await loadConfig();
    const entries = await getLedgerEntries(parseInt(options.window));
    const uniqueTenants = new Set(entries.map(e => e.tenant_id)).size;
    const uniqueWorkflows = new Set(entries.map(e => e.workflow_id)).size;
    const uniqueModels = new Set(entries.map(e => e.model_id)).size;

    console.log(`\n=== GTM Metrics (Last ${options.window} days) ===\n`);
    console.log(`Active Tenants:   ${uniqueTenants}`);
    console.log(`Active Workflows: ${uniqueWorkflows}`);
    console.log(`Models Used:      ${uniqueModels}`);
    console.log(`Total Executions: ${entries.length}`);
    if (uniqueTenants > 0) {
      console.log(`Runs/Tenant:      ${(entries.length / uniqueTenants).toFixed(1)}`);
      const agg = aggregateCosts(entries, config);
      console.log(`Cost/Tenant:      $${(agg.total_cost / uniqueTenants).toFixed(4)}`);
    }
  });

program
  .command('simulate')
  .description('Generate dummy telemetry data for verification')
  .option('-n, --count <num>', 'Number of runs to simulate', '50')
  .action(async (options) => {
    await fs.ensureDir(LEDGER_DIR);
    const file = path.join(LEDGER_DIR, `sim-${Date.now()}.jsonl`);
    const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'local-llama'];
    const workflows = ['research-agent', 'code-gen', 'data-extractor'];
    const tiers: Array<'free' | 'pro' | 'enterprise'> = ['free', 'pro', 'enterprise'];
    const count = parseInt(options.count);

    let content = '';
    for (let i = 0; i < count; i++) {
      const entry: LedgerEntry = {
        id: `run-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
        tenant_id: Math.random() > 0.5 ? 'tenant-a' : 'tenant-b',
        workflow_id: workflows[Math.floor(Math.random() * workflows.length)],
        model_id: models[Math.floor(Math.random() * models.length)],
        tokens_in: Math.floor(Math.random() * 1000),
        tokens_out: Math.floor(Math.random() * 500),
        duration_ms: Math.floor(Math.random() * 5000) + 500,
        status: Math.random() > 0.05 ? 'success' : 'failure',
        plan_tier: tiers[Math.floor(Math.random() * tiers.length)],
      };
      content += JSON.stringify(entry) + '\n';
    }

    await fs.writeFile(file, content);
    console.log(`Generated ${count} simulated runs in ${file}`);
  });

program.parse(process.argv);
