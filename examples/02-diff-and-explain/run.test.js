const { execSync } = require("child_process");
const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");

const EXAMPLE_DIR = __dirname;

describe("02-diff-and-explain", () => {
  test("has required files", () => {
    expect(existsSync(resolve(EXAMPLE_DIR, "README.md"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "run.js"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "seed-v1.json"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "seed-v2.json"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "pack.json"))).toBe(true);
  });

  test("seed files have different values", () => {
    const v1 = JSON.parse(readFileSync(resolve(EXAMPLE_DIR, "seed-v1.json"), "utf8"));
    const v2 = JSON.parse(readFileSync(resolve(EXAMPLE_DIR, "seed-v2.json"), "utf8"));

    expect(v1.priority).not.toBe(v2.priority);
    expect(v1.input.metrics.cpu_utilization).not.toBe(v2.input.metrics.cpu_utilization);
    expect(v1.input.alerts.length).toBeLessThan(v2.input.alerts.length);
  });

  test("run.js shows diff analysis", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result).toContain("Diff and Explain");
    expect(result).toContain("Baseline");
    expect(result).toContain("Modified");
    expect(result).toContain("Fields changed");
  });

  test("expected-diff.json is valid", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "expected-diff.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("fields_changed");
    expect(Array.isArray(parsed.fields_changed)).toBe(true);
    expect(parsed.fields_changed.length).toBeGreaterThan(0);
  });
});
