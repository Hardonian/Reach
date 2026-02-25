#!/usr/bin/env node
import { stableStringify, sha256Hex } from "../packages/core/src/nl-compiler/deterministic.js";
import fs from "node:fs";
import path from "node:path";

const vectorsPath = path.join(process.cwd(), "determinism.vectors.json");
const vectors = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));

let allPassed = true;

console.log("=== Determinism Bridge Verification ===");
console.log(`Testing ${vectors.length} test vectors...\n`);

// For now, just test TS implementation (Rust integration will come later)
vectors.forEach((vector: any) => {
  const tsFingerprint = sha256Hex(stableStringify(vector.input));

  if (tsFingerprint === vector.expected_ts_fingerprint) {
    console.log(`✅ ${vector.name}`);
  } else {
    console.log(`❌ ${vector.name}`);
    console.log(`   Expected TS: ${vector.expected_ts_fingerprint}`);
    console.log(`   Actual TS:   ${tsFingerprint}`);
    allPassed = false;
  }
});

console.log("\n=== Summary ===");
if (allPassed) {
  console.log("✅ All TS fingerprints matched expected values");
} else {
  console.log("❌ Some TS fingerprints did not match expected values");
  process.exit(1);
}
