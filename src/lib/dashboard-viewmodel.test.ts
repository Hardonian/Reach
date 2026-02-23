// @ts-nocheck
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateDashboardViewModel, stableStringify } from "./generateViewModel.js";

function setupFixture(root: string, id: string) {
  const dir = join(root, ".zeo", "analyze-pr", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ manifest_hash: "abc123" }));
  writeFileSync(join(dir, "summary.json"), JSON.stringify({ risk_score: 64 }));
  writeFileSync(join(dir, "findings.json"), JSON.stringify([
    { id: "f2", category: "reliability", severity: "medium", description: "B", file: "b.ts", evidence: ["p2"] },
    { id: "f1", category: "security", severity: "high", description: "A", file: "a.ts", evidence: ["p1"] }
  ]));
}

describe("dashboard viewmodel", () => {
  it("is deterministic and stable-sorted", () => {
    const cwd = process.cwd();
    const root = mkdtempSync(join(tmpdir(), "zeo-dashboard-"));
    process.chdir(root);
    setupFixture(root, "run-1");

    const first = generateDashboardViewModel({ id: "run-1", persona: "exec" });
    const second = generateDashboardViewModel({ id: "run-1", persona: "exec" });
    expect(stableStringify(first)).toBe(stableStringify(second));
    expect(first.lists.findings[0].id).toBe("f1");
    expect(first.schemaVersion).toBe("dashboard.viewmodel.v1");
    expect(first.graph.nodes.every((node) => Boolean((node.meta as { position?: unknown } | undefined)?.position))).toBe(true);
    expect(first.ctas.map((cta) => cta.command)).toEqual(second.ctas.map((cta) => cta.command));
    process.chdir(cwd);
  });
});
