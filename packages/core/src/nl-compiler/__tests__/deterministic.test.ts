import { describe, it, expect } from "vitest";
import { stableStringify, sha256Hex } from "../deterministic.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TestVector {
  name: string;
  input: unknown;
  expected_ts_fingerprint: string;
  expected_rust_fingerprint: string | null;
  notes: string;
}

// Load test vectors synchronously at module load time
const vectorsPath = path.resolve(__dirname, "../../../../../determinism.vectors.json");
const content = fs.readFileSync(vectorsPath, "utf8");
const vectors: TestVector[] = JSON.parse(content);

describe("deterministic.ts - Golden Vectors", () => {
  it("should read and parse test vectors", () => {
    expect(Array.isArray(vectors)).toBeTruthy();
    expect(vectors.length).toBeGreaterThan(0);
  });

  vectors.forEach((vector) => {
    it(`should compute correct fingerprint for vector: ${vector.name}`, () => {
      const canonical = stableStringify(vector.input);
      const fingerprint = sha256Hex(canonical);

      expect(fingerprint).toEqual(vector.expected_ts_fingerprint);
    });
  });
});
