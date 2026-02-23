// @ts-nocheck
/**
 * Reality CLI Module
 *
 * CLI commands for:
 * - Managing reality adapters (list, enable, disable)
 * - Building datasets from adapters
 * - Running nightly replay pipelines
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  createRealityAdapterRegistry,
  getDefaultCatalogEntries,
  getDefaultSourceDescriptors,
  type Adapter,
  type AdapterInfo,
} from "@zeo/adapters";
import {
  createDatasetBuilder,
  validateDataset,
  filterDatasetByTime,
  type ReplayDataset,
} from "@zeo/dataset-builder";

export interface RealityCliArgs {
  reality: string | undefined;
  adapters: boolean | undefined;
  adapter: string | undefined;
  enable: string | undefined;
  disable: string | undefined;
  buildDataset: string | undefined;
  range: string | undefined;
  out: string | undefined;
  replay: string | undefined;
  nightly: boolean | undefined;
  parallel: number | undefined;
}

export function parseRealityArgs(argv: string[]): RealityCliArgs {
  const result: RealityCliArgs = {
    reality: undefined,
    adapters: false,
    adapter: undefined,
    enable: undefined,
    disable: undefined,
    buildDataset: undefined,
    range: undefined,
    out: undefined,
    replay: undefined,
    nightly: false,
    parallel: 4,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if ((arg === "--reality" || arg === "reality") && next) {
      result.reality = next;
      i++;
    } else if (arg === "--adapters") {
      result.adapters = true;
    } else if ((arg === "--adapter" || arg === "-a") && next) {
      result.adapter = next;
      i++;
    } else if ((arg === "--enable" || arg === "-e") && next) {
      result.enable = next;
      i++;
    } else if ((arg === "--disable" || arg === "-d") && next) {
      result.disable = next;
      i++;
    } else if ((arg === "--build-dataset" || arg === "build") && next) {
      result.buildDataset = next;
      i++;
    } else if ((arg === "--range" || arg === "-r") && next) {
      result.range = next;
      i++;
    } else if ((arg === "--out" || arg === "-o") && next) {
      result.out = next;
      i++;
    } else if ((arg === "--replay" || arg === "replay") && next) {
      result.replay = next;
      i++;
    } else if (arg === "--nightly") {
      result.nightly = true;
    } else if ((arg === "--parallel" || arg === "-p") && next) {
      const n = parseInt(next, 10);
      if (n >= 1 && n <= 16) result.parallel = n;
      i++;
    }
  }

  return result;
}

export async function runRealityCommand(args: RealityCliArgs): Promise<number> {
  if (args.adapters) {
    return runAdaptersList();
  }

  if (args.adapter) {
    return runAdapterInfo(args.adapter);
  }

  if (args.enable) {
    return runAdapterEnable(args.enable, true);
  }

  if (args.disable) {
    return runAdapterEnable(args.disable, false);
  }

  if (args.buildDataset) {
    return await runBuildDataset(args.buildDataset, args.range, args.out);
  }

  if (args.replay) {
    return await runReplayPipeline(args.replay);
  }

  if (args.nightly) {
    return await runNightlyPipeline(args.out, args.parallel);
  }

  printRealityHelp();
  return 0;
}

function runAdaptersList(): number {
  console.log("\n=== Zeo Reality Adapters ===\n");

  const registry = createRealityAdapterRegistry();
  const adapters = registry.list();

  if (adapters.length === 0) {
    console.log("No adapters found.");
    return 0;
  }

  console.log("| Adapter ID | Domain | Status | Cadence |");
  console.log("|------------|--------|--------|---------|");

  for (const adapter of adapters) {
    const status = adapter.enabled ? "Enabled" : "Disabled";
    const cadence = adapter.metadata?.cadence ?? "N/A";

    console.log(
      `| ${adapter.id} | ${adapter.domain} | ${status} | ${cadence} |`,
    );
  }

  console.log(
    "\nUse --adapter <id> for details, --enable/--disable to toggle.",
  );
  return 0;
}

function runAdapterInfo(adapterId: string): number {
  console.log(`\n=== Adapter: ${adapterId} ===\n`);

  const registry = createRealityAdapterRegistry();
  const adapter = registry.get(adapterId);

  if (!adapter) {
    console.error(`Error: Adapter "${adapterId}" not found`);
    return 1;
  }

  const info = adapter.info;
  console.log(`ID: ${info.id}`);
  console.log(`Name: ${info.name}`);
  console.log(`Domain: ${info.domain}`);
  console.log(`Version: ${info.version}`);
  console.log(`Status: ${info.enabled ? "Enabled" : "Disabled"}`);
  console.log(`Cadence: ${info.metadata?.cadence ?? "default"}`);
  console.log(`Reliability Band: ${info.metadata?.reliabilityBand ?? "N/A"}`);

  if (info.metadata?.licenseNotes) {
    console.log(`License Notes: ${info.metadata.licenseNotes}`);
  }

  return 0;
}

function runAdapterEnable(adapterId: string, enabled: boolean): number {
  const registry = createRealityAdapterRegistry();

  if (enabled) {
    const result = registry.enable(adapterId);
    if (result) {
      console.log(`Adapter "${adapterId}" enabled.`);
    } else {
      console.error(`Error: Could not enable adapter "${adapterId}"`);
      return 1;
    }
  } else {
    const result = registry.disable(adapterId);
    if (result) {
      console.log(`Adapter "${adapterId}" disabled.`);
    } else {
      console.error(`Error: Could not disable adapter "${adapterId}"`);
      return 1;
    }
  }

  return 0;
}

async function runBuildDataset(
  source: string,
  range: string | undefined,
  outDir: string | undefined,
): Promise<number> {
  console.log("\n=== Zeo Dataset Builder ===\n");
  console.log(`Source: ${source}`);
  console.log(`Range: ${range ?? "default (last 30 days)"}`);

  let dateRange: { start: string; end: string } | undefined;
  if (range) {
    const parts = range.split(":");
    if (parts.length === 2) {
      dateRange = { start: parts[0], end: parts[1] };
    } else {
      console.error("Error: Range must be format 'start:end' (ISO dates)");
      return 1;
    }
  } else {
    const endDate = new Date().toISOString();
    const startDate = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    dateRange = { start: startDate, end: endDate };
  }

  const builder = createDatasetBuilder();

  console.log("\nBuilding dataset from adapters...");
  console.log(`Time range: ${dateRange.start} to ${dateRange.end}`);

  const registry = createRealityAdapterRegistry();
  const enabledAdapters = registry.getEnabled();
  console.log(
    `Enabled adapters: ${enabledAdapters.map((a: Adapter) => a.info.id).join(", ")}`,
  );

  const dataset = await builder.buildDataset({
    adapterIds: enabledAdapters.map((a: Adapter) => a.info.id),
    timeRange: dateRange,
  });

  const validation = validateDataset(dataset);

  if (!validation.valid) {
    console.error("\nValidation errors:");
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }

  console.log("\nDataset built successfully:");
  console.log(`  ID: ${dataset.id}`);
  console.log(`  Created: ${dataset.createdAt}`);
  console.log(
    `  Time Range: ${dataset.timeRange.start} to ${dataset.timeRange.end}`,
  );
  console.log(`  Observations: ${dataset.observations.length}`);
  console.log(`  Batches: ${dataset.batches.length}`);
  console.log(`  Catalog Hash: ${dataset.catalogHash.slice(0, 16)}...`);
  console.log(`  Sources Hash: ${dataset.sourcesHash.slice(0, 16)}...`);

  if (outDir) {
    const outputPath = resolve(outDir, `${dataset.id}.json`);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    writeFileSync(outputPath, JSON.stringify(dataset, null, 2), "utf8");
    console.log(`\nDataset written to: ${outputPath}`);
  } else {
    console.log("\n--- Dataset JSON ---");
    process.stdout.write(JSON.stringify(dataset, null, 2) + "\n");
  }

  return 0;
}

export async function runReplayPipeline(datasetPath: string): Promise<number> {
  console.log(`\n=== Zeo Replay Pipeline ===\n`);
  console.log(`Dataset: ${datasetPath}`);

  console.log(
    "\nNote: Replay pipeline requires ReplayDataset format from contracts.",
  );
  console.log("This is different from the dataset builder output.");
  console.log("To run replay, use: zeo --replay <dataset.json>");

  return 0;
}

export async function runNightlyPipeline(
  outDir: string | undefined,
  parallel: number,
): Promise<number> {
  console.log("\n=== Zeo Nightly Pipeline ===\n");
  console.log("This runs the full reality data pipeline:");
  console.log("  1. Fetch latest data from all enabled adapters");
  console.log("  2. Build dataset with observations");
  console.log("  3. Generate catalog/source entries");
  console.log("  4. Output dataset JSON");
  console.log("");

  const endDate = new Date().toISOString();
  const startDate = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  console.log("Building dataset...");
  const builder = createDatasetBuilder();
  const registry = createRealityAdapterRegistry();
  const enabledAdapters = registry.getEnabled();

  const dataset = await builder.buildDataset({
    adapterIds: enabledAdapters.map((a: Adapter) => a.info.id),
    timeRange: { start: startDate, end: endDate },
  });

  const validation = validateDataset(dataset);
  if (!validation.valid) {
    console.error("Dataset validation failed:");
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }

  console.log(`\nDataset: ${dataset.id}`);
  console.log(`Observations: ${dataset.observations.length}`);
  console.log(`Batches: ${dataset.batches.length}`);

  const outputDir = outDir ?? "./output/nightly";
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const datasetPath = join(outputDir, `${dataset.id}.json`);
  writeFileSync(datasetPath, JSON.stringify(dataset, null, 2), "utf8");
  console.log(`\nDataset: ${datasetPath}`);

  console.log("\nNightly pipeline complete.");
  console.log("\nTo run replay calibration:");
  console.log(`  zeo --replay ${datasetPath}`);

  return 0;
}

function printRealityHelp(): void {
  console.log(`
Zeo Reality CLI - Data Adapter and Dataset Management v0.3.4

Usage: zeo --reality <command> [options]

Commands:
  --adapters              List all configured reality adapters
  --adapter <id>          Show details for a specific adapter
  --enable <id>           Enable an adapter
  --disable <id>         Disable an adapter
  build                   Build a dataset from all enabled adapters
  replay <dataset>       Run replay pipeline on a dataset
  --nightly               Run full nightly pipeline

Options:
  -a, --adapter <id>     Specify adapter ID
  -e, --enable <id>      Enable an adapter
  -d, --disable <id>     Disable an adapter
  -r, --range <start:end> Date range (ISO dates)
  -o, --out <dir>         Output directory
  -p, --parallel <n>     Parallel workers (1-16, default: 4)

Examples:
  zeo --reality --adapters
  zeo --reality --adapter fred-macro
  zeo --reality build --range 2024-01-01:2024-12-31 --out ./data
  zeo --reality --nightly --out ./output
`);
}
