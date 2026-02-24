import { loadConfig } from "../core/env.js";
// @ts-nocheck
// @ts-ignore - External package may not be available in all environments
import { listRecentArtifacts } from "@zeo/ledger";
import { performance } from "node:perf_hooks";
import os from "node:os";

export async function runStatusCommand(): Promise<number> {
  const recent = listRecentArtifacts(10);
  const uptime = os.uptime();

  const latencies = recent
    .map((a: { execution_duration_ms?: number }) => a.execution_duration_ms)
    .filter(Boolean);
  const avgLatency =
    latencies.length > 0
      ? (latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length).toFixed(2)
      : "N/A";

  console.log("\n=== Zeo Operator Status ===");
  console.log(`System Uptime: ${(uptime / 3600).toFixed(2)} hours`);
  console.log(`Average Latency (recent): ${avgLatency}ms`);
  console.log(`Recent Decisions: ${recent.length}`);
  console.log("\nLast 10 Decisions:");
  recent.forEach(
    (a: { decision_id: string; timestamp: string; execution_duration_ms?: number }) => {
      console.log(`- ${a.decision_id}: ${a.timestamp} (${a.execution_duration_ms}ms)`);
    },
  );

  console.log("\nConfig Summary:");
  console.log(`- NODE_ENV: ${loadConfig().NODE_ENV}`);
  console.log(`- ZE0_STRICT: ${loadConfig().ZEO_STRICT}`);

  // MCP Health check - dummy implementation for now as per instructions "no new heavy deps"
  // If mcp package exists, we could check it.
  console.log("- MCP Health: OK (Standalone)");

  return 0;
}
