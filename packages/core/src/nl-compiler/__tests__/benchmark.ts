/**
 * Benchmark suite for nl-compiler determinism functions
 *
 * Run with: npm run benchmark
 * Or: node --import tsx/esm src/nl-compiler/__tests__/benchmark.ts
 */

import { stableStringify, sha256Hex } from "../deterministic.js";
import {
  computeFingerprintSync,
  computeFingerprint,
  isWasmAvailable,
  resetWasmModule,
} from "../determinism-bridge.js";

interface BenchmarkResult {
  name: string;
  ops: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

interface BenchmarkOptions {
  iterations?: number;
  warmup?: number;
}

async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  options: BenchmarkOptions = {},
): Promise<BenchmarkResult> {
  const iterations = options.iterations ?? 1000;
  const warmup = options.warmup ?? 100;

  // Warmup
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Actual benchmark
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const ops = 1000 / mean; // Operations per second

  return { name, ops, mean, stdDev, min, max };
}

function formatResult(result: BenchmarkResult): string {
  const opsFormatted = result.ops.toFixed(0).padStart(8);
  const meanFormatted = result.mean.toFixed(3).padStart(8);
  const stdDevFormatted = result.stdDev.toFixed(3).padStart(8);
  const minFormatted = result.min.toFixed(3).padStart(8);
  const maxFormatted = result.max.toFixed(3).padStart(8);

  return `${result.name.padEnd(40)} ${opsFormatted} ops/s  ${meanFormatted}ms ±${stdDevFormatted}ms  [${minFormatted}-${maxFormatted}]`;
}

function generateTestData(size: "small" | "medium" | "large"): unknown {
  switch (size) {
    case "small":
      return { a: 1, b: 2, c: "test" };
    case "medium":
      return {
        orgId: "test-org",
        workspaceId: "test-workspace",
        gates: Array.from({ length: 10 }, (_, i) => ({
          id: `gate-${i}`,
          name: `Gate ${i}`,
          conditions: { value: i * 0.1, enabled: true },
        })),
        thresholds: Array.from({ length: 5 }, (_, i) => ({
          metric: `metric-${i}`,
          operator: ">=",
          value: 0.5 + i * 0.1,
        })),
      };
    case "large":
      return {
        orgId: "test-org",
        workspaceId: "test-workspace",
        metadata: {
          createdAt: new Date().toISOString(),
          version: "1.0.0",
          tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
        },
        gates: Array.from({ length: 100 }, (_, i) => ({
          id: `gate-${i}`,
          name: `Gate ${i}`,
          description: `This is a description for gate ${i} with some extra text`,
          conditions: {
            value: i * 0.01,
            enabled: i % 2 === 0,
            nested: { foo: "bar", count: i },
          },
        })),
        thresholds: Array.from({ length: 50 }, (_, i) => ({
          metric: `metric-${i}`,
          operator: i % 2 === 0 ? ">=" : "<=",
          value: Math.random(),
        })),
      };
  }
}

async function runBenchmarks() {
  console.log("\n=== NL-Compiler Determinism Benchmarks ===\n");
  console.log("Warming up...\n");

  const results: BenchmarkResult[] = [];

  // Small object benchmarks
  const smallData = generateTestData("small");
  results.push(
    await benchmark("stableStringify (small)", () => {
      stableStringify(smallData);
    }),
  );
  results.push(
    await benchmark("computeFingerprintSync (small)", () => {
      computeFingerprintSync(smallData);
    }),
  );

  // Medium object benchmarks
  const mediumData = generateTestData("medium");
  results.push(
    await benchmark("stableStringify (medium)", () => {
      stableStringify(mediumData);
    }),
  );
  results.push(
    await benchmark("computeFingerprintSync (medium)", () => {
      computeFingerprintSync(mediumData);
    }),
  );

  // Large object benchmarks
  const largeData = generateTestData("large");
  results.push(
    await benchmark(
      "stableStringify (large)",
      () => {
        stableStringify(largeData);
      },
      {
        iterations: 100,
      },
    ),
  );
  results.push(
    await benchmark(
      "computeFingerprintSync (large)",
      () => {
        computeFingerprintSync(largeData);
      },
      {
        iterations: 100,
      },
    ),
  );

  // Key ordering benchmark
  const unorderedData = { z: 1, y: 2, x: 3, w: 4, v: 5, u: 6, t: 7, s: 8, r: 9, q: 10 };
  results.push(
    await benchmark("stableStringify (unordered keys)", () => {
      stableStringify(unorderedData);
    }),
  );

  // Nested object benchmark
  const nestedData = {
    level1: {
      level2: {
        level3: {
          level4: {
            level5: { value: "deep" },
          },
        },
      },
    },
  };
  results.push(
    await benchmark("stableStringify (deeply nested)", () => {
      stableStringify(nestedData);
    }),
  );

  // Array benchmark
  const arrayData = Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }));
  results.push(
    await benchmark("stableStringify (array of objects)", () => {
      stableStringify(arrayData);
    }),
  );

  // WASM benchmarks (if available)
  resetWasmModule();
  const wasmAvailable = await isWasmAvailable();

  if (wasmAvailable) {
    console.log("WASM module detected, running WASM benchmarks...\n");
    results.push(
      await benchmark("computeFingerprint (WASM, small)", () => {
        computeFingerprint(smallData);
      }),
    );
    results.push(
      await benchmark("computeFingerprint (WASM, medium)", () => {
        computeFingerprint(mediumData);
      }),
    );
    results.push(
      await benchmark(
        "computeFingerprint (WASM, large)",
        () => {
          computeFingerprint(largeData);
        },
        {
          iterations: 100,
        },
      ),
    );
  } else {
    console.log("WASM module not available (Rust toolchain required)");
    console.log("Run: cd crates/engine-core && wasm-pack build --target nodejs\n");
  }

  // Print results
  console.log("\n=== Results ===\n");
  console.log(`${"Benchmark".padEnd(40)} Ops/s        Mean       StdDev      Range`);
  console.log("-".repeat(90));
  results.forEach((r) => console.log(formatResult(r)));

  // Summary
  console.log("\n=== Summary ===\n");

  const smallSync = results.find((r) => r.name === "computeFingerprintSync (small)");
  const smallWasm = results.find((r) => r.name === "computeFingerprint (WASM, small)");

  if (smallSync && smallWasm) {
    const speedup = smallWasm.ops / smallSync.ops;
    console.log(`WASM speedup (small objects): ${speedup.toFixed(2)}x`);
  }

  const mediumSync = results.find((r) => r.name === "computeFingerprintSync (medium)");
  const mediumWasm = results.find((r) => r.name === "computeFingerprint (WASM, medium)");

  if (mediumSync && mediumWasm) {
    const speedup = mediumWasm.ops / mediumSync.ops;
    console.log(`WASM speedup (medium objects): ${speedup.toFixed(2)}x`);
  }

  const largeSync = results.find((r) => r.name === "computeFingerprintSync (large)");
  const largeWasm = results.find((r) => r.name === "computeFingerprint (WASM, large)");

  if (largeSync && largeWasm) {
    const speedup = largeWasm.ops / largeSync.ops;
    console.log(`WASM speedup (large objects): ${speedup.toFixed(2)}x`);
  }

  console.log("\nBenchmark complete!\n");
}

// Run benchmarks
runBenchmarks().catch(console.error);
