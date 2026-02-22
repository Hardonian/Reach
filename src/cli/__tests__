import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { __private__ } from "./analyze-pr-cli.js";

const cases = [
  ["analyze-pr-auth", ["security"]],
  ["analyze-pr-migration", ["data-integrity"]],
  ["analyze-pr-performance", ["performance", "test-impact"]],
] as const;

describe("analyze-pr example fixtures", () => {
  for (const [name, categories] of cases) {
    it(`matches expected categories for ${name}`, () => {
      const diff = readFileSync(resolve(process.cwd(), "..", "..", "examples", name, "diff.patch"), "utf8");
      const files = __private__.parseModifiedFiles(diff);
      const hunks = __private__.parseHunks(diff);
      const findings = __private__.analyze(diff, files, hunks);
      const actual = [...new Set(findings.map((f) => f.category))].sort();
      expect(actual).toEqual([...categories].sort());
    });
  }
});
