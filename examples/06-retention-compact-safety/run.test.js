const { execSync } = require("child_process");
const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");

const EXAMPLE_DIR = __dirname;

describe("06-retention-compact-safety", () => {
  test("has required files", () => {
    expect(existsSync(resolve(EXAMPLE_DIR, "README.md"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "run.js"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "retention-policy.json"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "mock-database.json"))).toBe(true);
  });

  test("retention-policy.json has tiers", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "retention-policy.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("tiers");
    expect(Array.isArray(parsed.tiers)).toBe(true);
    expect(parsed.tiers.length).toBeGreaterThanOrEqual(2);
  });

  test("retention policy has compaction rules", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "retention-policy.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("compaction_rules");
    expect(parsed.compaction_rules).toHaveProperty("preserve_fingerprints");
    expect(parsed.compaction_rules.preserve_fingerprints).toBe(true);
  });

  test("mock-database.json has runs", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "mock-database.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("runs");
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(parsed.runs.length).toBeGreaterThan(0);
  });

  test("mock runs have tier assignments", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "mock-database.json"), "utf8");
    const parsed = JSON.parse(content);

    for (const run of parsed.runs) {
      expect(run).toHaveProperty("tier");
      expect(["hot", "warm", "cold", "archive"]).toContain(run.tier);
    }
  });

  test("run.js shows retention workflow", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result).toContain("Retention Compact Safety");
    expect(result).toContain("Phase 1: Retention Status");
    expect(result).toContain("Phase 2: Policy Check");
    expect(result).toContain("Phase 3: Compaction");
    expect(result).toContain("Phase 4: Integrity Check");
  });

  test("compaction preserves fingerprints", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result).toContain("Fingerprints preserved");
    expect(result).toContain("✅ YES");
  });

  test("storage savings calculated", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result).toContain("Before:");
    expect(result).toContain("After:");
    expect(result).toContain("Saved:");
  });
});
