// @ts-nocheck
import { writeFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { FilesystemWarehouseAdapter, FilesystemBlobStorage } from "@zeo/warehouse";
import {
  buildDataset,
  datasetToCsv,
  runCorrelation,
  runRegression,
  generateReport,
} from "@zeo/analytics";
import type { WarehouseKind, ExportOptions, WarehouseEnvelope } from "@zeo/contracts";

const WAREHOUSE_DIR = ".zeo/warehouse";
const METADATA_DIR = ".zeo/metadata";
const RETENTION_CONFIG_FILE = "retention.json";
const PINNED_FILE = "pinned.json";

interface RetentionConfig {
  defaultRetentionDays: number;
  perKindRetention: Record<string, number>;
  lastUpdated: string;
}

interface PinnedRecords {
  pinnedIds: string[];
  lastUpdated: string;
}

interface WarehouseCliArgs {
  command: "export" | "import" | "list" | "prune" | "pin" | "unpin" | "retention" | null;
  out?: string;
  input?: string;
  kinds?: WarehouseKind[];
  tags?: string[];
  dryRun?: boolean;
  retentionDays?: number;
  pin?: boolean;
  id?: string;
}

interface AnalyticsCliArgs {
  command: "build-dataset" | "run" | null;
  datasetPath?: string;
  outDir?: string;
  targetCol?: string;
  featureCols?: string[];
}

// Retention policy helper functions
async function getRetentionConfig(cwd: string): Promise<RetentionConfig> {
  const configPath = resolve(cwd, METADATA_DIR, RETENTION_CONFIG_FILE);

  try {
    const data = readFileSync(configPath, "utf8");
    return JSON.parse(data);
  } catch {
    // Default config
    return {
      defaultRetentionDays: 90,
      perKindRetention: {
        decision: 90,
        outcome: 180,
        "decision-draft": 30,
        "evidence-event": 180,
        "signal-observation": 90,
        "observation-batch": 90,
        "run-result": 60,
        "outcome-record": 180,
        "calibration-report": 365,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function saveRetentionConfig(cwd: string, config: RetentionConfig): Promise<void> {
  const configPath = resolve(cwd, METADATA_DIR, RETENTION_CONFIG_FILE);
  const configDir = resolve(cwd, METADATA_DIR);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

async function getPinnedRecords(cwd: string): Promise<PinnedRecords> {
  const pinnedPath = resolve(cwd, METADATA_DIR, PINNED_FILE);

  try {
    const data = readFileSync(pinnedPath, "utf8");
    const parsed = JSON.parse(data);
    return {
      pinnedIds: parsed.pinnedIds || [],
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch {
    return {
      pinnedIds: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function savePinnedRecords(cwd: string, pinned: PinnedRecords): Promise<void> {
  const pinnedPath = resolve(cwd, METADATA_DIR, PINNED_FILE);
  const metadataDir = resolve(cwd, METADATA_DIR);

  if (!existsSync(metadataDir)) {
    mkdirSync(metadataDir, { recursive: true });
  }

  writeFileSync(pinnedPath, JSON.stringify(pinned, null, 2), "utf8");
}

function isExpired(
  envelope: WarehouseEnvelope<unknown>,
  retentionDays: number,
  pinnedIds: string[],
): boolean {
  // Never expire pinned records
  if (pinnedIds.includes(envelope.id)) {
    return false;
  }

  // Never expire if no retention days specified
  if (!retentionDays || retentionDays <= 0) {
    return false;
  }

  const createdAt = new Date(envelope.createdAt);
  const now = new Date();
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return ageDays > retentionDays;
}

export function parseWarehouseArgs(argv: string[]): WarehouseCliArgs {
  const result: WarehouseCliArgs = {
    command: null,
    id: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "export") {
      result.command = "export";
    } else if (arg === "import") {
      result.command = "import";
    } else if (arg === "list") {
      result.command = "list";
    } else if (arg === "prune") {
      result.command = "prune";
    } else if (arg === "pin") {
      result.command = "pin";
    } else if (arg === "unpin") {
      result.command = "unpin";
    } else if (arg === "retention") {
      result.command = "retention";
    } else if (arg === "--out" && next) {
      result.out = next;
      i++;
    } else if (arg === "--in" && next) {
      result.input = next;
      i++;
    } else if (arg === "--kinds" && next) {
      result.kinds = next.split(",") as WarehouseKind[];
      i++;
    } else if (arg === "--tags" && next) {
      result.tags = next.split(",");
      i++;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--retention-days" && next) {
      result.retentionDays = parseInt(next, 10);
      i++;
    } else if (arg === "--pin") {
      result.pin = true;
    } else if (arg === "--id" && next) {
      result.id = next;
      i++;
    }
  }

  return result;
}

export function parseAnalyticsArgs(argv: string[]): AnalyticsCliArgs {
  const result: AnalyticsCliArgs = {
    command: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "build-dataset") {
      result.command = "build-dataset";
    } else if (arg === "run") {
      result.command = "run";
    } else if (arg === "--out" && next) {
      result.outDir = next;
      i++;
    } else if (arg === "--dataset" && next) {
      result.datasetPath = next;
      i++;
    } else if (arg === "--target" && next) {
      result.targetCol = next;
      i++;
    } else if (arg === "--features" && next) {
      result.featureCols = next.split(",");
      i++;
    }
  }

  return result;
}

export async function runWarehouseCommand(args: WarehouseCliArgs): Promise<number> {
  const warehouse = new FilesystemWarehouseAdapter();

  if (!args.command) {
    console.log(`
 Zeo Warehouse CLI

 Usage: zeo --warehouse <command> [options]

 Commands:
   export              Export records to bundle
   import              Import records from bundle
   list                List records in warehouse
   prune               Remove old/expired records (respects pinned items)
   pin                 Pin a record to prevent pruning
   unpin               Unpin a record
   retention           View or set retention policies

 Options:
   --out <path>        Output file path (for export)
   --in <path>         Input file path (for import)
   --kinds <list>       Comma-separated list of record kinds
   --tags <list>       Comma-separated list of tags to filter
   --dry-run           Show what would be pruned without actually pruning
   --retention-days    Set default retention period (days)
   --id <record-id>    Record ID for pin/unpin commands

 Examples:
   zeo --warehouse export --out ./backup.json --kinds decision,outcome
   zeo --warehouse import --in ./backup.json
   zeo --warehouse list --tags important
   zeo --warehouse prune --dry-run --kinds decision --retention-days 30
   zeo --warehouse pin --id <record-id>
   zeo --warehouse unpin --id <record-id>
   zeo --warehouse retention --retention-days 30
   zeo --warehouse retention
 `);
    return 0;
  }

  switch (args.command) {
    case "export": {
      if (!args.out) {
        console.error("Error: --out is required for export");
        return 1;
      }

      const options: ExportOptions = {
        kinds: args.kinds,
        tags: args.tags,
      };

      console.log("Exporting warehouse records...");
      const bundle = await warehouse.exportBundle(options);

      const outPath = resolve(args.out);
      writeFileSync(outPath, JSON.stringify(bundle, null, 2), "utf8");

      console.log(`Exported ${bundle.recordCount} records to ${args.out}`);
      return 0;
    }

    case "import": {
      if (!args.input) {
        console.error("Error: --in is required for import");
        return 1;
      }

      const inputPath = resolve(args.input);
      if (!existsSync(inputPath)) {
        console.error(`Error: File not found: ${args.input}`);
        return 1;
      }

      console.log("Importing warehouse records...");
      const bundle = JSON.parse(readFileSync(inputPath, "utf8"));

      const result = await warehouse.importBundle(bundle, {
        type: "prefer-newer",
        sameHashAction: "skip",
      });

      console.log(`Import complete:`);
      console.log(`  Imported: ${result.imported}`);
      console.log(`  Skipped (same hash): ${result.skipped}`);
      console.log(`  Conflicts: ${result.conflicts}`);
      return 0;
    }

    case "list": {
      const result = await warehouse.list({
        kinds: args.kinds,
        tags: args.tags,
        limit: 100,
      });

      console.log(`Found ${result.items.length} records:\n`);
      for (const item of result.items) {
        console.log(`  ${item.id} [${item.kind}]`);
        console.log(`    Created: ${item.createdAt}`);
        console.log(`    Hash: ${item.hashes.contentHash.slice(0, 16)}...`);
        if (item.tags && item.tags.length > 0) {
          console.log(`    Tags: ${item.tags.join(", ")}`);
        }
        console.log();
      }
      return 0;
    }

    case "prune": {
      const retentionConfig = await getRetentionConfig(process.cwd());
      const pinned = await getPinnedRecords(process.cwd());
      const now = new Date();

      // Get all records
      const allRecords = await warehouse.list({
        kinds: args.kinds,
        tags: args.tags,
        includeDeleted: false,
      });

      const expiredRecords: Array<{
        id: string;
        kind: WarehouseKind;
        ageDays: number;
        reason: string;
      }> = [];

      for (const record of allRecords.items) {
        const retentionDays =
          retentionConfig.perKindRetention[record.kind] || retentionConfig.defaultRetentionDays;

        if (isExpired(record, retentionDays, pinned.pinnedIds)) {
          const createdAt = new Date(record.createdAt);
          const ageMs = now.getTime() - createdAt.getTime();
          const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

          expiredRecords.push({
            id: record.id,
            kind: record.kind,
            ageDays,
            reason: `Older than ${retentionDays} days (${record.kind} retention)`,
          });
        }
      }

      if (expiredRecords.length === 0) {
        console.log("No expired records found matching criteria.");
        console.log(`\nRetention settings used:`);
        console.log(`  Default: ${retentionConfig.defaultRetentionDays} days`);
        console.log(`  Pinned records: ${pinned.pinnedIds.length}`);
        return 0;
      }

      console.log(`Found ${expiredRecords.length} expired record(s):\n`);

      for (const record of expiredRecords) {
        console.log(`  ${record.id} [${record.kind}]`);
        console.log(`    Age: ${record.ageDays} days - ${record.reason}`);
      }

      if (args.dryRun) {
        console.log(`\n[Dry run] Would prune ${expiredRecords.length} record(s)`);
        console.log("No changes made.");
        return 0;
      }

      let pruned = 0;
      for (const record of expiredRecords) {
        try {
          await warehouse.delete(record.kind, record.id);
          pruned++;
          console.log(`  Pruned: ${record.id}`);
        } catch (err) {
          console.error(
            `  Failed to prune ${record.id}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      console.log(`\nPruned ${pruned}/${expiredRecords.length} records`);
      return 0;
    }

    case "pin": {
      if (!args.id) {
        console.error("Error: --id is required for pin command");
        return 1;
      }

      // Check if record exists
      const allRecords = await warehouse.list({ limit: 1000 });
      const record = allRecords.items.find((r) => r.id === args.id);

      if (!record) {
        console.error(`Error: Record not found: ${args.id}`);
        return 1;
      }

      const pinned = await getPinnedRecords(process.cwd());

      if (pinned.pinnedIds.includes(args.id!)) {
        console.log(`Record ${args.id} is already pinned`);
        return 0;
      }

      pinned.pinnedIds.push(args.id!);
      pinned.lastUpdated = new Date().toISOString();
      await savePinnedRecords(process.cwd(), pinned);

      console.log(`Pinned record: ${args.id} [${record.kind}]`);
      console.log(`Total pinned: ${pinned.pinnedIds.length}`);
      return 0;
    }

    case "unpin": {
      if (!args.id) {
        console.error("Error: --id is required for unpin command");
        return 1;
      }

      const pinned = await getPinnedRecords(process.cwd());

      if (!pinned.pinnedIds.includes(args.id!)) {
        console.log(`Record ${args.id} is not pinned`);
        return 0;
      }

      pinned.pinnedIds = pinned.pinnedIds.filter((id) => id !== args.id);
      pinned.lastUpdated = new Date().toISOString();
      await savePinnedRecords(process.cwd(), pinned);

      console.log(`Unpinned record: ${args.id}`);
      console.log(`Total pinned: ${pinned.pinnedIds.length}`);
      return 0;
    }

    case "retention": {
      if (args.retentionDays !== undefined) {
        const retentionDays = Math.max(1, args.retentionDays);
        const config = await getRetentionConfig(process.cwd());
        config.defaultRetentionDays = retentionDays;
        config.lastUpdated = new Date().toISOString();
        await saveRetentionConfig(process.cwd(), config);

        console.log(`Set default retention period to ${retentionDays} days`);
        console.log("\nRetention by record kind:");
        for (const [kind, days] of Object.entries(config.perKindRetention)) {
          console.log(`  ${kind}: ${days} days`);
        }
        return 0;
      }

      const config = await getRetentionConfig(process.cwd());
      const pinned = await getPinnedRecords(process.cwd());

      console.log("Retention Policy Settings:");
      console.log(`  Default retention: ${config.defaultRetentionDays} days`);
      console.log(`  Pinned records: ${pinned.pinnedIds.length} (never expire)`);
      console.log("\nRetention by record kind:");
      for (const [kind, days] of Object.entries(config.perKindRetention)) {
        console.log(`  ${kind}: ${days} days`);
      }

      if (pinned.pinnedIds.length > 0) {
        console.log("\nPinned records:");
        for (const id of pinned.pinnedIds) {
          console.log(`  ${id}`);
        }
      }

      return 0;
    }

    default:
      console.error(`Unknown command: ${args.command}`);
      return 1;
  }
}

export async function runAnalyticsCommand(args: AnalyticsCliArgs): Promise<number> {
  if (!args.command) {
    console.log(`
Zeo Analytics CLI

Usage: zeo --analytics <command> [options]

Commands:
  build-dataset       Build feature dataset from warehouse
  run                 Run correlation and regression analysis

Options:
  --out <dir>         Output directory
  --dataset <path>    Path to dataset CSV (for run command)
  --target <col>      Target column name (for regression)
  --features <list>   Comma-separated feature columns (for regression)

Examples:
  zeo --analytics build-dataset --out ./analysis
  zeo --analytics run --dataset ./analysis/dataset.csv --out ./analysis --target outcome --features feature1,feature2
`);
    return 0;
  }

  switch (args.command) {
    case "build-dataset": {
      if (!args.outDir) {
        console.error("Error: --out is required");
        return 1;
      }

      const warehouse = new FilesystemWarehouseAdapter();
      console.log("Building dataset from warehouse...");

      const dataset = await buildDataset(warehouse, {
        includeDecisions: true,
        includeOutcomes: true,
        includeRuns: true,
      });

      const outPath = resolve(args.outDir);
      if (!existsSync(outPath)) {
        mkdirSync(outPath, { recursive: true });
      }

      // Write CSV
      const csv = datasetToCsv(dataset);
      const csvPath = join(outPath, "dataset.csv");
      writeFileSync(csvPath, csv, "utf8");

      // Write schema
      const schemaPath = join(outPath, "dataset_schema.json");
      writeFileSync(schemaPath, JSON.stringify(dataset.schema, null, 2), "utf8");

      console.log(`Dataset written to ${outPath}:`);
      console.log(`  - ${csvPath} (${dataset.rows.length} rows)`);
      console.log(`  - ${schemaPath}`);
      console.log(`\nDataset hash: ${dataset.schema.provenance.datasetHash}`);

      return 0;
    }

    case "run": {
      if (!args.datasetPath) {
        console.error("Error: --dataset is required");
        return 1;
      }

      if (!args.outDir) {
        console.error("Error: --out is required");
        return 1;
      }

      const datasetPath = resolve(args.datasetPath);
      if (!existsSync(datasetPath)) {
        console.error(`Error: Dataset not found: ${args.datasetPath}`);
        return 1;
      }

      const outPath = resolve(args.outDir);
      if (!existsSync(outPath)) {
        mkdirSync(outPath, { recursive: true });
      }

      console.log("Running analytics pipeline...");
      console.log(
        "Note: Python backend required (numpy, pandas, scipy, scikit-learn, statsmodels)",
      );
      console.log();

      // Run correlation
      console.log("Computing correlations...");
      const correlationsPath = join(outPath, "correlations.json");
      try {
        const correlations = await runCorrelation(datasetPath, correlationsPath, {
          includeRobust: true,
        });
        console.log(`  Correlations saved to ${correlationsPath}`);
        console.log(`  Variables analyzed: ${correlations?.variables.join(", ")}`);
      } catch (err) {
        console.error("  Correlation failed:", err instanceof Error ? err.message : err);
        console.error(
          "  Ensure Python dependencies are installed: pip install -r packages/analytics/python/requirements.txt",
        );
      }

      // Run regression if target specified
      if (args.targetCol && args.featureCols && args.featureCols.length > 0) {
        console.log("\nRunning regression...");
        const regressionsPath = join(outPath, "regressions.json");
        try {
          const regressions = await runRegression(datasetPath, regressionsPath, {
            targetCol: args.targetCol,
            featureCols: args.featureCols,
          });
          console.log(`  Regressions saved to ${regressionsPath}`);
          console.log(`  Target: ${regressions?.target}`);
          console.log(`  Features: ${regressions?.features.join(", ")}`);

          if (regressions?.epistemic_label) {
            console.log(`\n  Epistemic Label: ${regressions.epistemic_label}`);
            console.log(`  Note: ${regressions.epistemic_note}`);
          }
        } catch (err) {
          console.error("  Regression failed:", err instanceof Error ? err.message : err);
        }
      }

      // Generate report
      console.log("\nGenerating report...");
      try {
        const correlationsData = existsSync(correlationsPath)
          ? JSON.parse(readFileSync(correlationsPath, "utf8"))
          : undefined;
        const regressionsData = existsSync(join(outPath, "regressions.json"))
          ? JSON.parse(readFileSync(join(outPath, "regressions.json"), "utf8"))
          : undefined;

        const datasetHash = "unknown";
        const report = await generateReport(correlationsData, regressionsData, datasetHash);

        const reportPath = join(outPath, "analytics_report.md");
        writeFileSync(reportPath, report, "utf8");
        console.log(`  Report saved to ${reportPath}`);
      } catch (err) {
        console.error("  Report generation failed:", err instanceof Error ? err.message : err);
      }

      console.log("\nAnalytics complete.");
      return 0;
    }

    default:
      console.error(`Unknown command: ${args.command}`);
      return 1;
  }
}
