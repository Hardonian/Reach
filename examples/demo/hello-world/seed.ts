/**
 * Hello World Example - Seed Script
 *
 * This script prepares the environment for the hello-world demo.
 * For this simple example, it primarily validates the pack structure.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface SeedResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

function validatePack(): SeedResult {
  const packPath = resolve(__dirname, "pack.json");

  if (!existsSync(packPath)) {
    return {
      success: false,
      message: "Pack manifest not found at expected path",
    };
  }

  try {
    const pack = JSON.parse(readFileSync(packPath, "utf8"));

    // Validate required fields
    const required = ["spec_version", "metadata", "execution_graph"];
    for (const field of required) {
      if (!(field in pack)) {
        return {
          success: false,
          message: `Missing required field: ${field}`,
        };
      }
    }

    // Validate metadata
    if (!pack.metadata.id || !pack.metadata.version) {
      return {
        success: false,
        message: "Pack metadata must include id and version",
      };
    }

    // Validate deterministic flag
    if (pack.deterministic !== true) {
      return {
        success: false,
        message: "Pack must be deterministic for examples",
      };
    }

    return {
      success: true,
      message: "Pack validation passed",
      data: {
        packId: pack.metadata.id,
        version: pack.metadata.version,
        steps: pack.execution_graph.steps.length,
      },
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to parse pack.json: ${(err as Error).message}`,
    };
  }
}

export function seed(): SeedResult {
  console.log("🌱 Seeding hello-world example...");

  const result = validatePack();

  if (result.success) {
    console.log(`✅ ${result.message}`);
    console.log(`   Pack: ${result.data?.packId}@${result.data?.version}`);
    console.log(`   Steps: ${result.data?.steps}`);
  } else {
    console.error(`❌ ${result.message}`);
  }

  return result;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = seed();
  process.exit(result.success ? 0 : 1);
}
