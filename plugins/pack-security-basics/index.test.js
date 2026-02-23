const plugin = require("./index");

describe("pack-security-basics plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns analyzers and evidenceExtractors", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("analyzers");
    expect(result).toHaveProperty("evidenceExtractors");
  });

  describe("security-scan analyzer", () => {
    test("detects AWS access keys", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({
        content: "AKIAIOSFODNN7EXAMPLE",
        filename: "config.js",
      });
      
      const error = findings.find(f => f.rule === "no-hardcoded-secrets");
      expect(error).toBeDefined();
    });

    test("detects private keys", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({
        content: "-----BEGIN RSA PRIVATE KEY-----",
        filename: "key.pem",
      });
      
      const error = findings.find(f => f.rule === "no-hardcoded-secrets");
      expect(error).toBeDefined();
    });

    test("detects eval usage", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({
        content: "eval(userInput);",
        filename: "danger.js",
      });
      
      const warning = findings.find(f => f.rule === "no-eval");
      expect(warning).toBeDefined();
    });

    test("detects passwords", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({
        content: "const password = 'supersecret';",
        filename: "auth.js",
      });
      
      const error = findings.find(f => f.message.includes("password"));
      expect(error).toBeDefined();
    });
  });

  describe("integrity-check analyzer", () => {
    test("verifies matching hashes", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];
      
      const content = "test content";
      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      
      const findings = analyzer.analyze({
        artifacts: { "test.txt": content },
        expectedHashes: { "test.txt": hash },
      });
      
      const success = findings.find(f => f.message.includes("verified"));
      expect(success).toBeDefined();
    });

    test("detects hash mismatch", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];
      
      const findings = analyzer.analyze({
        artifacts: { "test.txt": "content" },
        expectedHashes: { "test.txt": "wronghash" },
      });
      
      const error = findings.find(f => f.rule === "verified-artifacts-only");
      expect(error).toBeDefined();
    });

    test("detects missing artifacts", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[1];
      
      const findings = analyzer.analyze({
        artifacts: {},
        expectedHashes: { "test.txt": "hash" },
      });
      
      const error = findings.find(f => f.message.includes("Missing artifact"));
      expect(error).toBeDefined();
    });
  });

  describe("security-evidence extractor", () => {
    test("extracts platform info", () => {
      const result = plugin.register();
      const extractor = result.evidenceExtractors[0];
      
      const evidence = extractor.extract({});
      
      expect(evidence).toHaveProperty("source", "pack-security-basics");
      expect(evidence).toHaveProperty("items");
      
      const platformItem = evidence.items.find(i => i.type === "platform");
      expect(platformItem).toBeDefined();
      expect(platformItem).toHaveProperty("platform");
      expect(platformItem).toHaveProperty("node_version");
    });
  });
});
