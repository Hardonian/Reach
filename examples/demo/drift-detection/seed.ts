/**
 * Drift Detection Example - Seed Script
 *
 * Generates synthetic baseline data and drift scenarios for testing.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface BaselineData {
  runs: Array<{
    timestamp: string;
    duration: number;
    outputHash: string;
    success: boolean;
  }>;
  statistics: {
    meanDuration: number;
    stdDevDuration: number;
    successRate: number;
    uniqueOutputs: number;
  };
}

function generateBaselineData(seed: string, count: number): BaselineData {
  // Simple seeded random for reproducibility
  let seedVal = hashString(seed);
  const random = () => {
    seedVal = (seedVal * 9301 + 49297) % 233280;
    return seedVal / 233280;
  };

  const runs = [];
  const baseDuration = 245;
  const stdDev = 15;

  for (let i = 0; i < count; i++) {
    // Normal distribution approximation
    const u1 = random();
    const u2 = random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const duration = Math.round(baseDuration + z * stdDev);

    runs.push({
      timestamp: new Date(Date.now() - (count - i) * 3600000).toISOString(),
      duration: Math.max(100, duration),
      outputHash: `sha256:${generateHash(random)}`,
      success: random() > 0.02, // 98% success rate
    });
  }

  const durations = runs.map((r) => r.duration);
  const meanDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance =
    durations.reduce((sum, d) => sum + Math.pow(d - meanDuration, 2), 0) /
    durations.length;

  return {
    runs,
    statistics: {
      meanDuration: Math.round(meanDuration),
      stdDevDuration: Math.round(Math.sqrt(variance)),
      successRate: runs.filter((r) => r.success).length / runs.length,
      uniqueOutputs: new Set(runs.map((r) => r.outputHash)).size,
    },
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateHash(random: () => number): string {
  const chars = "abcdef0123456789";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(random() * chars.length)];
  }
  return hash;
}

export function seed(): { success: boolean; message: string } {
  console.log("🌱 Seeding drift-detection example...");

  const baselineDir = resolve(__dirname, ".baseline");
  if (!existsSync(baselineDir)) {
    mkdirSync(baselineDir, { recursive: true });
  }

  // Generate normal baseline
  const baselineData = generateBaselineData("drift-demo-seed", 100);
  writeFileSync(
    resolve(baselineDir, "normal-baseline.json"),
    JSON.stringify(baselineData, null, 2),
  );

  // Generate drift scenario
  const driftData = generateBaselineData("drift-scenario-seed", 50);
  // Add drift - longer durations and lower success rate
  driftData.runs.forEach((run, i) => {
    if (i > 25) {
      run.duration = run.duration * 2.5; // 2.5x slower
      run.success = Math.random() > 0.3; // 70% success rate
    }
  });
  writeFileSync(
    resolve(baselineDir, "drift-scenario.json"),
    JSON.stringify(driftData, null, 2),
  );

  console.log("✅ Generated baseline data:");
  console.log(`   Normal runs: ${baselineData.runs.length}`);
  console.log(`   Mean duration: ${baselineData.statistics.meanDuration}ms`);
  console.log(`   Std dev: ${baselineData.statistics.stdDevDuration}ms`);
  console.log(
    `   Success rate: ${(baselineData.statistics.successRate * 100).toFixed(1)}%`,
  );
  console.log(`   Drift scenarios: ${driftData.runs.length}`);

  return { success: true, message: "Baseline data generated successfully" };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = seed();
  process.exit(result.success ? 0 : 1);
}
