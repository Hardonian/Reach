// @ts-nocheck
/**
 * Zeo Regimes CLI
 *
 * Commands for:
 * - Detecting regime changes in time series data
 * - Querying current regime state
 * - Listing regime history
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  detectRegimes,
  type NumericPoint,
  type DetectorConfig,
} from "@zeo/regimes";
import type {
  ObservationBatch,
  RegimeEvent,
  RegimeState,
  RegimeDomain,
  RegimeKind,
} from "@zeo/contracts";

export interface RegimesCliArgs {
  detect: string | undefined;
  dataset: string | undefined;
  domain: string | undefined;
  signalId: string | undefined;
  out: string | undefined;
  history: string | undefined;
  current: string | undefined;
}

export function parseRegimesArgs(argv: string[]): RegimesCliArgs {
  const result: RegimesCliArgs = {
    detect: undefined,
    dataset: undefined,
    domain: "market",
    signalId: undefined,
    out: undefined,
    history: undefined,
    current: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg: string = argv[i]!;
    const next: string | undefined = argv[i + 1];

    if ((arg === "--detect" || arg === "detect") && next) {
      result.detect = next;
      i++;
    } else if ((arg === "--dataset" || arg === "-d") && next) {
      result.dataset = next;
      i++;
    } else if ((arg === "--domain" || arg === "--dom") && next) {
      result.domain = next;
      i++;
    } else if ((arg === "--signal-id" || arg === "--signal") && next) {
      result.signalId = next;
      i++;
    } else if ((arg === "--out" || arg === "-o") && next) {
      result.out = next;
      i++;
    } else if ((arg === "--history" || arg === "history") && next) {
      result.history = next;
      i++;
    } else if ((arg === "--current" || arg === "current") && next) {
      result.current = next;
      i++;
    }
  }

  return result;
}

export async function runRegimesCommand(args: RegimesCliArgs): Promise<number> {
  if (args.detect) {
    return await runDetectCommand(
      args.detect,
      args.dataset,
      args.domain,
      args.signalId,
      args.out,
    );
  }

  if (args.history) {
    return runHistoryCommand(args.history);
  }

  if (args.current) {
    return runCurrentCommand(args.current);
  }

  printRegimesHelp();
  return 0;
}

async function runDetectCommand(
  datasetPath: string,
  dataset: string | undefined,
  domain: string | undefined,
  signalId: string | undefined,
  outDir: string | undefined,
): Promise<number> {
  console.log("\n=== Zeo Regime Detection ===\n");

  let observations: ObservationBatch["items"] = [];

  if (datasetPath.endsWith(".json")) {
    try {
      const rawContent = readFileSync(resolve(datasetPath), "utf8");
      const payload = JSON.parse(rawContent);

      if (Array.isArray(payload)) {
        observations = payload;
      } else if (payload.items) {
        observations = payload.items;
      } else if (payload.observations) {
        observations = payload.observations;
      } else if (payload.batch?.items) {
        observations = payload.batch.items;
      } else {
        console.error("Error: Could not parse observation items from JSON");
        return 1;
      }

      console.log(
        `Loaded ${observations.length} observations from ${datasetPath}`,
      );
    } catch (err) {
      console.error(
        `Error reading dataset: ${err instanceof Error ? err.message : err}`,
      );
      return 1;
    }
  } else {
    console.error("Error: Dataset must be a JSON file");
    return 1;
  }

  if (observations.length < 10) {
    console.error("Error: Need at least 10 observations for regime detection");
    return 1;
  }

  // Convert observations to numeric points for regime detection
  const numericPoints = observations.map((obs) => ({
    t: obs.t,
    v: (obs.valueBand.low + obs.valueBand.high) / 2,
  }));

  const eventTimes = observations.map((obs) => obs.t);

  const config: DetectorConfig = {
    minWindowSize: 5,
    maxWindowSize: Math.min(50, Math.floor(observations.length / 3)),
    significanceThreshold: 0.95,
    minConfidence: 0.7,
  };

  console.log(`\nDetector config:`);
  console.log(`  Min window: ${config.minWindowSize}`);
  console.log(`  Max window: ${config.maxWindowSize}`);
  console.log(`  Significance: ${config.significanceThreshold}`);
  console.log(`  Min confidence: ${config.minConfidence}`);

  console.log("\nRunning regime detection...");

  const results = detectRegimes(
    (domain ?? "market") as RegimeDomain,
    numericPoints,
    eventTimes.length > 0 ? eventTimes : undefined,
    signalId ? [signalId] : [],
    config,
  );

  console.log(`\nDetected ${results.events.length} regime events`);
  const currentState = results.states[results.states.length - 1];
  console.log(
    `Current state: ${currentState ? `${currentState.currentLabel} (${currentState.domain})` : "unknown"}`,
  );

  if (currentState) {
    console.log(`\nCurrent regime parameters:`);
    for (const [key, value] of Object.entries(currentState.parameters)) {
      console.log(
        `  ${key}: ${typeof value === "number" ? value.toFixed(4) : value}`,
      );
    }
  }

  console.log("\n--- Regime Events ---");
  for (let i = 0; i < results.events.length; i++) {
    const event = results.events[i];
    console.log(
      `${i + 1}. [${event.kind}] ${event.domain}: ${event.kind === "mean_shift" ? "mean_shift" : event.kind} at ${event.window?.end ?? "unknown"}`,
    );
    console.log(
      `   Confidence: ${(event.confidenceBand.low * 100).toFixed(0)}%-${(event.confidenceBand.high * 100).toFixed(0)}%`,
    );
    console.log(
      `   Severity: ${event.severityBand.low.toFixed(2)}-${event.severityBand.high.toFixed(2)}`,
    );
  }

  const output = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    detectorConfig: config,
    currentState,
    events: results.events,
    summary: {
      totalEvents: results.events.length,
      stablePeriods: results.events.filter(
        (e: RegimeEvent) => e.kind === "mean_shift",
      ).length,
      shifts: results.events.filter(
        (e: RegimeEvent) => e.kind === "distribution_shift",
      ).length,
      volatilityEvents: results.events.filter(
        (e: RegimeEvent) => e.kind === "volatility_break",
      ).length,
    },
  };

  if (outDir) {
    const outputPath = resolve(outDir, "regime-detection.json");
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }
    writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
    console.log(`\nResults written to: ${outputPath}`);
  } else {
    console.log("\n--- Full Output JSON ---\n");
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  }

  return 0;
}

function runHistoryCommand(signalId: string): number {
  console.log(`\n=== Regime History: ${signalId} ===\n`);
  console.log("Note: Full history requires warehouse integration.\n");

  const mockHistory: Array<RegimeEvent> = [
    {
      id: "evt1",
      kind: "distribution_shift",
      domain: "market",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      signalIds: [signalId],
      window: {
        start: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
      severityBand: { low: 0.6, high: 0.85 },
      confidenceBand: { low: 0.75, high: 0.92 },
      evidence: { observationHashes: [], provenance: [] },
      notes: ["Distribution shift detected"],
    },
    {
      id: "evt2",
      kind: "mean_shift",
      domain: "market",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      signalIds: [signalId],
      window: {
        start: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      },
      severityBand: { low: 0.1, high: 0.3 },
      confidenceBand: { low: 0.85, high: 0.98 },
      evidence: { observationHashes: [], provenance: [] },
      notes: ["Mean shift detected"],
    },
  ];

  console.log("Recent events:");
  for (const event of mockHistory) {
    console.log(
      `  - [${event.kind}] ${event.domain}: ${event.kind} (${(event.confidenceBand.low * 100).toFixed(0)}%-${(event.confidenceBand.high * 100).toFixed(0)}% confidence)`,
    );
  }

  return 0;
}

function runCurrentCommand(signalId: string): number {
  console.log(`\n=== Current Regime: ${signalId} ===\n`);

  console.log("Note: Full current state requires warehouse integration.\n");

  console.log(`Signal: ${signalId}`);
  console.log("Current State: stable");
  console.log("Last Updated: not available (local mode)");
  console.log("Parameters: not available (local mode)");

  return 0;
}

export function printRegimesHelp(): void {
  console.log(`
Zeo Regimes CLI - Regime Detection and Monitoring v0.3.5

Usage: zeo --regimes <command> [options]

Commands:
  detect <file>           Run regime detection on observation dataset
  --history <signalId>    Show regime history for a signal
  --current <signalId>    Show current regime state

Options:
  -d, --dataset <file>   Input dataset file (JSON with observations)
      --domain <domain>   Domain filter: market, macro, news, user (default: market)
      --signal-id <id>    Signal ID to associate with detections
  -o, --out <dir>         Output directory for results

Examples:
  zeo --regimes detect ./observations.json --domain market --out ./results
  zeo --regimes --history VIX --domain market
  zeo --regimes --current SPY

Detector Options:
  Min observations required: 10
  Supported detection: CUSUM, Volatility Breaks, Distribution Shifts, Cadence Changes
`);
}
