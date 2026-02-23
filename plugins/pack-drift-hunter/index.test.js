const plugin = require("./index");

describe("pack-drift-hunter plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns analyzers and evidenceExtractors", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("analyzers");
    expect(result).toHaveProperty("evidenceExtractors");
  });

  describe("drift-scan analyzer", () => {
    test("detects fingerprint changes", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({
        previous: { fingerprint: "abc123" },
        current: { fingerprint: "def456" },
      });
      
      const warning = findings.find(f => f.rule === "fingerprint-changed");
      expect(warning).toBeDefined();
    });

    test("detects config drift", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({
        previous: { config: { version: "1.0.0" } },
        current: { config: { version: "2.0.0" } },
      });
      
      const warning = findings.find(f => f.rule === "config-drift");
      expect(warning).toBeDefined();
    });

    test("handles insufficient data", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({});
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe("diff-runs analyzer", () => {
    test("compares two runs", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];
      
      const findings = analyzer.analyze({
        runA: { id: "run1", status: "success", fingerprint: "abc" },
        runB: { id: "run2", status: "failure", fingerprint: "def" },
      });
      
      expect(findings.length).toBeGreaterThan(0);
    });

    test("reports no differences for identical runs", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];
      
      const findings = analyzer.analyze({
        runA: { id: "run1", status: "success" },
        runB: { id: "run1", status: "success" },
      });
      
      const info = findings.find(f => f.message.includes("No differences"));
      expect(info).toBeDefined();
    });
  });

  describe("drift-evidence extractor", () => {
    test("extracts workspace state", () => {
      const result = plugin.register();
      const extractor = result.evidenceExtractors[0];
      
      const evidence = extractor.extract({
        workspace: ".",
      });
      
      expect(evidence).toHaveProperty("source", "pack-drift-hunter");
      expect(evidence).toHaveProperty("items");
      expect(Array.isArray(evidence.items)).toBe(true);
    });
  });
});
