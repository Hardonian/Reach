// @ts-nocheck
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

export async function runBenchmarkCommand(): Promise<number> {
  console.log("\n=== Zeo Performance Benchmark ===");

  // Cold start
  const coldStart = performance.now();
  spawnSync('node', ['dist/index.js', '--version']);
  const coldEnd = performance.now();
  const coldDuration = coldEnd - coldStart;

  // Warm start (simulated by repeated execution in same process if possible, but CLI is often fresh)
  // For CLI, "warm" usually means cache hits or persistent process.
  // We'll simulate by running twice and taking the second.
  spawnSync('node', ['dist/index.js', '--version']); // warm up
  const warmStart = performance.now();
  spawnSync('node', ['dist/index.js', '--version']);
  const warmEnd = performance.now();
  const warmDuration = warmEnd - warmStart;

  console.log(`Cold Start: ${coldDuration.toFixed(2)}ms`);
  console.log(`Warm Start: ${warmDuration.toFixed(2)}ms`);

  // Inference Latency
  const core = await import("@zeo/core");
  const spec = core.makeNegotiationExample();
  const infStart = performance.now();
  core.runDecision(spec);
  const infEnd = performance.now();
  console.log(`Inference Latency: ${(infEnd - infStart).toFixed(2)}ms`);

  return 0;
}

