const plugin = require("./index");

describe("sample-summarizer plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns evidenceExtractors and analyzers", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("evidenceExtractors");
    expect(result).toHaveProperty("analyzers");
  });

  describe("evidenceExtractors", () => {
    test("summarizes evidence collection", () => {
      const result = plugin.register();
      const extractor = result.evidenceExtractors[0];

      const evidence = {
        items: [
          { category: "metrics", confidence: 0.9 },
          { category: "logs", confidence: 0.8 },
          { category: "metrics", confidence: 0.85 },
        ],
        timestamp: "2026-01-01T00:00:00Z",
      };

      const summary = extractor.extract(evidence);
      expect(summary).toHaveProperty("count", 3);
      expect(summary).toHaveProperty("categories");
      expect(summary).toHaveProperty("confidence");
      expect(summary.confidence).toHaveProperty("average");
    });

    test("handles empty evidence", () => {
      const result = plugin.register();
      const extractor = result.evidenceExtractors[0];

      const summary = extractor.extract({ items: [] });
      expect(summary.count).toBe(0);
    });

    test("handles null evidence", () => {
      const result = plugin.register();
      const extractor = result.evidenceExtractors[0];

      const summary = extractor.extract(null);
      expect(summary.count).toBe(0);
    });
  });

  describe("analyzers", () => {
    test("warns on limited evidence", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];

      const findings = analyzer.analyze({ evidence: [{ id: 1 }] });
      const warning = findings.find((f) => f.type === "warning");
      expect(warning).toBeDefined();
    });

    test("succeeds with sufficient evidence", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];

      const findings = analyzer.analyze({
        evidence: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });
      const warning = findings.find((f) =>
        f.message.includes("Limited evidence"),
      );
      expect(warning).toBeUndefined();
    });
  });
});
