import { describe, it, expect } from "vitest";
import { parseArgs } from "./lib/args.js";

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
