// @ts-nocheck
/**
 * Replay CLI Module
 *
 * CLI commands for running replay datasets and generating calibration reports.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ReplayDataset, ReplayResult, DecisionSpec } from "@zeo/contracts";
import { assertReplayDataset } from "@zeo/contracts";

interface BudgetUsage {
  resource: string;
  used: number;
  limit: number;
  percentUsed: number;
  isWarning: boolean;
  isExceeded: boolean;
}

interface BudgetCheckResult {
  allowed: boolean;
  warnings: BudgetUsage[];
  exceeded: BudgetUsage[];
  usage: BudgetUsage[];
  suggestions: string[];
}

interface DiffEntry {
  path: string;
  expected: unknown;
  actual: unknown;
}

interface RunData {
  inputs: Record<string, unknown>;
  assumptions: unknown[];
  uncertaintyMap: Record<string, unknown>;
  artifacts: Record<string, unknown>;
  outputs: Record<string, unknown>;
  events: unknown[];
  seed?: string;
}

async function importOrFallback<T>(specifier: string, fallbackRelativeToDist: string): Promise<T> {
  try {
    return await import(specifier) as T;
  } catch {
    const fallbackUrl = new URL(fallbackRelativeToDist, import.meta.url);
    return await import(fallbackUrl.href) as T;
  }
}

async function importPreferFallback<T>(fallbackRelativeToDist: string, specifier: string): Promise<T> {
  try {
    const fallbackUrl = new URL(fallbackRelativeToDist, import.meta.url);
    return await import(fallbackUrl.href) as T;
  } catch {
    return await import(specifier) as T;
  }
}

export interface ReplayCliArgs {
  replay: string | undefined;
  case: string | undefined;
  reportOut: string | undefined;
  strict: boolean;
  pack: string | undefined;
  verify: boolean;
}

export function parseReplayArgs(argv: string[]): ReplayCliArgs {
  const result: ReplayCliArgs = {
    replay: undefined,
    case: undefined,
    reportOut: undefined,
    strict: true,
    pack: undefined,
    verify: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if ((arg === "--replay" || arg === "-r") && next) {
      result.replay = next;
      i++;
    } else if ((arg === "--pack" || arg === "-p") && next) {
      result.pack = next;
      i++;
    } else if (arg === "--case" && next) {
      result.case = next;
      i++;
    } else if (arg === "--report-out" && next) {
      result.reportOut = next;
      i++;
    } else if (arg === "--verify") {
      result.verify = true;
    } else if (arg === "--strict") {
      const val = next;
      if (val && (val === "false" || val === "0")) {
        result.strict = false;
        i++;
      } else {
        result.strict = true;
      }
    }
  }

  return result;
}

export async function runReplayCommand(args: ReplayCliArgs): Promise<number> {
  let replayMod: { replayCase: (item: unknown, opts: unknown) => Promise<ReplayResult> };
  let budgetsMod: {
    createTracker: (defaults: unknown, ctx: string) => void;
    checkBudget: (ctx: string) => BudgetCheckResult;
    recordUsage: (ctx: string, resource: string, amount: number) => void;
    createBudgetGuard: (ctx: string) => { checkAndRecord: (resource: string, amount: number) => boolean; record: (resource: string, amount: number) => void; };
    SAFE_DEFAULTS: unknown;
  };
  let jobsMod: { getJobQueue: (opts: { autoStart: boolean }) => { stop: () => void } };
  let reproMod: {
    readReproPackZip: (buffer: Buffer) => Record<string, string>;
    replayFromPack: (files: Record<string, string>, pipeline: (inputs: Record<string, unknown>, assumptions: unknown[], seed?: string) => Promise<RunData>, opts: { verify: boolean }) => Promise<{ match: boolean; errors: string[]; diffs: DiffEntry[] }>;
    createAssumptionTracker: () => { getAssumption: (id: string) => unknown; recordAssumption: (assumption: unknown) => void; getAssumptions: () => unknown[]; getUncertaintyMap: () => Record<string, unknown>; getEvents: () => unknown[]; };
    EXIT_CODES: { SUCCESS: number; FAIL: number };
  };
  let coreMod: { runDecision: (spec: DecisionSpec, opts: { tracker: unknown }) => { explanation: { whatWouldChange: unknown }; nextBestEvidence: unknown; graph: { nodes: unknown[]; edges: unknown[] }; evaluations: unknown; } };

  try {
    replayMod = await importPreferFallback<{ replayCase: (item: unknown, opts: unknown) => Promise<ReplayResult>; }>("../../../packages/replay/src/index.js", "@zeo/replay");
    budgetsMod = await importOrFallback<{
    createTracker: (defaults: unknown, ctx: string) => void;
    checkBudget: (ctx: string) => BudgetCheckResult;
    recordUsage: (ctx: string, resource: string, amount: number) => void;
    createBudgetGuard: (ctx: string) => { checkAndRecord: (resource: string, amount: number) => boolean; record: (resource: string, amount: number) => void; };
    SAFE_DEFAULTS: unknown;
  }>("@zeo/budgets", "../../../packages/budgets/src/index.js");
    jobsMod = await importOrFallback<{ getJobQueue: (opts: { autoStart: boolean }) => { stop: () => void; }; }>("@zeo/jobs", "../../../packages/jobs/src/index.js");
    reproMod = await importPreferFallback<{
    readReproPackZip: (buffer: Buffer) => Record<string, string>;
    replayFromPack: (files: Record<string, string>, pipeline: (inputs: Record<string, unknown>, assumptions: unknown[], seed?: string) => Promise<RunData>, opts: { verify: boolean }) => Promise<{ match: boolean; errors: string[]; diffs: DiffEntry[] }>;
    createAssumptionTracker: () => { getAssumption: (id: string) => unknown; recordAssumption: (assumption: unknown) => void; getAssumptions: () => unknown[]; getUncertaintyMap: () => Record<string, unknown>; getEvents: () => unknown[]; };
    EXIT_CODES: { SUCCESS: number; FAIL: number };
  }>("../../../packages/repro-pack/src/index.js", "@zeo/repro-pack");
    coreMod = await importPreferFallback<{ runDecision: (spec: DecisionSpec, opts: { tracker: unknown }) => { explanation: { whatWouldChange: unknown }; nextBestEvidence: unknown; graph: { nodes: unknown[]; edges: unknown[] }; evaluations: unknown; }; }>("../../../packages/core/src/index.js", "@zeo/core");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Replay runtime unavailable: ${message}`);
    console.error("Next steps: run 'pnpm -r build' to compile workspace packages required by replay.");
    return 1;
  }

  const { replayCase } = replayMod;
  const { createTracker, checkBudget, recordUsage, createBudgetGuard, SAFE_DEFAULTS } = budgetsMod;
  const { getJobQueue } = jobsMod;
  const { readReproPackZip, replayFromPack, createAssumptionTracker, EXIT_CODES } = reproMod;
  const { runDecision } = coreMod;
  // ─── Repro Pack Replay ────────────────────────────────────────────────────
  if (args.pack) {
    console.log(`\nReplaying pack: ${args.pack}`);
    console.log("Reading zip...");

    let files: Record<string, string>;
    try {
      // Read as buffer for AdmZip
      const buffer = readFileSync(resolve(args.pack));
      files = readReproPackZip(buffer);
    } catch (err) {
      console.error(`Error reading pack: ${(err as Error).message}`);
      return 1;
    }

    const pipeline = async (
      inputs: Record<string, unknown>,
      _assumptions: unknown[],
      _seed?: string
    ): Promise<RunData> => {
      // Reconstitute the run execution
      // We expect inputs to contain the spec as per pack-cli.ts convention
      const spec = inputs["spec"] as DecisionSpec;
      if (!spec) {
        throw new Error("Invalid pack inputs: missing 'spec' field");
      }

      console.log(`Running decision: ${spec.title || "Untitled"}`);
      const tracker = createAssumptionTracker();

      // Execute with tracker
      const result = runDecision(spec, { tracker });

      // Build RunData (must match pack-cli.ts logic)
      // Note: explicit spec assumptions are re-recorded if missing
      for (const a of spec.assumptions || []) {
        if (!tracker.getAssumption(a.id)) {
          tracker.recordAssumption({
            key: a.id,
            label: "User Assumption from Spec",
            value: true,
            units: "boolean",
            source: "user",
            rationale: "Explicit in spec",
            sensitivity: "med",
            provenance: { path: "spec definition" },
          });
        }
      }

      return {
        inputs,
        assumptions: tracker.getAssumptions(),
        uncertaintyMap: tracker.getUncertaintyMap(),
        artifacts: {
          flipDistance: result.explanation.whatWouldChange,
          voiRankings: result.nextBestEvidence,
          evidencePlan: { note: "Not generated in this simplified run" },
        },
        outputs: {
          graphNodes: result.graph.nodes.length,
          graphEdges: result.graph.edges.length,
          evaluations: result.evaluations,
          explanation: result.explanation,
        },
        events: tracker.getEvents(),
        seed: _seed,
      };
    };

    console.log("Verifying replay...");
    const result = await replayFromPack(files, pipeline, { verify: args.verify });

    if (result.match) {
      console.log("✅ Replay successful: Outputs match exactly.");
      return 0;
    } else {
      console.error("❌ Replay failed: Mismatch detected.");
      if (result.errors.length > 0) {
        console.error("Errors:");
        result.errors.forEach((e: string) => console.error(`  - ${e}`));
      }
      if (result.diffs.length > 0) {
        console.error("Differences (JSON Pointers):");
        result.diffs.forEach((d: DiffEntry) => {
          console.error(`  ${d.path}`);
          console.error(`    Expect: ${JSON.stringify(d.expected)}`);
          console.error(`    Actual: ${JSON.stringify(d.actual)}`);
        });
      }
      return 1;
    }
  }

  // ─── Legacy Dataset Replay ────────────────────────────────────────────────
  if (!args.replay) {
    console.error("Error: --replay <path> or --pack <path> is required");
    return 1;
  }

  // Initialize budget tracking — context is derived from replay path for idempotency
  const replayPath = resolve(args.replay);
  const budgetContext = `replay-${createHash("sha256").update(replayPath).digest("hex").slice(0, 12)}`;
  createTracker(SAFE_DEFAULTS, budgetContext);
  const budgetGuard = createBudgetGuard(budgetContext);

  // Read and parse dataset
  let dataset: ReplayDataset;
  try {
    const content = readFileSync(resolve(args.replay), "utf8");
    dataset = JSON.parse(content) as ReplayDataset;
  } catch (err) {
    console.error(`Error reading dataset: ${(err as Error).message}`);
    return 1;
  }

  // Validate dataset
  try {
    assertReplayDataset(dataset);
  } catch (err) {
    console.error(`Validation error: ${(err as Error).message}`);
    if (args.strict) {
      return 1;
    }
  }

  // Check budget before starting
  const initialBudgetCheck = checkBudget(budgetContext);
  if (!initialBudgetCheck.allowed) {
    console.error("Error: Budget constraints exceeded before starting");
    printBudgetIssues(initialBudgetCheck);
    return 1;
  }

  console.log(`\nRunning replay: ${dataset.datasetId}`);
  console.log(`Description: ${dataset.description ?? "N/A"}`);
  console.log(`Cases: ${dataset.cases.length}`);
  console.log("");

  // Filter cases if --case specified
  const casesToRun = args.case
    ? dataset.cases.filter(c => c.caseId === args.case)
    : dataset.cases;

  if (args.case && casesToRun.length === 0) {
    console.error(`Error: Case "${args.case}" not found in dataset`);
    return 1;
  }

  // Check budget for expected cases
  if (!budgetGuard.checkAndRecord("cases", casesToRun.length)) {
    console.error(`Error: Case budget exceeded (${casesToRun.length} cases requested)`);
    const budgetStatus = checkBudget(budgetContext);
    printBudgetIssues(budgetStatus);
    return 1;
  }

  // Initialize job queue for async processing
  const jobQueue = getJobQueue({ autoStart: true });

  // Run each case
  const results: ReplayResult[] = [];
  let hasErrors = false;

  for (const replayCaseData of casesToRun) {
    // Check budget before each case
    const caseBudgetCheck = checkBudget(budgetContext);
    if (!caseBudgetCheck.allowed) {
      console.error(`\nBudget exceeded before case: ${replayCaseData.caseId}`);
      printBudgetIssues(caseBudgetCheck);
      hasErrors = true;
      break;
    }

    console.log(`\nProcessing case: ${replayCaseData.caseId}`);
    console.log(`  Label: ${replayCaseData.label}`);

    try {
      // Record branch usage estimate
      budgetGuard.record("branches", 50); // Estimate 50 branches per case

      const result = await replayCase(replayCaseData, {
        depth: 3,
        limits: {},
        strict: args.strict,
      });

      results.push(result);

      // Print summary
      console.log(`  Checkpoints: ${result.checkpoints.length}`);
      console.log(`  Coverage: ${(result.scoring.coverage.overall * 100).toFixed(1)}%`);
      console.log(
        `  Recommended widen factor: ${result.scoring.recommendedAdjustment.widenFactorOverall.toFixed(2)}x`
      );

      // Check budget warnings
      const afterCaseBudget = checkBudget(budgetContext);
      if (afterCaseBudget.warnings.length > 0) {
        console.log(`  Budget warnings: ${afterCaseBudget.warnings.length}`);
      }
    } catch (err) {
      console.error(`  Error: ${(err as Error).message}`);
      hasErrors = true;
      if (args.strict) {
        return 1;
      }
    }
  }

  // Aggregate results
  const aggregateCoverage =
    results.reduce((sum, r) => sum + r.scoring.coverage.overall, 0) /
    Math.max(results.length, 1);

  const aggregateWidenFactor =
    results.reduce((sum, r) => sum + r.scoring.recommendedAdjustment.widenFactorOverall, 0) /
    Math.max(results.length, 1);

  // Print budget summary
  const finalBudgetCheck = checkBudget(budgetContext);

  console.log("\n" + "=".repeat(60));
  console.log("REPLAY SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total cases: ${results.length}`);
  console.log(`Overall coverage: ${(aggregateCoverage * 100).toFixed(1)}%`);
  console.log(`Recommended widen factor: ${aggregateWidenFactor.toFixed(2)}x`);

  // Budget usage summary
  if (finalBudgetCheck.usage.length > 0) {
    console.log("\nBudget Usage:");
    for (const usage of finalBudgetCheck.usage) {
      const status = usage.isExceeded ? "EXCEEDED" : usage.isWarning ? "warning" : "ok";
      console.log(`  ${usage.resource}: ${usage.used}/${usage.limit} (${(usage.percentUsed * 100).toFixed(0)}%) [${status}]`);
    }
  }

  // Per-domain breakdown
  const domainStats: Record<string, { coverages: number[]; widenFactors: number[] }> = {};
  for (const result of results) {
    for (const [domain, coverage] of Object.entries(result.scoring.coverage.byDomain)) {
      if (!domainStats[domain]) {
        domainStats[domain] = { coverages: [], widenFactors: [] };
      }
      domainStats[domain].coverages.push(coverage);
    }
    for (const [domain, factor] of Object.entries(result.scoring.recommendedAdjustment.widenFactorByDomain)) {
      if (!domainStats[domain]) {
        domainStats[domain] = { coverages: [], widenFactors: [] };
      }
      domainStats[domain].widenFactors.push(factor);
    }
  }

  if (Object.keys(domainStats).length > 0) {
    console.log("\nPer-domain:");
    for (const [domain, stats] of Object.entries(domainStats)) {
      const avgCoverage =
        stats.coverages.reduce((a, b) => a + b, 0) / Math.max(stats.coverages.length, 1);
      const avgWiden =
        stats.widenFactors.reduce((a, b) => a + b, 0) / Math.max(stats.widenFactors.length, 1);
      console.log(`  ${domain}: ${(avgCoverage * 100).toFixed(1)}% coverage, ${avgWiden.toFixed(2)}x widen`);
    }
  }

  // Generate reports if output directory specified
  if (args.reportOut) {
    const outputDir = resolve(args.reportOut);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON report
    const reportJson = {
      datasetId: dataset.datasetId,
      runAt: new Date().toISOString(),
      summary: {
        totalCases: results.length,
        overallCoverage: aggregateCoverage,
        recommendedWidenFactor: aggregateWidenFactor,
        byDomain: Object.fromEntries(
          Object.entries(domainStats).map(([domain, stats]) => [
            domain,
            {
              coverage:
                stats.coverages.reduce((a, b) => a + b, 0) / Math.max(stats.coverages.length, 1),
              widenFactor:
                stats.widenFactors.reduce((a, b) => a + b, 0) / Math.max(stats.widenFactors.length, 1),
            },
          ])
        ),
      },
      caseResults: results,
    };

    const jsonPath = join(outputDir, "replay_results.json");
    writeFileSync(jsonPath, JSON.stringify(reportJson, null, 2), "utf8");
    console.log(`\nJSON report: ${jsonPath}`);

    // Write markdown report
    const mdPath = join(outputDir, "calibration_report.md");
    const mdContent = generateMarkdownReport(dataset, reportJson);
    writeFileSync(mdPath, mdContent, "utf8");
    console.log(`Markdown report: ${mdPath}`);
  }

  console.log("");
  return hasErrors ? 1 : 0;
}

function printBudgetIssues(budgetCheck: BudgetCheckResult): void {
  if (budgetCheck.exceeded.length > 0) {
    console.error("\nBudget exceeded:");
    for (const usage of budgetCheck.exceeded) {
      console.error(`  - ${usage.resource}: ${usage.used}/${usage.limit} (${(usage.percentUsed * 100).toFixed(0)}%)`);
    }
  }
  if (budgetCheck.warnings.length > 0) {
    console.warn("\nBudget warnings:");
    for (const usage of budgetCheck.warnings) {
      console.warn(`  - ${usage.resource}: ${usage.used}/${usage.limit} (${(usage.percentUsed * 100).toFixed(0)}%)`);
    }
  }
  if (budgetCheck.suggestions.length > 0) {
    console.log("\nSuggestions:");
    for (const suggestion of budgetCheck.suggestions) {
      console.log(`  - ${suggestion}`);
    }
  }
}

function generateMarkdownReport(
  dataset: ReplayDataset,
  reportJson: {
    runAt: string;
    summary: {
      totalCases: number;
      overallCoverage: number;
      recommendedWidenFactor: number;
      byDomain: Record<string, { coverage: number; widenFactor: number }>;
    };
    caseResults: ReplayResult[];
  }
): string {
  const lines: string[] = [];

  lines.push(`# Calibration Report: ${dataset.datasetId}`);
  lines.push("");
  lines.push(`**Generated:** ${reportJson.runAt}`);
  lines.push(`**Description:** ${dataset.description ?? "N/A"}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Total Cases:** ${reportJson.summary.totalCases}`);
  lines.push(`- **Overall Coverage:** ${(reportJson.summary.overallCoverage * 100).toFixed(1)}%`);
  lines.push(`- **Recommended Widen Factor:** ${reportJson.summary.recommendedWidenFactor.toFixed(2)}x`);
  lines.push("");

  if (Object.keys(reportJson.summary.byDomain).length > 0) {
    lines.push("### By Domain");
    lines.push("");
    lines.push("| Domain | Coverage | Widen Factor |");
    lines.push("|--------|----------|--------------|");
    for (const [domain, stats] of Object.entries(reportJson.summary.byDomain)) {
      lines.push(
        `| ${domain} | ${(stats.coverage * 100).toFixed(1)}% | ${stats.widenFactor.toFixed(2)}x |`
      );
    }
    lines.push("");
  }

  lines.push("## Results by Case");
  lines.push("");

  for (const result of reportJson.caseResults) {
    lines.push(`### ${result.caseId}`);
    lines.push("");
    lines.push(`- **Checkpoints:** ${result.checkpoints.length}`);
    lines.push(`- **Coverage:** ${(result.scoring.coverage.overall * 100).toFixed(1)}%`);
    lines.push(
      `- **Widen Factor:** ${result.scoring.recommendedAdjustment.widenFactorOverall.toFixed(2)}x`
    );
    lines.push(
      `- **Rationale:** ${result.scoring.recommendedAdjustment.rationale}`
    );

    if (Object.keys(result.scoring.coverage.byMetricId).length > 0) {
      lines.push("");
      lines.push("**Per-Metric Coverage:**");
      lines.push("");
      for (const [metricId, coverage] of Object.entries(result.scoring.coverage.byMetricId)) {
        lines.push(`- ${metricId}: ${(coverage * 100).toFixed(1)}%`);
      }
    }

    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*This report was generated by Zeo Replay Runner v0.3.1*");
  lines.push("*Calibration follows the widen-only rule: intervals may only be widened, never narrowed.*");
  lines.push("");

  return lines.join("\n");
}

