const plugin = require("./index");

describe("sample-deterministic-plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns decisionTypes and analyzers", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("decisionTypes");
    expect(result).toHaveProperty("analyzers");
  });

  describe("deterministic-choice", () => {
    test("makes deterministic choice", () => {
      const result = plugin.register();
      const decisionType = result.decisionTypes[0];
      
      const params = {
        seed: "test-seed",
        options: ["a", "b", "c"],
      };

      const choice = decisionType.decide(params);
      expect(choice).toHaveProperty("selected");
      expect(choice).toHaveProperty("selected_index");
      expect(choice).toHaveProperty("fingerprint");
      expect(choice).toHaveProperty("evidence");
    });

    test("same seed produces same choice", () => {
      const result = plugin.register();
      const decisionType = result.decisionTypes[0];
      
      const params = {
        seed: "fixed-seed",
        options: ["a", "b", "c"],
      };

      const choice1 = decisionType.decide(params);
      const choice2 = decisionType.decide(params);
      
      expect(choice1.selected).toBe(choice2.selected);
      expect(choice1.selected_index).toBe(choice2.selected_index);
    });

    test("different seeds produce potentially different choices", () => {
      const result = plugin.register();
      const decisionType = result.decisionTypes[0];
      
      const params1 = { seed: "seed-a", options: ["a", "b", "c"] };
      const params2 = { seed: "seed-b", options: ["a", "b", "c"] };

      const choice1 = decisionType.decide(params1);
      const choice2 = decisionType.decide(params2);
      
      // Not guaranteed to be different, but likely
      expect(choice1.fingerprint).not.toBe(choice2.fingerprint);
    });

    test("handles empty options", () => {
      const result = plugin.register();
      const decisionType = result.decisionTypes[0];
      
      expect(() => {
        decisionType.decide({ seed: "test", options: [] });
      }).toThrow();
    });
  });

  describe("determinism-check analyzer", () => {
    test("detects Math.random()", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({ code: "const x = Math.random();" });
      const error = findings.find(f => f.rule === "no-math-random");
      expect(error).toBeDefined();
      expect(error.severity).toBe("high");
    });

    test("detects Date.now()", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({ code: "const t = Date.now();" });
      const warning = findings.find(f => f.rule === "avoid-date-now");
      expect(warning).toBeDefined();
    });

    test("passes clean code", () => {
      const result = plugin.register();
      const analyzer = result.analyzers[0];
      
      const findings = analyzer.analyze({ code: "const x = 42;" });
      const errors = findings.filter(f => f.severity === "high" || f.severity === "error");
      expect(errors.length).toBe(0);
    });
  });
});
