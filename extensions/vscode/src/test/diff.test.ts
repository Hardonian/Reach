import { describe, expect, it } from "vitest";
import { applyPatchToText, parseUnifiedDiff } from "../diffCore";

describe("diff parser and applier", () => {
  it("applies unified diff to text", () => {
    const original = ["one", "two", "three"].join("\n");
    const diff = [
      "--- a/file.txt",
      "+++ b/file.txt",
      "@@ -1,3 +1,3 @@",
      " one",
      "-two",
      "+TWO",
      " three",
    ].join("\n");

    const [patch] = parseUnifiedDiff(diff);
    const updated = applyPatchToText(original, patch);

    expect(updated).toBe(["one", "TWO", "three"].join("\n"));
  });
});
