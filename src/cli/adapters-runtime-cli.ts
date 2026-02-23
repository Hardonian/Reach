// @ts-nocheck
/**
 * CLI commands for adapter runtime
 * zeo adapters run --adapter <id> --range <start:end> --out <dir>
 * zeo ingest --range <start:end> --out <dataset.json>
 */

import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve, join } from "path";
import { ErrorCodes, type ErrorCode } from "../core/errors.js";
import {
  createAdapterRuntime,
  runAdapter,
  ingestData,
  createQuarantineStore,
} from "@zeo/adapters-runtime";
import { createRealityAdapterRegistry } from "@zeo/adapters";

export interface AdaptersRuntimeCliArgs {
  command: "run" | "ingest" | "quarantine" | null;
  adapterId?: string;
  range?: { start: string; end: string };
  out?: string;
  format: "json" | "csv";
  quarantineDir?: string;
  approvedOnly: boolean;
}

export function parseAdaptersRuntimeArgs(argv: string[]): AdaptersRuntimeCliArgs {
  const result: AdaptersRuntimeCliArgs = {
    command: null,
    format: "json",
    approvedOnly: false,
  };

  // Check for subcommand
  if (argv[0] === "run") {
    result.command = "run";
    argv = argv.slice(1);
  } else if (argv[0] === "ingest") {
    result.command = "ingest";
    argv = argv.slice(1);
  } else if (argv[0] === "quarantine") {
    result.command = "quarantine";
    argv = argv.slice(1);
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--adapter" && next) {
      result.adapterId = next;
      i++;
    } else if (arg === "--range" && next) {
      const [start, end] = next.split(":");
      if (start && end) {
        result.range = { start, end };
      }
      i++;
    } else if (arg === "--out" && next) {
      result.out = next;
      i++;
    } else if (arg === "--format" && next) {
      if (next === "csv" || next === "json") {
        result.format = next;
      }
      i++;
    } else if (arg === "--quarantine-dir" && next) {
      result.quarantineDir = next;
      i++;
    } else if (arg === "--approved-only") {
      result.approvedOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      printAdaptersRuntimeHelp();
      process.exit(ErrorCodes.SUCCESS);
    }
  }

  return result;
}

function printAdaptersRuntimeHelp(): void {
  console.log(`
Zeo Adapter Runtime CLI - Safe data ingestion with poisoning defense

Usage: zeo adapters <command> [options]

Commands:
  run <id>                    Run a specific adapter
  ingest                      Ingest from all enabled adapters
  quarantine                  List/manage quarantined observations

Options for run/ingest:
  --adapter <id>              Adapter ID (required for run)
  --range <start:end>         Date range (ISO format)
  --out <path>                Output file/directory
  --format <json|csv>         Output format (default: json)
  --quarantine-dir <dir>      Quarantine storage directory
  --approved-only             Only output approved observations

Examples:
  zeo adapters run market --range 2024-01-01:2024-01-31 --out ./data
  zeo ingest --range 2024-01-01:2024-01-31 --out ./dataset.json
  zeo adapters quarantine --quarantine-dir ./quarantine
`);
}

export async function runAdaptersRuntimeCommand(args: AdaptersRuntimeCliArgs): Promise<ErrorCode> {
  if (!args.command) {
    console.error("Error: No command specified");
    printAdaptersRuntimeHelp();
    return ErrorCodes.INVALID_INPUT;
  }

  try {
    switch (args.command) {
      case "run":
        return await runAdapterCommand(args);
      case "ingest":
        return await runIngestCommand(args);
      case "quarantine":
        return await runQuarantineCommand(args);
      default:
        console.error(`Error: Unknown command: ${args.command}`);
        return ErrorCodes.INVALID_INPUT;
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    return ErrorCodes.GENERIC_FAILURE;
  }
}

async function runAdapterCommand(args: AdaptersRuntimeCliArgs): Promise<ErrorCode> {
  if (!args.adapterId) {
    console.error("Error: --adapter is required for run command");
    return ErrorCodes.INVALID_INPUT;
  }

  if (!args.range) {
    console.error("Error: --range is required (format: start:end)");
    return ErrorCodes.INVALID_INPUT;
  }

  console.log(`Running adapter: ${args.adapterId}`);
  console.log(`Range: ${args.range.start} to ${args.range.end}`);

  // Get adapter from registry
  const registry = createRealityAdapterRegistry();
  const adapter = registry.get(args.adapterId);

  if (!adapter) {
    console.error(`Error: Adapter not found: ${args.adapterId}`);
    console.log("Available adapters:");
    const adapters = registry.list();
    for (const info of adapters) {
      console.log(`  - ${info.id}: ${info.name}`);
    }
    return ErrorCodes.NOT_FOUND;
  }

  // Create runtime
  const runtime = createAdapterRuntime(
    undefined,
    args.quarantineDir ? { quarantineDir: args.quarantineDir } : undefined,
  );

  // Run adapter
  const result = await runtime.runAdapter(adapter, {
    startISO: args.range.start,
    endISO: args.range.end,
  });

  console.log(`\nFetched: ${result.metrics.fetched}`);
  console.log(`Normalized: ${result.metrics.normalized}`);
  console.log(`Passed integrity: ${result.metrics.passedIntegrity}`);
  console.log(`Passed anomaly: ${result.metrics.passedAnomaly}`);
  console.log(`Quarantined: ${result.metrics.quarantined}`);
  console.log(`Latency: ${result.metrics.fetchLatencyMs}ms`);

  if (result.quarantined.length > 0) {
    console.log("\nQuarantined observations:");
    for (const q of result.quarantined) {
      console.log(`  - ${q.observation.observationId}: ${q.reason} (${q.severity})`);
    }
  }

  // Write output
  if (args.out) {
    const outPath = resolve(process.cwd(), args.out);

    if (args.format === "json") {
      const output = {
        adapterId: result.adapterId,
        metrics: result.metrics,
        observations: args.approvedOnly
          ? result.observations
          : [...result.observations, ...result.quarantined.map((q) => q.observation)],
        quarantined: result.quarantined,
        batch: result.batch,
      };

      await writeFile(outPath, JSON.stringify(output, null, 2));
    }

    console.log(`\nOutput written to: ${outPath}`);
  }

  return ErrorCodes.SUCCESS;
}

async function runIngestCommand(args: AdaptersRuntimeCliArgs): Promise<ErrorCode> {
  if (!args.range) {
    console.error("Error: --range is required (format: start:end)");
    return ErrorCodes.INVALID_INPUT;
  }

  console.log(`Ingesting data from all enabled adapters`);
  console.log(`Range: ${args.range.start} to ${args.range.end}`);

  // Get all enabled adapters
  const registry = createRealityAdapterRegistry();
  const adapters = registry.getEnabled();

  if (adapters.length === 0) {
    console.error("Error: No enabled adapters found");
    return ErrorCodes.NOT_FOUND;
  }

  console.log(`Found ${adapters.length} enabled adapters`);

  // Create runtime
  const runtime = createAdapterRuntime(
    undefined,
    args.quarantineDir ? { quarantineDir: args.quarantineDir } : undefined,
  );

  // Run ingest
  const result = await runtime.ingest(adapters, {
    range: args.range,
    outDir: args.out,
  });

  console.log(`\n=== Ingest Summary ===`);
  console.log(`Total observations: ${result.summary.totalObservations}`);
  console.log(`Total batches: ${result.summary.totalBatches}`);
  console.log(`Quarantined: ${result.summary.quarantinedCount}`);
  console.log(`Adapters: ${result.summary.adapterCount}`);

  if (result.quarantined.length > 0) {
    console.log("\nQuarantined observations by severity:");
    const bySeverity = new Map<string, number>();
    for (const q of result.quarantined) {
      bySeverity.set(q.severity, (bySeverity.get(q.severity) ?? 0) + 1);
    }
    for (const [severity, count] of bySeverity) {
      console.log(`  ${severity}: ${count}`);
    }
  }

  if (args.out) {
    console.log(`\nDataset written to: ${args.out}/dataset.json`);
  }

  return ErrorCodes.SUCCESS;
}

async function runQuarantineCommand(args: AdaptersRuntimeCliArgs): Promise<ErrorCode> {
  const store = createQuarantineStore({ retentionHours: 168 });

  console.log("=== Quarantine Status ===\n");

  // List pending
  const pending = await store.list({ status: "pending" });
  console.log(`Pending: ${pending.length}`);

  // List approved
  const approved = await store.list({ status: "approved" });
  console.log(`Approved: ${approved.length}`);

  // List rejected
  const rejected = await store.list({ status: "rejected" });
  console.log(`Rejected: ${rejected.length}`);

  if (pending.length > 0) {
    console.log("\nPending quarantine entries:");
    for (const entry of pending.slice(0, 10)) {
      console.log(`  ${entry.id}: ${entry.reason} (${entry.severity})`);
      console.log(`    Adapter: ${entry.metadata.adapterId}`);
      console.log(`    Observation: ${entry.observation.observationId}`);
    }
    if (pending.length > 10) {
      console.log(`  ... and ${pending.length - 10} more`);
    }
  }

  // Cleanup expired
  const cleaned = await store.cleanupExpired();
  if (cleaned > 0) {
    console.log(`\nCleaned up ${cleaned} expired entries`);
  }

  return ErrorCodes.SUCCESS;
}
