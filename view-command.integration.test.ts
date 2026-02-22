import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseViewArgs, runViewCommand } from "./view-cli.js";

describe("view command", () => {
  it("writes static viewer and viewmodel", async () => {
    const cwd = process.cwd();
    const root = mkdtempSync(join(tmpdir(), "zeo-view-cmd-"));
    process.chdir(root);
    const id = "run-2";
    const dir = join(root, ".zeo", "analyze-pr", id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ manifest_hash: "m" }));
    writeFileSync(join(dir, "summary.json"), JSON.stringify({ risk_score: 50 }));
    writeFileSync(join(dir, "findings.json"), JSON.stringify([{ id: "fx", category: "security", severity: "high", description: "x", file: "a.ts", evidence: ["policy"] }]));

    const code = await runViewCommand(parseViewArgs([id]));
    expect(code).toBe(0);
    expect(existsSync(join(root, ".zeo", "view", id, "index.html"))).toBe(true);
    const model = JSON.parse(readFileSync(join(root, ".zeo", "viewmodels", `${id}.json`), "utf8"));
    expect(model.schemaVersion).toBe("dashboard.viewmodel.v1");
    process.chdir(cwd);
  });
});
