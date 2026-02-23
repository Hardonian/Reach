const plugin = require("./index");

describe("template plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns analyzers", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("analyzers");
    expect(Array.isArray(result.analyzers)).toBe(true);
  });

  test("analyzer has required properties", () => {
    const result = plugin.register();
    const analyzer = result.analyzers[0];
    expect(analyzer).toHaveProperty("id");
    expect(analyzer).toHaveProperty("deterministic");
    expect(analyzer).toHaveProperty("analyze");
    expect(typeof analyzer.analyze).toBe("function");
  });

  test("analyzer returns array", () => {
    const result = plugin.register();
    const analyzer = result.analyzers[0];
    const findings = analyzer.analyze({ example: true });
    expect(Array.isArray(findings)).toBe(true);
  });

  test("analyzer handles empty input", () => {
    const result = plugin.register();
    const analyzer = result.analyzers[0];
    const findings = analyzer.analyze({});
    expect(Array.isArray(findings)).toBe(true);
  });
});
