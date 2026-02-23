const { execSync } = require("child_process");
const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");

const EXAMPLE_DIR = __dirname;

describe("05-export-verify-replay", () => {
  test("has required files", () => {
    expect(existsSync(resolve(EXAMPLE_DIR, "README.md"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "run.js"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "source-run.json"))).toBe(true);
    expect(existsSync(resolve(EXAMPLE_DIR, "verify-config.json"))).toBe(true);
  });

  test("source-run.json has deterministic execution", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "source-run.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("deterministic");
    expect(parsed.deterministic).toBe(true);
    expect(parsed).toHaveProperty("fingerprint");
    expect(parsed).toHaveProperty("events");
    expect(Array.isArray(parsed.events)).toBe(true);
  });

  test("events have sequence numbers", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "source-run.json"), "utf8");
    const parsed = JSON.parse(content);
    
    for (const event of parsed.events) {
      expect(event).toHaveProperty("sequence");
      expect(typeof event.sequence).toBe("number");
    }
  });

  test("run.js performs export-verify-replay workflow", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result).toContain("Export Verify Replay");
    expect(result).toContain("Phase 1: Export");
    expect(result).toContain("Phase 2: Verify");
    expect(result).toContain("Phase 3: Replay");
    expect(result).toContain("Phase 4: Parity Check");
  });

  test("verification shows valid results", () => {
    const result = execSync("node run.js", {
      cwd: EXAMPLE_DIR,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result).toContain("VALID");
    expect(result).toContain("IDENTICAL");
  });

  test("verify-config.json has integrity checks", () => {
    const content = readFileSync(resolve(EXAMPLE_DIR, "verify-config.json"), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("verification_settings");
    expect(parsed.verification_settings).toHaveProperty("integrity_checks");
  });
});
