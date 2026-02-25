// @ts-nocheck
/**
 * DEK Replay CLI - Deterministic Execution Kernel Replay
 *
 * Provides zeo replay <run-id> functionality for verifying
 * deterministic execution and detecting drift.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ZeoJournalEntry } from "@zeo/contracts";
import {
  replayExecution,
  getJournalEntry,
  initializeDEK,
} from "@zeo/kernel";

export interface DekReplayArgs {
  runId: string;
  json: boolean;
  strict: boolean;
  suggestModel: boolean;
  reportOut?: string;
}

export function parseDekReplayArgs(argv: string[]): DekReplayArgs | null {
  if (argv.length === 0) {
    return null;
  }

  const args: DekReplayArgs = {
    runId: argv[0],
    json: argv.includes("--json"),
    strict: !argv.includes("--no-strict"),
    suggestModel: argv.includes("--suggest-model"),
  };

  const reportIdx = argv.indexOf("--report-out");
  if (reportIdx !== -1 && argv[reportIdx + 1]) {
    args.reportOut = argv[reportIdx + 1];
  }

  return args;
}

export async function runDekReplayCommand(args: DekReplayArgs): Promise<number> {
  // Initialize DEK
  initializeDEK();

  if (!args.json) {
    console.log(`\n=== Zeo DEK Replay ===`);
    console.log(`Run ID: ${args.runId}`);
    console.log(`Mode: ${args.strict ? "strict" : "permissive"}`);
    console.log(`\nReconstructing execution context...`);
  }

  // Execute replay
  const replayResult = await replayExecution(args.runId, {
    strictModelMatch: args.strict,
  });

  const { status, originalEntry } = replayResult;

  if (!originalEntry) {
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            status: "UNAVAILABLE",
            error: `Run ID ${args.runId} not found in journal`,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`\nError: Run ID ${args.runId} not found in journal.`);
      console.log(`\nTo list available runs:`);
      console.log(`  zeo journal list`);
    }
    return 1;
  }

  // Format output
  if (args.json) {
    const output = formatJsonOutput(replayResult);
    console.log(JSON.stringify(output, null, 2));
  } else {
    printHumanOutput(
      {
        status: replayResult.status,
        originalEntry: replayResult.originalEntry,
        replayResult: replayResult.replayResult,
        comparison: replayResult.comparison,
        modelAvailability: replayResult.modelAvailability || {
          available: true,
        },
      },
      args.suggestModel,
    );
  }

  // Write report if requested
  if (args.reportOut) {
    writeReport(args.reportOut, replayResult);
  }

  // Exit code based on status
  switch (status) {
    case "MATCH":
      return 0;
    case "MISMATCH":
      return 2;
    case "DEGRADED":
      return 3;
    case "UNAVAILABLE":
      return 1;
    default:
      return 1;
  }
}

function formatJsonOutput(result: {
  status: "MATCH" | "MISMATCH" | "DEGRADED" | "UNAVAILABLE";
  originalEntry: ZeoJournalEntry | undefined;
  comparison: {
    originalHash: string;
    replayHash: string;
    match: boolean;
  };
}): unknown {
  if (!result.originalEntry) {
    return {
      status: result.status,
      error: "Original entry not found",
    };
  }

  return {
    status: result.status,
    original: {
      runId: result.originalEntry.envelope.runId,
      workflowId: result.originalEntry.envelope.workflowId,
      timestamp: result.originalEntry.envelope.timestamp,
      outputHash: result.originalEntry.outputHash,
      modelSpec: result.originalEntry.envelope.modelSpec,
      durationMs: result.originalEntry.durationMs,
      status: result.originalEntry.status,
    },
    comparison: result.comparison,
    timestamp: new Date().toISOString(),
  };
}

function printHumanOutput(
  result: {
    status: "MATCH" | "MISMATCH" | "DEGRADED" | "UNAVAILABLE";
    originalEntry: ZeoJournalEntry | undefined;
    replayResult: {
      outputHash: string;
      durationMs: number;
    };
    comparison: {
      originalHash: string;
      replayHash: string;
      match: boolean;
    };
    modelAvailability: {
      available: boolean;
      suggestedModel?: string;
    };
  },
  showSuggestions: boolean,
): void {
  if (!result.originalEntry) return;

  const envelope = result.originalEntry.envelope;

  console.log(`\nOriginal Execution:`);
  console.log(`  Run ID: ${envelope.runId}`);
  console.log(`  Workflow: ${envelope.workflowId}`);
  console.log(`  Timestamp: ${envelope.timestamp}`);
  console.log(`  Model: ${envelope.modelSpec.provider}/${envelope.modelSpec.model}`);
  console.log(`  Duration: ${result.originalEntry.durationMs}ms`);

  console.log(`\nReplay Comparison:`);
  console.log(`  Original Hash: ${result.comparison.originalHash.slice(0, 16)}...`);
  console.log(
    `  Replay Hash: ${
      result.comparison.replayHash === "reconstruction_required"
        ? "N/A (reconstruction required)"
        : result.comparison.replayHash.slice(0, 16) + "..."
    }`,
  );

  console.log(`\nStatus: ${result.status}`);

  switch (result.status) {
    case "MATCH":
      console.log(`  ✅ Execution is deterministic - outputs match exactly`);
      break;
    case "MISMATCH":
      console.log(`  ❌ Drift detected - outputs differ`);
      console.log(`  \nThis indicates:`);
      console.log(`  - Non-deterministic model behavior`);
      console.log(`  - External dependency changes`);
      console.log(`  - Policy or configuration drift`);
      break;
    case "DEGRADED":
      console.log(`  ⚠️  Replay degraded - input reconstruction required`);
      console.log(`  \nThe original input snapshot needs to be restored for full replay.`);
      break;
    case "UNAVAILABLE":
      console.log(`  ❌ Model unavailable for replay`);
      if (showSuggestions && result.modelAvailability.suggestedModel) {
        console.log(`  \nSuggested compatible model: ${result.modelAvailability.suggestedModel}`);
      }
      break;
  }

  console.log(`\nDeterminism Check:`);
  console.log(`  Input Hash: ${envelope.inputHash.slice(0, 16)}...`);
  console.log(`  Model Spec Hash: ${envelope.modelSpecHash.slice(0, 16)}...`);
  console.log(`  Policy Hash: ${envelope.policyHash.slice(0, 16)}...`);
  console.log(`  Seed: ${envelope.deterministicSeed.slice(0, 16)}...`);
}

function writeReport(
  outDir: string,
  result: {
    status: "MATCH" | "MISMATCH" | "DEGRADED" | "UNAVAILABLE";
    originalEntry: ZeoJournalEntry | undefined;
    comparison: {
      originalHash: string;
      replayHash: string;
      match: boolean;
    };
  },
): void {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const reportPath = join(outDir, `replay-report-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(formatJsonOutput(result), null, 2));
  console.log(`\nReport written to: ${reportPath}`);
}

/** List available runs in journal */
export async function listJournalRuns(limit: number = 20): Promise<void> {
  const { readJournalEntries } = await import("@zeo/kernel");
  const entries = readJournalEntries().slice(-limit);

  console.log(`\n=== Recent Journal Entries ===`);
  console.log(`Showing last ${entries.length} runs:\n`);

  for (const entry of entries.reverse()) {
    const e = entry.envelope;
    const status = entry.status === "success" ? "✓" : entry.status === "error" ? "✗" : "◐";
    console.log(`${status} ${e.runId}`);
    console.log(`   Workflow: ${e.workflowId}`);
    console.log(`   Time: ${e.timestamp}`);
    console.log(`   Model: ${e.modelSpec.provider}/${e.modelSpec.model}`);
    console.log(`   Hash: ${entry.outputHash.slice(0, 16)}...`);
    console.log();
  }
}

/** Export for integration with main CLI */
export { replayExecution, getJournalEntry };
