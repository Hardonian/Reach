const plugin = require("./index");

describe("analyzer-example plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns analyzers", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("analyzers");
    expect(result.analyzers.length).toBe(2);
  });

  describe("example-complexity-check", () => {
    test("detects long functions", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];

      // Create a "function" with 60 lines
      const lines = ["function test() {"];
      for (let i = 0; i < 60; i++) {
        lines.push("  console.log('line');");
      }
      lines.push("}");

      const findings = analyzer.analyze({
        content: lines.join("\n"),
        filename: "test.js",
      });

      const warning = findings.find((f) => f.rule === "function-length");
      expect(warning).toBeDefined();
    });

    test("detects TODO comments", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];

      const findings = analyzer.analyze({
        content: "// TODO: fix this",
        filename: "test.js",
      });

      const todo = findings.find((f) => f.rule === "todo-comment");
      expect(todo).toBeDefined();
    });

    test("detects console.log", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];

      const findings = analyzer.analyze({
        content: "console.log('debug');",
        filename: "test.js",
      });

      const consoleLog = findings.find((f) => f.rule === "no-console-log");
      expect(consoleLog).toBeDefined();
    });
  });

  describe("example-security-check", () => {
    test("detects hardcoded passwords", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];

      const findings = analyzer.analyze({
        content: "const password = 'secret123';",
        filename: "config.js",
      });

      const error = findings.find((f) => f.rule === "no-hardcoded-secrets");
      expect(error).toBeDefined();
      expect(error.severity).toBe("high");
    });

    test("detects eval usage", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];

      const findings = analyzer.analyze({
        content: "eval(userInput);",
        filename: "danger.js",
      });

      const error = findings.find((f) => f.rule === "no-eval");
      expect(error).toBeDefined();
      expect(error.severity).toBe("high");
    });

    test("detects API keys", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];

      const findings = analyzer.analyze({
        content: 'const api_key = "abc123xyz789";',
        filename: "config.js",
      });

      const error = findings.find((f) => f.rule === "no-hardcoded-secrets");
      expect(error).toBeDefined();
    });
  });
});
