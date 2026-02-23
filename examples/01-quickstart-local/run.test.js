const { execSync } = require("child_process");
const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");

const EXAMPLE_DIR = __dirname;
const REPO_ROOT = resolve(EXAMPLE_DIR, "../..");

describe("01-quickstart-local", () => {
  test("has required files", () => {
    expect(existsSync(resolve(EXAMPLE_DIR, "README.md"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "run.js"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "seed.json"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "pack.json"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "expected.json"))).toBe(true);
  });

  test("seed.json is valid JSON", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "seed.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("action");
    expect(parsed).toHaveProperty("target");
    expect(parsed).toHaveProperty("input");
  });

  test("pack.json is valid", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "pack.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("deterministic");
    expect(parsed.deterministic).toBe(true);
  });

  test("run.js executes without error", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result).toContain("Quickstart Local");
    expect(result).toContain("Run complete");
  });

  test("expected.json has correct structure", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "expected.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("status");
    expect(parsed).toHaveProperty("output_structure");
    expect(parsed).toHaveProperty("determinism_checks");
  });
});
