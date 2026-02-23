const plugin = require("./index");

describe("renderer-example plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns renderers", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("renderers");
  });

  describe("json-compact renderer", () => {
    test("renders minified JSON", () => {
      const result = plugin.register();
      const renderer = result.renderers["json-compact"];

      const data = { id: "test", value: 123 };
      const output = renderer.render(data);

      expect(output).not.toContain("\n");
      expect(output).not.toContain("  ");
      expect(JSON.parse(output)).toEqual(data);
    });
  });

  describe("json-pretty renderer", () => {
    test("renders formatted JSON", () => {
      const result = plugin.register();
      const renderer = result.renderers["json-pretty"];

      const data = { id: "test", value: 123 };
      const output = renderer.render(data);

      expect(output).toContain("\n");
      expect(JSON.parse(output)).toEqual(data);
    });
  });

  describe("markdown renderer", () => {
    test("renders markdown", () => {
      const result = plugin.register();
      const renderer = result.renderers["markdown"];

      const data = {
        id: "run_123",
        status: "success",
        fingerprint: "abc123",
        evidence: [{ source: "test", confidence: 0.9 }],
      };

      const output = renderer.render(data);
      expect(output).toContain("# Reach Execution Result");
      expect(output).toContain("| ID | run_123 |");
      expect(output).toContain("Evidence");
    });
  });

  describe("html renderer", () => {
    test("renders HTML", () => {
      const result = plugin.register();
      const renderer = result.renderers["html"];

      const data = {
        id: "run_123",
        status: "success",
        fingerprint: "abc123",
      };

      const output = renderer.render(data);
      expect(output).toContain("<!DOCTYPE html>");
      expect(output).toContain("<html>");
      expect(output).toContain("run_123");
    });

    test("escapes HTML entities", () => {
      const result = plugin.register();
      const renderer = result.renderers["html"];

      const data = {
        id: "<script>alert('xss')</script>",
        status: "success",
      };

      const output = renderer.render(data);
      expect(output).not.toContain("<script>");
      expect(output).toContain("&lt;script&gt;");
    });
  });
});
