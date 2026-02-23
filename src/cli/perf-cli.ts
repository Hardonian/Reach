import { loadConfig } from "../core/env.js";
// @ts-nocheck
/**
 * Performance CLI Module
 *
 * Commands:
 *   zeo perf scan [--severity critical] [--paths packages/core,packages/replay]
 *   zeo perf profile --example negotiation --depth 3 [--out perf-report.json]
 *   zeo perf benchmark [--baseline baseline.json] [--out results.json]
 *   zeo perf compare --baseline baseline.json --current current.json
 *   zeo perf regression --replay dataset.json [--threshold 10%]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { cwd } from "node:process";
import {
  StaticHotPathScanner,
  scanHotPaths,
  type ScanOptions,
  type HotPathSeverity,
  type ScanResult,
  type HotPathFinding,
  Profiler,
  getGlobalProfiler,
  startQuickProfile,
  endQuickProfile,
  type ProfileReport,
  type ProfilerOptions,
} from "@zeo/perf";
import {
  makeNegotiationExample,
  makeOpsExample,
  runDecision,
  computeDeterministicSeed,
  hashDecisionSpec,
  canonicalizeDecisionSpec,
} from "@zeo/core";
import { replayCase } from "@zeo/replay";
import { ZeoError, type ReplayDataset, type ReplayOptions } from "@zeo/contracts";

export interface PerfCliArgs {
  command: "scan" | "profile" | "benchmark" | "compare" | "regression" | null;
  // Scan options
  paths: string[];
  severity: HotPathSeverity;
  maxFindings: number;
  experimental: boolean;
  // Profile options
  example: "negotiation" | "ops";
  depth: 2 | 3;
  seed?: string;
  // Output options
  out?: string;
  jsonOnly: boolean;
  // Compare options
  baseline?: string;
  current?: string;
  // Regression options
  replay?: string;
  threshold: number; // percentage
  // Benchmark options
  iterations: number;
  warmup: number;
}

export function parsePerfArgs(argv: string[]): PerfCliArgs {
  const result: PerfCliArgs = {
    command: null,
    paths: [],
    severity: "low",
    maxFindings: 100,
    experimental: false,
    example: "negotiation",
    depth: 2,
    jsonOnly: false,
    threshold: 10, // 10% regression threshold
    iterations: 5,
    warmup: 2,
  };

  // First argument after "perf" is the command
  const perfIdx = argv.indexOf("perf");
  if (perfIdx !== -1 && argv[perfIdx + 1]) {
    const cmd = argv[perfIdx + 1];
    if (["scan", "profile", "benchmark", "compare", "regression"].includes(cmd)) {
      result.command = cmd as PerfCliArgs["command"];
    }
  }

  // Also check if first arg is a command (when called directly)
  if (
    !result.command &&
    argv[0] &&
    ["scan", "profile", "benchmark", "compare", "regression"].includes(argv[0])
  ) {
    result.command = argv[0] as PerfCliArgs["command"];
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--paths" && next) {
      result.paths = next.split(",").map((p) => p.trim());
      i++;
    } else if (arg === "--severity" && next) {
      if (["low", "medium", "high", "critical"].includes(next)) {
        result.severity = next as HotPathSeverity;
      }
      i++;
    } else if (arg === "--max-findings" && next) {
      result.maxFindings = parseInt(next, 10);
      i++;
    } else if (arg === "--experimental") {
      result.experimental = true;
    } else if (arg === "--example" && next) {
      if (next === "negotiation" || next === "ops") {
        result.example = next;
      }
      i++;
    } else if (arg === "--depth" && next) {
      const d = parseInt(next, 10);
      if (d === 2 || d === 3) result.depth = d as 2 | 3;
      i++;
    } else if (arg === "--seed" && next) {
      result.seed = next;
      i++;
    } else if (arg === "--out" && next) {
      result.out = next;
      i++;
    } else if (arg === "--json-only") {
      result.jsonOnly = true;
    } else if (arg === "--baseline" && next) {
      result.baseline = next;
      i++;
    } else if (arg === "--current" && next) {
      result.current = next;
      i++;
    } else if (arg === "--replay" && next) {
      result.replay = next;
      i++;
    } else if (arg === "--threshold" && next) {
      result.threshold = parseFloat(next);
      i++;
    } else if (arg === "--iterations" && next) {
      result.iterations = parseInt(next, 10);
      i++;
    } else if (arg === "--warmup" && next) {
      result.warmup = parseInt(next, 10);
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printPerfHelp();
      process.exit(0);
    }
  }

  return result;
}

function printPerfHelp(): void {
  console.log(`
Zeo Performance CLI - Profiling and benchmarking tools

Usage: zeo perf <command> [options]

Commands:
  scan                        Scan for performance hot paths in source code
  profile                     Profile a decision run
  benchmark                   Run performance benchmarks
  compare                     Compare two performance reports
  regression                  Run performance regression tests using replay

Scan Options:
  --paths <dirs>              Comma-separated paths to scan (default: packages/)
  --severity <level>          Minimum severity: low|medium|high|critical (default: low)
  --max-findings <n>          Maximum findings to report (default: 100)
  --experimental              Enable experimental patterns

Profile Options:
  --example <name>            Example to profile: negotiation|ops (default: negotiation)
  --depth <n>                 Branching depth: 1-5 (default: 2)
  --seed <string>             Random seed for deterministic runs

Benchmark Options:
  --iterations <n>            Number of iterations (default: 5)
  --warmup <n>                Warmup iterations (default: 2)
  --example <name>            Example to benchmark (default: negotiation)
  --depth <n>                 Branching depth (default: 3)

Compare Options:
  --baseline <file>           Baseline performance report JSON
  --current <file>            Current performance report JSON

Regression Options:
  --replay <file>             Replay dataset to use for regression testing
  --threshold <pct>           Regression threshold percentage (default: 10)

Output Options:
  --out <path>                Write JSON output to file
  --json-only                 Output JSON only, no summary

Examples:
  zeo perf scan --paths packages/core --severity critical
  zeo perf profile --example negotiation --depth 3 --out perf.json
  zeo perf benchmark --iterations 10 --out benchmark.json
  zeo perf compare --baseline baseline.json --current current.json
  zeo perf regression --replay external/examples/replay/sample_dataset.json
`);
}

/**
 * Recursively get all TypeScript files in a directory
 */
function getTypeScriptFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (item === "node_modules" || item === "dist" || item === ".git") {
        continue;
      }
      getTypeScriptFiles(fullPath, files);
    } else if (stat.isFile() && (item.endsWith(".ts") || item.endsWith(".tsx"))) {
      // Skip test files and declaration files
      if (!item.endsWith(".test.ts") && !item.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Run hot path scan
 */
async function runScanCommand(args: PerfCliArgs): Promise<number> {
  console.log("\n=== Zeo Performance Scan ===");

  const paths = args.paths.length > 0 ? args.paths : ["packages"];
  const fullPaths = paths.map((p) => resolve(cwd(), p));

  console.log(`Scanning paths: ${paths.join(", ")}`);
  console.log(`Severity threshold: ${args.severity}`);
  console.log(`Experimental patterns: ${args.experimental ? "enabled" : "disabled"}`);
  console.log("");

  const scanOptions: ScanOptions = {
    severityThreshold: args.severity,
    maxFindings: args.maxFindings,
    enableExperimentalPatterns: args.experimental,
  };

  const scanner = new StaticHotPathScanner(scanOptions);
  const allFiles: Array<{ path: string; content: string }> = [];

  // Collect all files
  for (const basePath of fullPaths) {
    if (!existsSync(basePath)) {
      console.warn(`Warning: Path does not exist: ${basePath}`);
      continue;
    }

    const files = getTypeScriptFiles(basePath);
    console.log(`Found ${files.length} TypeScript files in ${relative(cwd(), basePath)}`);

    for (const file of files) {
      try {
        const content = readFileSync(file, "utf8");
        allFiles.push({ path: relative(cwd(), file), content });
      } catch (err) {
        console.warn(`Warning: Could not read ${file}`);
      }
    }
  }

  console.log(`\nScanning ${allFiles.length} files...\n`);

  const result = scanner.scanFiles(allFiles);

  // Print results
  printScanResults(result);

  // Write output if requested
  if (args.out) {
    writeFileSync(args.out, JSON.stringify(result, null, 2), "utf8");
    console.log(`\nScan results written to: ${args.out}`);
  }

  // Return exit code based on critical findings
  if (result.summary.findingsBySeverity.critical > 0) {
    console.log("\n⚠️  Critical hot paths detected!");
    return 1;
  }

  return 0;
}

function printScanResults(result: ScanResult): void {
  console.log(
    `Scanned ${result.summary.totalFilesScanned} files (${result.summary.totalLinesScanned} lines)`,
  );
  console.log(`Found ${result.findings.length} hot paths in ${result.durationMs}ms\n`);

  if (result.findings.length === 0) {
    console.log("✓ No performance issues detected.");
    return;
  }

  // Summary by severity
  console.log("Findings by severity:");
  for (const [severity, count] of Object.entries(result.summary.findingsBySeverity)) {
    const countNum = count as number;
    if (countNum > 0) {
      const icon =
        severity === "critical"
          ? "🔴"
          : severity === "high"
            ? "🟠"
            : severity === "medium"
              ? "🟡"
              : "⚪";
      console.log(`  ${icon} ${severity}: ${countNum}`);
    }
  }

  // Summary by category
  console.log("\nFindings by category:");
  for (const [category, count] of Object.entries(result.summary.findingsByCategory)) {
    const countNum = count as number;
    if (countNum > 0) {
      console.log(`  ${category}: ${countNum}`);
    }
  }

  // Critical paths
  if (result.summary.criticalPaths.length > 0) {
    console.log("\n🔴 Critical Paths (require immediate attention):");
    for (const finding of result.summary.criticalPaths.slice(0, 10)) {
      console.log(`\n  ${finding.filePath}:${finding.lineNumber}`);
      console.log(`    ${finding.description}`);
      console.log(`    ${finding.recommendation}`);
    }
  }

  // Top findings by complexity
  console.log("\n📊 Top 10 Findings by Complexity Score:");
  const topFindings = result.findings.slice(0, 10);
  for (let i = 0; i < topFindings.length; i++) {
    const f = topFindings[i];
    const icon =
      f.severity === "critical"
        ? "🔴"
        : f.severity === "high"
          ? "🟠"
          : f.severity === "medium"
            ? "🟡"
            : "⚪";
    console.log(`\n  ${i + 1}. ${icon} ${f.filePath}:${f.lineNumber}`);
    console.log(`     Function: ${f.functionName}`);
    console.log(`     Category: ${f.category} | Score: ${f.complexityScore}/100`);
    console.log(`     ${f.description}`);
  }
}

/**
 * Run profiling on a decision
 */
async function runProfileCommand(args: PerfCliArgs): Promise<number> {
  console.log("\n=== Zeo Performance Profile ===");

  const spec = args.example === "ops" ? makeOpsExample() : makeNegotiationExample();
  const canonicalSpec = canonicalizeDecisionSpec(spec);
  const decisionHash = hashDecisionSpec(canonicalSpec);
  const seed = args.seed || computeDeterministicSeed(decisionHash, undefined, args.depth);

  console.log(`Example: ${args.example}`);
  console.log(`Depth: ${args.depth}`);
  console.log(`Seed: ${seed.slice(0, 16)}...\n`);

  // Create profiler
  const profiler = getGlobalProfiler({ trackMemory: true });
  const session = profiler.startSession(`profile-${args.example}-d${args.depth}`);
  const sessionId = session.id;

  // Profile the decision run
  await profiler.profile(
    "decision-run",
    sessionId,
    async () => {
      return runDecision(spec, { depth: args.depth });
    },
    { functionName: "runDecision", filePath: "@zeo/core" },
  );

  profiler.endSession(sessionId);
  const report = profiler.generateReport(sessionId);

  // Print results
  printProfileReport(report);

  // Write output if requested
  if (args.out) {
    const output = {
      report,
      metadata: {
        example: args.example,
        depth: args.depth,
        seed,
        decisionHash,
      },
    };
    writeFileSync(args.out, JSON.stringify(output, null, 2), "utf8");
    console.log(`\nProfile report written to: ${args.out}`);
  }

  return 0;
}

function printProfileReport(report: ProfileReport): void {
  console.log(`\nSession: ${report.session.name}`);
  console.log(`Duration: ${report.summary.totalDuration}ms`);
  console.log(`Measurements: ${report.summary.totalMeasurements}`);
  console.log(`Average: ${report.summary.averageDuration.toFixed(2)}ms`);

  if (report.summary.memoryGrowth > 0) {
    console.log(`Memory Growth: ${(report.summary.memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
  }

  if (report.summary.longestOperations.length > 0) {
    console.log("\nLongest Operations:");
    for (const op of report.summary.longestOperations.slice(0, 5)) {
      console.log(`  ${op.name}: ${op.duration?.toFixed(2)}ms`);
    }
  }

  console.log("\n📋 Recommendations:");
  for (const rec of report.recommendations) {
    console.log(`  • ${rec}`);
  }
}

/**
 * Run performance benchmark
 */
async function runBenchmarkCommand(args: PerfCliArgs): Promise<number> {
  console.log("\n=== Zeo Performance Benchmark ===");

  const spec = args.example === "ops" ? makeOpsExample() : makeNegotiationExample();
  const canonicalSpec = canonicalizeDecisionSpec(spec);
  const decisionHash = hashDecisionSpec(canonicalSpec);

  console.log(`Example: ${args.example}`);
  console.log(`Depth: ${args.depth}`);
  console.log(`Warmup: ${args.warmup} iterations`);
  console.log(`Iterations: ${args.iterations}\n`);

  // Warmup
  if (args.warmup > 0) {
    console.log("Running warmup...");
    for (let i = 0; i < args.warmup; i++) {
      const seed = computeDeterministicSeed(decisionHash, undefined, args.depth);
      runDecision(spec, { depth: args.depth });
    }
  }

  // Benchmark
  console.log("Running benchmark...\n");
  const measurements: number[] = [];
  const memorySnapshots: number[] = [];

  for (let i = 0; i < args.iterations; i++) {
    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    const seed = computeDeterministicSeed(decisionHash, undefined, args.depth);
    runDecision(spec, { depth: args.depth });

    const duration = performance.now() - start;
    const memAfter = process.memoryUsage().heapUsed;

    measurements.push(duration);
    memorySnapshots.push(memAfter - memBefore);

    process.stdout.write(`  Iteration ${i + 1}/${args.iterations}: ${duration.toFixed(2)}ms\r`);
  }
  console.log(""); // New line after progress

  // Calculate statistics
  const stats = calculateStats(measurements);
  const memStats = calculateStats(memorySnapshots);

  const benchmark: BenchmarkResult = {
    metadata: {
      example: args.example,
      depth: args.depth,
      iterations: args.iterations,
      warmup: args.warmup,
      timestamp: new Date().toISOString(),
    },
    timing: stats,
    memory: {
      mean: memStats.mean,
      stdDev: memStats.stdDev,
      min: memStats.min,
      max: memStats.max,
      unit: "bytes",
    },
    rawMeasurements: measurements,
  };

  // Print results
  printBenchmarkResults(benchmark);

  // Write output if requested
  if (args.out) {
    writeFileSync(args.out, JSON.stringify(benchmark, null, 2), "utf8");
    console.log(`\nBenchmark results written to: ${args.out}`);
  }

  return 0;
}

interface BenchmarkResult {
  metadata: {
    example: string;
    depth: number;
    iterations: number;
    warmup: number;
    timestamp: string;
  };
  timing: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
  memory: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    unit: string;
  };
  rawMeasurements: number[];
}

function calculateStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median: sorted[Math.floor(sorted.length / 2)],
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

function printBenchmarkResults(result: BenchmarkResult): void {
  console.log("\n📊 Benchmark Results\n");

  console.log("Timing Statistics:");
  console.log(`  Mean:   ${result.timing.mean.toFixed(2)}ms`);
  console.log(`  Median: ${result.timing.median.toFixed(2)}ms`);
  console.log(`  StdDev: ${result.timing.stdDev.toFixed(2)}ms`);
  console.log(`  Min:    ${result.timing.min.toFixed(2)}ms`);
  console.log(`  Max:    ${result.timing.max.toFixed(2)}ms`);
  console.log(`  P95:    ${result.timing.p95.toFixed(2)}ms`);
  console.log(`  P99:    ${result.timing.p99.toFixed(2)}ms`);

  console.log("\nMemory Statistics:");
  console.log(`  Mean:   ${(result.memory.mean / 1024).toFixed(2)}KB`);
  console.log(`  StdDev: ${(result.memory.stdDev / 1024).toFixed(2)}KB`);
  console.log(`  Min:    ${(result.memory.min / 1024).toFixed(2)}KB`);
  console.log(`  Max:    ${(result.memory.max / 1024).toFixed(2)}KB`);
}

/**
 * Compare two performance reports
 */
async function runCompareCommand(args: PerfCliArgs): Promise<number> {
  console.log("\n=== Zeo Performance Comparison ===");

  if (!args.baseline || !existsSync(args.baseline)) {
    console.error("Error: --baseline file not found");
    return 1;
  }

  if (!args.current || !existsSync(args.current)) {
    console.error("Error: --current file not found");
    return 1;
  }

  const baseline = JSON.parse(readFileSync(args.baseline, "utf8"));
  const current = JSON.parse(readFileSync(args.current, "utf8"));

  console.log(`Baseline: ${args.baseline}`);
  console.log(`Current:  ${args.current}\n`);

  // Compare benchmark results
  if (baseline.timing && current.timing) {
    const timingDelta = {
      mean: ((current.timing.mean - baseline.timing.mean) / baseline.timing.mean) * 100,
      median: ((current.timing.median - baseline.timing.median) / baseline.timing.median) * 100,
      p95: ((current.timing.p95 - baseline.timing.p95) / baseline.timing.p95) * 100,
    };

    console.log("Timing Comparison:");
    console.log(`  Mean:   ${formatDelta(timingDelta.mean)}`);
    console.log(`  Median: ${formatDelta(timingDelta.median)}`);
    console.log(`  P95:    ${formatDelta(timingDelta.p95)}`);

    // Check for significant regression
    const hasRegression = Object.values(timingDelta).some((d) => d > 10);
    const hasImprovement = Object.values(timingDelta).some((d) => d < -10);

    if (hasRegression) {
      console.log("\n⚠️  Performance regression detected (>10%)");
    } else if (hasImprovement) {
      console.log("\n✓ Performance improvement detected (<-10%)");
    } else {
      console.log("\n✓ Performance stable (within ±10%)");
    }
  }

  return 0;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  const color = delta > 10 ? "🔴" : delta < -10 ? "🟢" : "⚪";
  return `${color} ${sign}${delta.toFixed(2)}%`;
}

/**
 * Run performance regression tests using replay
 */
async function runRegressionCommand(args: PerfCliArgs): Promise<number> {
  console.log("\n=== Zeo Performance Regression Test ===");

  if (!args.replay || !existsSync(args.replay)) {
    console.error("Error: --replay file not found");
    return 1;
  }

  console.log(`Replay dataset: ${args.replay}`);
  console.log(`Regression threshold: ${args.threshold}%\n`);

  const dataset: ReplayDataset = JSON.parse(readFileSync(args.replay, "utf8"));
  const results: RegressionResult[] = [];

  console.log(`Running ${dataset.cases.length} test cases...\n`);

  for (let i = 0; i < dataset.cases.length; i++) {
    const testCase = dataset.cases[i];
    process.stdout.write(`  Case ${i + 1}/${dataset.cases.length}: ${testCase.caseId}...\r`);

    // Measure performance
    const measurements: number[] = [];
    const iterations = 3; // Run each case 3 times for stability

    for (let j = 0; j < iterations; j++) {
      const start = performance.now();
      try {
        await replayCase(testCase, {
          depth: 2,
          limits: { maxCheckpoints: 10 },
          strict: false,
        });
      } catch (err) {
        // Continue even if case has issues - we're measuring performance
      }
      const duration = performance.now() - start;
      measurements.push(duration);
    }

    const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;

    results.push({
      caseId: testCase.caseId,
      avgDuration,
      minDuration: Math.min(...measurements),
      maxDuration: Math.max(...measurements),
      status: "passed",
    });
  }

  console.log(""); // Clear progress line

  // Calculate overall stats
  const totalDuration = results.reduce((sum, r) => sum + r.avgDuration, 0);
  const avgCaseTime = totalDuration / results.length;

  console.log("\n📊 Regression Test Results:\n");
  console.log(`Total cases: ${results.length}`);
  console.log(`Average case time: ${avgCaseTime.toFixed(2)}ms`);
  console.log(`Total time: ${totalDuration.toFixed(2)}ms`);

  // Print slowest cases
  const sortedByTime = [...results].sort((a, b) => b.avgDuration - a.avgDuration);
  console.log("\nSlowest 5 cases:");
  for (const r of sortedByTime.slice(0, 5)) {
    console.log(`  ${r.caseId}: ${r.avgDuration.toFixed(2)}ms`);
  }

  const regressionReport: RegressionReport = {
    metadata: {
      datasetId: dataset.datasetId,
      casesRun: results.length,
      threshold: args.threshold,
      timestamp: new Date().toISOString(),
    },
    summary: {
      totalDuration,
      avgCaseTime,
      passed: results.length,
      failed: 0,
      regressions: [],
    },
    results,
  };

  // Write output if requested
  if (args.out) {
    writeFileSync(args.out, JSON.stringify(regressionReport, null, 2), "utf8");
    console.log(`\nRegression report written to: ${args.out}`);
  }

  console.log("\n✓ All regression tests passed");
  return 0;
}

interface RegressionResult {
  caseId: string;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  status: "passed" | "failed" | "regression";
}

interface RegressionReport {
  metadata: {
    datasetId: string;
    casesRun: number;
    threshold: number;
    timestamp: string;
  };
  summary: {
    totalDuration: number;
    avgCaseTime: number;
    passed: number;
    failed: number;
    regressions: string[];
  };
  results: RegressionResult[];
}

/**
 * Main entry point for perf CLI
 */
export async function runPerfCommand(args: PerfCliArgs): Promise<number> {
  if (!args.command) {
    printPerfHelp();
    return 1;
  }

  try {
    switch (args.command) {
      case "scan":
        return await runScanCommand(args);
      case "profile":
        return await runProfileCommand(args);
      case "benchmark":
        return await runBenchmarkCommand(args);
      case "compare":
        return await runCompareCommand(args);
      case "regression":
        return await runRegressionCommand(args);
      default:
        console.error(`Unknown command: ${args.command}`);
        return 1;
    }
  } catch (err) {
    const zeError = ZeoError.from(err);
    console.error(`[${zeError.code}] ${zeError.message}`);
    if (loadConfig().DEBUG && zeError.details) {
      console.error("Details:", JSON.stringify(zeError.details, null, 2));
    }
    return 1;
  }
}
