const { execSync } = require("child_process");
const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");

const EXAMPLE_DIR = __dirname;

describe("03-junction-to-decision", () => {
  test("has required files", () => {
    expect(existsSync(resolve(EXAMPLE_DIR, "README.md"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "run.js"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "junction.json"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "policies.json"))).toBe(true);
  });

  test("junction.json has valid structure", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "junction.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("options");
    expect(Array.isArray(parsed.options)).toBe(true);
    expect(parsed.options.length).toBe(3);
    expect(parsed).toHaveProperty("selection_criteria");
  });

  test("junction options have required fields", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "junction.json"), "utf8");
    const parsed = JSON.parse(content);
    
    for (const option of parsed.options) {
      expect(option).toHaveProperty("id");
      expect(option).toHaveProperty("name");
      expect(option).toHaveProperty("confidence");
      expect(typeof option.confidence).toBe("number");
      expect(option.confidence).toBeGreaterThanOrEqual(0);
      expect(option.confidence).toBeLessThanOrEqual(1);
    }
  });

  test("run.js shows junction evaluation", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result).toContain("Junction to Decision");
    expect(result).toContain("Options");
    expect(result).toContain("Policies");
    expect(result).toContain("Evaluation");
  });

  test("policies.json has valid rules", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "policies.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("policies");
    expect(Array.isArray(parsed.policies)).toBe(true);
    
    for (const policy of parsed.policies) {
      expect(policy).toHaveProperty("id");
      expect(policy).toHaveProperty("rule");
    }
  });
});
