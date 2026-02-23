import { describe, it, expect } from "vitest";
import { parseArgs } from "./lib/args.js";
import { evaluateDecision, DecisionEngine, type DecisionInput } from "./index.js";

describe("parseArgs", () => {
  it("returns defaults when no args given", () => {
    const args = parseArgs([]);
    expect(args.example).toBe("negotiation");
    expect(args.depth).toBe(2);
    expect(args.jsonOnly).toBe(false);
    expect(args.out).toBeUndefined();
  });

  it("parses --example negotiation", () => {
    expect(parseArgs(["--example", "negotiation"]).example).toBe("negotiation");
  });

  it("parses --example ops", () => {
    expect(parseArgs(["--example", "ops"]).example).toBe("ops");
  });

  it("ignores invalid --example value", () => {
    expect(parseArgs(["--example", "invalid"]).example).toBe("negotiation");
  });

  it("parses --depth bounds", () => {
    expect(parseArgs(["--depth", "3"]).depth).toBe(3);
    expect(parseArgs(["--depth", "6"]).depth).toBe(2);
  });

  it("parses output flags", () => {
    const args = parseArgs(["--json-only", "--out", "out.json"]);
    expect(args.jsonOnly).toBe(true);
    expect(args.out).toBe("out.json");
  });
});

describe("DecisionEngine", () => {
  const mockInput: DecisionInput = {
    actions: ["a1", "a2"],
    states: ["s1", "s2"],
    outcomes: {
      a1: { s1: 10, s2: 5 },
      a2: { s1: 0, s2: 20 },
    },
  };

  it("evaluateDecision returns result (async)", async () => {
    const result = await evaluateDecision(mockInput);
    expect(result.recommended_action).toBeDefined();
    expect(result.ranking).toContain("a1");
  });

  it("DecisionEngine can be manually initialized", async () => {
    const engine = new DecisionEngine();
    await engine.init();
    const result = engine.evaluate(mockInput);
    expect(result.recommended_action).toBeDefined();
  });

  it("falls back to TS implementation if WASM is missing", async () => {
    const engine = new DecisionEngine();
    // init() will try to import WASM and fail in test environment usually
    await engine.init();
    const result = engine.evaluate(mockInput);
    // minimax_regret evaluation on this input:
    // s1 max: 10, s2 max: 20
    // a1 regrets: s1: 0, s2: 15 -> max regret 15
    // a2 regrets: s1: 10, s2: 0 -> max regret 10
    // Recommended: a2
    expect(result.recommended_action).toBe("a2");
  });
});
