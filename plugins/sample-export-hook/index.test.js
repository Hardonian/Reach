const plugin = require("./index");

describe("sample-export-hook plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns renderers", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("renderers");
  });

  describe("export-metadata-renderer", () => {
    test("generates metadata file", () => {
      const result = plugin.register();
      const renderer = result.renderers["export-metadata-renderer"];
      
      const run = {
        id: "run_abc123",
        fingerprint: "fp_abc123",
        events: [{ type: "start" }, { type: "end" }],
        evidence: [{ source: "test" }],
      };

      const files = renderer.render(run);
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      
      const metadataFile = files.find(f => f.filename === "plugin-metadata.json");
      expect(metadataFile).toBeDefined();
    });

    test("metadata has required fields", () => {
      const result = plugin.register();
      const renderer = result.renderers["export-metadata-renderer"];
      
      const run = { id: "run_123", fingerprint: "fp_123", events: [], evidence: [] };
      const files = renderer.render(run);
      
      const metadataFile = files.find(f => f.filename === "plugin-metadata.json");
      const metadata = JSON.parse(metadataFile.content);
      
      expect(metadata).toHaveProperty("export_format_version");
      expect(metadata).toHaveProperty("plugin_generated_by");
      expect(metadata).toHaveProperty("source_run_id");
      expect(metadata).toHaveProperty("statistics");
    });

    test("handles null run", () => {
      const result = plugin.register();
      const renderer = result.renderers["export-metadata-renderer"];
      
      const files = renderer.render(null);
      expect(files).toEqual([]);
    });
  });

  describe("export-summary-text", () => {
    test("generates README.txt", () => {
      const result = plugin.register();
      const renderer = result.renderers["export-summary-text"];
      
      const run = {
        id: "run_abc123",
        status: "success",
        fingerprint: "fp_abc123",
      };

      const files = renderer.render(run);
      expect(files.length).toBeGreaterThan(0);
      
      const readmeFile = files.find(f => f.filename === "README.txt");
      expect(readmeFile).toBeDefined();
      expect(readmeFile.content).toContain("Reach Export Bundle");
    });
  });
});
