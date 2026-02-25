import { describe, it, expect } from "vitest";
import { stableStringify, sha256Hex } from "../../packages/core/src/nl-compiler/deterministic.js";
import {
  computeFingerprintSync,
  verifyRustMatchesTs,
  isWasmAvailable,
  resetWasmModule,
} from "../../packages/core/src/nl-compiler/determinism-bridge.js";
import fs from "node:fs";
import path from "node:path";

interface TestVector {
  name: string;
  input: unknown;
  expected_ts_fingerprint: string;
  expected_rust_fingerprint: string | null;
  notes: string;
}

// Load test vectors synchronously at module load time
const vectorsPath = path.resolve(__dirname, "../../determinism.vectors.json");
const content = fs.readFileSync(vectorsPath, "utf8");
const vectors: TestVector[] = JSON.parse(content);

/**
 * Check if a value contains float numbers
 */
function hasFloatValues(value: unknown): boolean {
  if (typeof value === "number") {
    return !Number.isInteger(value);
  }
  if (Array.isArray(value)) {
    return value.some(hasFloatValues);
  }
  if (value && typeof value === "object") {
    return Object.values(value).some(hasFloatValues);
  }
  return false;
}

describe("Cross-verification: TS and Rust implementations", () => {
  // Reset WASM module before tests
  resetWasmModule();

  it("should verify TypeScript implementation matches golden vectors", () => {
    let passCount = 0;
    let failCount = 0;

    for (const vector of vectors) {
      const fingerprint = computeFingerprintSync(vector.input);

      if (fingerprint === vector.expected_ts_fingerprint) {
        passCount++;
      } else {
        failCount++;
        console.log(`FAIL: ${vector.name}`);
        console.log(`  Expected: ${vector.expected_ts_fingerprint}`);
        console.log(`  Got:      ${fingerprint}`);
      }
    }

    console.log(`\nTypeScript implementation: ${passCount}/${vectors.length} tests passed`);
    expect(failCount).toBe(0);
  });

  it("should verify TypeScript produces consistent results", () => {
    for (const vector of vectors) {
      const fp1 = computeFingerprintSync(vector.input);
      const fp2 = computeFingerprintSync(vector.input);

      expect(fp1).toBe(fp2);
    }
  });

  it("should verify TypeScript handles key order correctly", () => {
    const input1 = { z: 1, a: 2, m: 3 };
    const input2 = { a: 2, m: 3, z: 1 };

    const fp1 = computeFingerprintSync(input1);
    const fp2 = computeFingerprintSync(input2);

    expect(fp1).toBe(fp2);
  });

  it("should verify non-float inputs have consistent canonical form", () => {
    const nonFloatVectors = vectors.filter((v) => !hasFloatValues(v.input));

    for (const vector of nonFloatVectors) {
      const canonical = stableStringify(vector.input);
      const fingerprint = sha256Hex(canonical);

      expect(fingerprint).toBe(vector.expected_ts_fingerprint);
    }

    console.log(`Verified ${nonFloatVectors.length} non-float vectors`);
  });

  it("should report WASM availability status", async () => {
    const available = await isWasmAvailable();

    if (available) {
      console.log("WASM module is available");
    } else {
      console.log("WASM module is not available (Rust toolchain required to build)");
    }

    // The test passes regardless - we just report status
    expect(typeof available).toBe("boolean");
  });

  it("should compare TS vs Rust implementations when WASM is available", async () => {
    const available = await isWasmAvailable();

    if (!available) {
      console.log("Skipping Rust comparison - WASM not available");
      return;
    }

    let matchCount = 0;
    let mismatchCount = 0;
    let errorCount = 0;

    for (const vector of vectors) {
      // Skip float vectors as they may differ between implementations
      if (hasFloatValues(vector.input)) {
        console.log(`Skipping float vector: ${vector.name}`);
        continue;
      }

      const result = await verifyRustMatchesTs(vector.input);

      if (result.match) {
        matchCount++;
      } else if (result.rust.startsWith("Error:")) {
        errorCount++;
        console.log(`Error for ${vector.name}: ${result.rust}`);
      } else {
        mismatchCount++;
        console.log(`Mismatch for ${vector.name}:`);
        console.log(`  TS:   ${result.ts}`);
        console.log(`  Rust: ${result.rust}`);
      }
    }

    console.log(`\nCross-language verification:`);
    console.log(`  Matches:   ${matchCount}`);
    console.log(`  Mismatches: ${mismatchCount}`);
    console.log(`  Errors:    ${errorCount}`);

    // For non-float inputs, we expect perfect matches
    expect(mismatchCount).toBe(0);
  });
});

describe("Golden vector test summary", () => {
  it("provides a summary of all test vectors", () => {
    console.log("\n=== Golden Vector Summary ===\n");

    const floatVectors = vectors.filter((v) => hasFloatValues(v.input));
    const nonFloatVectors = vectors.filter((v) => !hasFloatValues(v.input));

    console.log(`Total vectors: ${vectors.length}`);
    console.log(`Non-float (cross-language compatible): ${nonFloatVectors.length}`);
    console.log(`Float (implementation-specific): ${floatVectors.length}`);

    console.log("\nNon-float vectors (should match across TS and Rust):");
    for (const v of nonFloatVectors) {
      console.log(`  - ${v.name}: ${v.notes}`);
    }

    console.log("\nFloat vectors (may differ due to normalization):");
    for (const v of floatVectors) {
      console.log(`  - ${v.name}: ${v.notes}`);
    }

    expect(vectors.length).toBeGreaterThan(0);
  });
});
