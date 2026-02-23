const { execSync } = require("child_process");
const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");

const EXAMPLE_DIR = __dirname;

describe("04-action-plan-execute-safe", () => {
  test("has required files", () => {
    expect(existsSync(resolve(EXAMPLE_DIR, "README.md"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "run.js"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "decision.json"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "plan.json"))).toBe(true);
  });

  test("decision.json has safe_only flag", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "decision.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("safe_only");
    expect(parsed.safe_only).toBe(true);
  });

  test("plan.json has safe steps", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "plan.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("steps");
    expect(Array.isArray(parsed.steps)).toBe(true);
    
    for (const step of parsed.steps) {
      expect(step).toHaveProperty("safe");
      expect(step.safe).toBe(true);
    }
  });

  test("all plan steps have dry_run or readonly", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "plan.json"), "utf8");
    const parsed = JSON.parse(content);
    
    for (const step of parsed.steps) {
      const isSafe = step.readonly === true || step.dry_run === true;
      expect(isSafe).toBe(true);
    }
  });

  test("run.js executes workflow", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 15000,
    });
    expect(result).toContain("Action Plan Execute");
    expect(result).toContain("Phase 1: Decision");
    expect(result).toContain("Phase 2: Plan");
    expect(result).toContain("Phase 3: Approval");
    expect(result).toContain("Phase 4: Execute");
  });

  test("journal entries are created", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 15000,
    });
    expect(result).toContain("plan.started");
    expect(result).toContain("step.started");
    expect(result).toContain("step.completed");
    expect(result).toContain("plan.completed");
  });
});
