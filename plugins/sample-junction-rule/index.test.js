const plugin = require("./index");

describe("sample-junction-rule plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns decisionTypes", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("decisionTypes");
    expect(Array.isArray(result.decisionTypes)).toBe(true);
  });

  describe("deployment-strategy decision type", () => {
    test("creates junction with options", () => {
      const result = plugin.register();
      const decisionType = result.decisionTypes[0];
      
      const context = {
        service: "api-gateway",
        current_version: "1.0.0",
        target_version: "2.0.0",
        risk_tolerance: "low",
        traffic_pattern: "spiky",
      };

      const junction = decisionType.createJunction(context);
      expect(junction).toHaveProperty("type", "deployment-strategy");
      expect(junction).toHaveProperty("options");
      expect(junction.options.length).toBe(3);
    });

    test("ranks options by score", () => {
      const result = plugin.register();
      const decisionType = result.decisionTypes[0];
      
      const context = {
        service: "api",
        risk_tolerance: "low",
      };

      const junction = decisionType.createJunction(context);
      const scores = junction.options.map(o => o.score);
      
      // Scores should be descending
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    test("all options have required fields", () => {
      const result = plugin.register();
      const decisionType = result.decisionTypes[0];
      
      const junction = decisionType.createJunction({});
      
      for (const option of junction.options) {
        expect(option).toHaveProperty("id");
        expect(option).toHaveProperty("name");
        expect(option).toHaveProperty("score");
        expect(option).toHaveProperty("confidence");
        expect(option).toHaveProperty("evidence");
      }
    });

    test("evaluate returns valid result", () => {
      const result = plugin.register();
      const decisionType = result.decisionTypes[0];
      
      const junction = {
        options: [
          { id: "opt1", confidence: 0.9 },
          { id: "opt2", confidence: 0.7 },
        ],
        selection_criteria: { minimum_confidence: 0.8 },
      };

      const evalResult = decisionType.evaluate(junction, []);
      expect(evalResult).toHaveProperty("valid");
      expect(evalResult).toHaveProperty("selected");
      expect(evalResult).toHaveProperty("rejected_options");
    });
  });
});
