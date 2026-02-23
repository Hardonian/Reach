// @ts-nocheck
import { describe, it, expect } from "vitest";
import { __private__ } from "./analyze-pr-cli.js";

describe("analyze-pr", () => {
  it("extracts modified files deterministically", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "+++ b/src/a.ts",
      "diff --git a/infra/main.tf b/infra/main.tf",
      "+++ b/infra/main.tf",
    ].join("\n");
    expect(__private__.parseModifiedFiles(diff)).toEqual(["infra/main.tf", "src/a.ts"]);
  });

  it("builds stable findings and risk score from fixed fixture", () => {
    const diff = [
      "diff --git a/auth/login.ts b/auth/login.ts",
      "+++ b/auth/login.ts",
      "@@ -1,2 +1,4 @@",
      '+const token = process.env.API_KEY || "secret_token_123456"',
      "diff --git a/prisma/migrations/001.sql b/prisma/migrations/001.sql",
      "+++ b/prisma/migrations/001.sql",
      "@@ -0,0 +1,2 @@",
      "+SELECT * FROM users",
      "diff --git a/src/service/user-service.ts b/src/service/user-service.ts",
      "+++ b/src/service/user-service.ts",
      "@@ -10,1 +10,3 @@",
      "+for (const u of users) { await db.findUnique({ where: { id: u.id } }); }",
    ].join("\n");

    const files = __private__.parseModifiedFiles(diff);
    const hunks = __private__.parseHunks(diff);
    const findings = __private__.analyze(diff, files, hunks);
    const score = __private__.scoreFindings(findings, files);

    expect(findings.map((f) => f.id)).toEqual([
      "96260fcc9ccb",
      "d4e9d9d6744c",
      "12c4c0c58eeb",
      "2aef9a4cf784",
    ]);
    expect(score).toBeGreaterThanOrEqual(40);

    const analysis = __private__.toAnalysis(
      "fixture.patch",
      { diff, mode: "diff-file", target: "fixture.patch", repoHash: null },
      {
        format: "json",
        explain: false,
        safe: true,
        assist: false,
        maxFiles: 100,
        maxDiffBytes: 1024 * 1024,
        target: "fixture.patch",
      },
    );

    expect(analysis.schemaVersion).toBe("2.0.0");
    expect(analysis.findings.length).toBeGreaterThan(0);
    expect(analysis.summary.risk_score).toBe(score);
  });
});
