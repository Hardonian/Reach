// @ts-nocheck
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateDashboardViewModel } from "../lib/generateViewModel.js";
import { runRenderCommand, runShareCommand, runDemoCommand } from "./render-cli.js";

function setupFixture(root: string, id: string) {
  const dir = join(root, ".zeo", "analyze-pr", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ manifest_hash: "abc123" }));
  writeFileSync(join(dir, "summary.json"), JSON.stringify({ risk_score: 64 }));
  writeFileSync(
    join(dir, "findings.json"),
    JSON.stringify([
      {
        id: "f2",
        category: "reliability",
        severity: "medium",
        description: "B",
        file: "b.ts",
        evidence: ["policy:runtime"],
      },
      {
        id: "f1",
        category: "security",
        severity: "high",
        description: "A",
        file: "a.ts",
        evidence: ["security-rule"],
      },
    ]),
  );
}

describe("render/share/demo", () => {
  it("renders github output with required sections", async () => {
    const cwd = process.cwd();
    const root = mkdtempSync(join(tmpdir(), "zeo-render-"));
    process.chdir(root);
    setupFixture(root, "run-1");

    const chunks: string[] = [];
    const original = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    const code = await runRenderCommand(["run-1", "--target", "github-pr"]);
    process.stdout.write = original;

    expect(code).toBe(0);
    const out = chunks.join("");
    expect(out).toContain("Zeo Review:");
    expect(out).toContain("## Verification");
    expect(out).toContain("manifestHash");
    process.chdir(cwd);
  });

  it("share github --print matches github renderer", async () => {
    const cwd = process.cwd();
    const root = mkdtempSync(join(tmpdir(), "zeo-share-"));
    process.chdir(root);
    setupFixture(root, "run-2");

    const first: string[] = [];
    const second: string[] = [];
    const original = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      first.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    await runRenderCommand(["run-2", "--target", "github-pr", "--compact"]);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      second.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    await runShareCommand(["github", "run-2", "--print"]);
    process.stdout.write = original;

    expect(second.join("").trim()).toBe(first.join("").trim());
    process.chdir(cwd);
  });

  it("demo creates expected files", async () => {
    const cwd = process.cwd();
    const root = mkdtempSync(join(tmpdir(), "zeo-demo-"));
    process.chdir(root);
    const examples = ["analyze-pr-auth", "analyze-pr-migration", "analyze-pr-performance"];
    for (const ex of examples) {
      const exDir = join(root, "examples", ex);
      mkdirSync(exDir, { recursive: true });
      writeFileSync(
        join(exDir, "diff.patch"),
        "diff --git a/a.ts b/a.ts\n+++ b/a.ts\n@@ -0,0 +1 @@\n+const token = 'ghp_abcdefghijklmnopqrstuvwxyz';\n",
      );
    }
    const chunks: string[] = [];
    const original = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    const code = await runDemoCommand([]);
    process.stdout.write = original;
    expect(code).toBe(0);
    const outDir = chunks.join("").trim().split("\n").at(-1)!;
    expect(existsSync(join(outDir, "README.md"))).toBe(true);
    expect(existsSync(join(outDir, "pr-comment.md"))).toBe(true);
    expect(existsSync(join(outDir, "slack-message.txt"))).toBe(true);
    expect(existsSync(join(outDir, "report.md"))).toBe(true);
    expect(existsSync(join(outDir, "dashboard.html"))).toBe(true);
    expect(existsSync(join(outDir, "bundle.zip"))).toBe(true);
    expect(readFileSync(join(outDir, "pr-comment.md"), "utf8")).toContain("Zeo Review");
    process.chdir(cwd);
  });
});
