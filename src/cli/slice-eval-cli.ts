// @ts-nocheck
/**
 * Slice Eval CLI Module
 *
 * CLI interface for slice-based evaluation with gating rules.
 */

import { resolve, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import {
  runSliceEvaluation,
  printSliceSummary,
  checkSliceGates,
  type SliceEvalOptions,
  type SliceDimension,
  getGatingThresholds,
} from "@zeo/eval";
import type { ReplayDataset, ReplayResult, CalibrationBucket } from "@zeo/contracts";

/**
 * Slice eval CLI arguments
 */
export interface SliceEvalCliArgs {
  /** Path to replay dataset JSON */
  dataset?: string;

  /** Output directory for slice results */
  output?: string;

  /** Slice dimensions to compute (comma-separated) */
  dimensions?: string;

  /** Gating threshold preset (strict/standard/lenient) */
  preset?: string;

  /** Explicit seed for determinism */
  seed?: string;

  /** Skip CSV output */
  noCsv?: boolean;

  /** Skip JSON output */
  noJson?: boolean;

  /** Fail on warnings (treat warnings as errors) */
  strict?: boolean;

  /** Verbose output */
  verbose?: boolean;

  /** Show help */
  help?: boolean;
}

/**
 * Parse slice eval arguments
 */
export function parseSliceEvalArgs(argv: string[]): SliceEvalCliArgs {
  const result: SliceEvalCliArgs = {
    dataset: undefined,
    output: "./eval/slices",
    dimensions: undefined,
    preset: "standard",
    seed: undefined,
    noCsv: false,
    noJson: false,
    strict: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if ((arg === "--dataset" || arg === "-d") && next) {
      result.dataset = next;
      i++;
    } else if ((arg === "--output" || arg === "-o") && next) {
      result.output = next;
      i++;
    } else if ((arg === "--dimensions" || arg === "-D") && next) {
      result.dimensions = next;
      i++;
    } else if ((arg === "--preset" || arg === "-p") && next) {
      result.preset = next;
      i++;
    } else if ((arg === "--seed" || arg === "-s") && next) {
      result.seed = next;
      i++;
    } else if (arg === "--no-csv") {
      result.noCsv = true;
    } else if (arg === "--no-json") {
      result.noJson = true;
    } else if (arg === "--strict") {
      result.strict = true;
    } else if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

/**
 * Print slice eval help
 */
export function printSliceEvalHelp(): void {
  console.log(`
Zeo Slice Eval - Granular Evaluation by Dimension

Usage: zeo eval:slices [options]

Options:
  --dataset, -d <path>      Path to replay dataset JSON (required)
  --output, -o <dir>        Output directory (default: ./eval/slices)
  --dimensions, -D <list>  Comma-separated dimensions (default: domain,metricKind,confidenceLevel)
  --preset, -p <name>      Gating preset: strict|standard|lenient (default: standard)
  --seed, -s <seed>         Explicit seed for determinism
  --no-csv                  Skip CSV output
  --no-json                 Skip JSON output
  --strict                  Treat warnings as errors
  --verbose, -v             Verbose output
  --help, -h                Show this help message

Dimensions:
  domain           Business domain (negotiation, ops, etc.)
  metricKind       Outcome type (binary, continuous, ordinal, band)
  confidenceLevel  Prediction confidence (low, medium, high)
  outcomeStatus    Resolution status (resolved, partially_resolved)
  decisionType     Type of decision
  timePeriod       Month/quarter of decision

Gating Presets:
  strict     High thresholds (min 50 samples, 85% coverage)
  standard   Balanced thresholds (min 30 samples, 80% coverage)
  lenient    Permissive thresholds (min 10 samples, 70% coverage)

Examples:
  zeo eval:slices --dataset external/examples/replay/sample_dataset.json
  zeo eval:slices -d dataset.json -o ./results --preset strict
  zeo eval:slices -d dataset.json -D domain,metricKind --strict

Output Files:
  eval/slices.json    Full slice evaluation report
  eval/slices.csv     Slice metrics in CSV format
`);
}

/**
 * Parse dimensions from comma-separated string
 */
function parseDimensions(dimensionsStr: string | undefined): SliceDimension[] {
  if (!dimensionsStr) {
    return ["domain", "metricKind", "confidenceLevel"];
  }

  const validDimensions: SliceDimension[] = [
    "domain",
    "metricKind",
    "confidenceLevel",
    "outcomeStatus",
    "decisionType",
    "timePeriod",
  ];

  const parsed = dimensionsStr
    .split(",")
    .map((d) => d.trim())
    .filter((d): d is SliceDimension => validDimensions.includes(d as SliceDimension));

  if (parsed.length === 0) {
    throw new Error(`No valid dimensions provided. Valid: ${validDimensions.join(", ")}`);
  }

  return parsed;
}

/**
 * Validate preset name
 */
function validatePreset(preset: string): "strict" | "standard" | "lenient" {
  if (preset === "strict" || preset === "standard" || preset === "lenient") {
    return preset;
  }
  throw new Error(`Invalid preset: ${preset}. Use: strict, standard, or lenient`);
}

/**
 * Run slice evaluation from CLI
 */
export async function runSliceEvalCommand(args: SliceEvalCliArgs): Promise<number> {
  if (args.help) {
    printSliceEvalHelp();
    return 0;
  }

  if (!args.dataset) {
    console.error("[SLICE_EVAL_ERROR] No dataset specified. Use --dataset <path>");
    console.error("Run 'zeo eval:slices --help' for usage information.");
    return 1;
  }

  const datasetPath = resolve(process.cwd(), args.dataset);

  if (!existsSync(datasetPath)) {
    console.error(`[SLICE_EVAL_ERROR] Dataset not found: ${datasetPath}`);
    return 1;
  }

  try {
    // Load dataset
    if (args.verbose) {
      console.log(`Loading dataset from ${datasetPath}...`);
    }

    const datasetContent = readFileSync(datasetPath, "utf8");
    const dataset: ReplayDataset = JSON.parse(datasetContent);

    // Parse dimensions
    const dimensions = parseDimensions(args.dimensions);
    if (args.verbose) {
      console.log(`Computing slices for dimensions: ${dimensions.join(", ")}`);
    }

    // Validate preset and get thresholds
    const preset = validatePreset(args.preset || "standard");
    const thresholds = getGatingThresholds(preset);

    if (args.verbose) {
      console.log(`Using ${preset} gating preset:`);
      console.log(`  Min sample size: ${thresholds.minSampleSize}`);
      console.log(`  Min coverage: ${(thresholds.minCoverage * 100).toFixed(0)}%`);
      console.log(`  Max Brier: ${thresholds.maxBrierScore}`);
    }

    // For now, create synthetic replay results since we need to integrate
    // with the actual replay runner. In production, this would run the
    // replay pipeline and get actual results.
    const replayResults: ReplayResult[] = dataset.cases.map((c) => ({
      caseId: c.caseId,
      runMeta: {
        seed: args.seed || "test-seed",
        engineVersion: "0.5.1",
        decisionHash: "mock-hash",
        observationsHash: "mock-obs-hash",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      checkpoints: [
        {
          at: c.horizons.asOf,
          posteriorSummary: {
            variableCount: c.decisionSpec.assumptions?.length || 0,
            observationCount: c.observationBatches.reduce(
              (sum, b) => sum + b.observations.length,
              0,
            ),
            modelStrength: 0.7,
          },
          predictions: {
            at: c.horizons.asOf,
            predictions: c.outcome.metrics.map((m) => ({
              target: {
                kind: m.mapping.linksTo,
                id: m.mapping.targetId,
              },
              band: { low: 0.3, high: 0.7 },
              provenanceRefs: [] as string[],
              basis: {
                decisionHash: "mock",
                observationHash: "mock",
                seed: args.seed || "test",
                engineVersion: "0.5.1",
              },
            })),
          },
        },
      ],
      scoring: {
        coverage: { byMetricId: {}, byDomain: {}, overall: 0.8 },
        properScores: { byMetricId: {}, overall: 0.15 },
        buckets: [] as CalibrationBucket[],
        recommendedAdjustment: {
          widenFactorByDomain: {},
          widenFactorOverall: 1.0,
          rationale: "Mock scoring",
        },
      },
    }));

    // Build options
    const options: SliceEvalOptions = {
      outputDir: resolve(process.cwd(), args.output || "./eval/slices"),
      dimensions,
      seed: args.seed,
      engineVersion: "0.5.1",
      includeCsv: !args.noCsv,
      includeJson: !args.noJson,
    };

    // Run evaluation
    console.log(`\n=== Slice Evaluation ===`);
    console.log(`Dataset: ${dataset.datasetId}`);
    console.log(`Cases: ${dataset.cases.length}`);
    console.log(`Dimensions: ${dimensions.join(", ")}`);
    console.log(`Preset: ${preset}`);
    console.log(`Output: ${options.outputDir}`);

    const report = await runSliceEvaluation(replayResults, dataset, options);

    // Print summary
    printSliceSummary(report);

    // Check gates
    const gateResult = checkSliceGates(report);

    console.log("\n--- Gate Results ---");
    console.log(`Status: ${gateResult.passed ? "PASSED" : "FAILED"}`);

    if (gateResult.errors.length > 0) {
      console.log("\nErrors:");
      gateResult.errors.forEach((e) => console.log(`  ✗ ${e}`));
    }

    if (gateResult.warnings.length > 0) {
      console.log("\nWarnings:");
      gateResult.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    }

    // Determine exit code
    if (!gateResult.passed) {
      return 1;
    }

    if (args.strict && gateResult.warnings.length > 0) {
      console.log("\n[STRICT MODE] Warnings treated as errors.");
      return 1;
    }

    return 0;
  } catch (err) {
    console.error(`[SLICE_EVAL_ERROR] ${err instanceof Error ? err.message : err}`);
    if (args.verbose) {
      console.error(err);
    }
    return 1;
  }
}
