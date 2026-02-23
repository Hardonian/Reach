const plugin = require("./index");

describe("pack-replay-first-ci plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns analyzers and renderers", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("analyzers");
    expect(result).toHaveProperty("renderers");
  });

  describe("replay-verify analyzer", () => {
    test("verifies matching fingerprints", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];

      const findings = analyzer.analyze({
        original: { fingerprint: "abc123", events: [{}, {}] },
        replay: { fingerprint: "abc123", events: [{}, {}] },
      });

      const success = findings.find((f) =>
        f.message.includes("Fingerprints match"),
      );
      expect(success).toBeDefined();
    });

    test("detects fingerprint mismatch", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];

      const findings = analyzer.analyze({
        original: { fingerprint: "abc123", events: [] },
        replay: { fingerprint: "def456", events: [] },
      });

      const error = findings.find((f) => f.rule === "determinism-required");
      expect(error).toBeDefined();
    });

    test("detects event count mismatch", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];

      const findings = analyzer.analyze({
        original: { fingerprint: "abc", events: [{}, {}] },
        replay: { fingerprint: "abc", events: [{}] },
      });

      const warning = findings.find((f) => f.message.includes("Event count"));
      expect(warning).toBeDefined();
    });
  });

  describe("ci-check analyzer", () => {
    test("requires deterministic flag", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];

      const findings = analyzer.analyze({
        config: { deterministic: false },
      });

      const error = findings.find((f) => f.rule === "determinism-required");
      expect(error).toBeDefined();
    });

    test("warns on missing frozen_artifacts", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];

      const findings = analyzer.analyze({
        config: { deterministic: true },
      });

      const warning = findings.find((f) => f.rule === "frozen-artifacts");
      expect(warning).toBeDefined();
    });

    test("passes with correct config", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];

      const findings = analyzer.analyze({
        config: {
          deterministic: true,
          frozen_artifacts: true,
          stable_output: true,
          name: "test",
          version: "1.0.0",
          steps: [],
        },
      });

      const errors = findings.filter(
        (f) => f.severity === "error" || f.severity === "high",
      );
      expect(errors.length).toBe(0);
    });
  });

  describe("ci-report renderer", () => {
    test("renders CI report", () => {
      const result = plugin.register();
      const renderer = result.renderers["ci-report"];

      const data = {
        id: "run_123",
        status: "success",
        fingerprint: "abc123",
        proof: { verified: true },
      };

      const output = renderer.render(data);
      expect(output).toContain("Reach CI Report");
      expect(output).toContain("run_123");
      expect(output).toContain("success");
    });
  });

  describe("ci-json renderer", () => {
    test("renders valid JSON", () => {
      const result = plugin.register();
      const renderer = result.renderers["ci-json"];

      const data = { id: "run_123", nested: { value: 123 } };
      const output = renderer.render(data);

      expect(JSON.parse(output)).toEqual(
        expect.objectContaining({
          id: "run_123",
          nested: { value: 123 },
        }),
      );
    });
  });
});
