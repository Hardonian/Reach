import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { requireRole } from "../../apps/arcade/src/lib/cloud-auth";

const repoRoot = path.resolve(process.cwd());

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("RBAC defaults", () => {
  it("denies unknown role values by default", () => {
    const result = requireRole({ role: "unknown" } as never, "member");
    expect(result).toBe(false);
  });

  it("enforces role ordering from member to admin", () => {
    expect(requireRole({ role: "member" } as never, "admin")).toBe(false);
    expect(requireRole({ role: "admin" } as never, "member")).toBe(true);
  });
});

describe("Tenant boundary invariants", () => {
  it("DB accessors include tenant/org filters", () => {
    const gatesDb = read("apps/arcade/src/lib/db/gates.ts");
    const workflowsDb = read("apps/arcade/src/lib/db/workflows.ts");
    const governanceDb = read("apps/arcade/src/lib/db/governance.ts");

    expect(gatesDb).toMatch(/WHERE id=\? AND tenant_id=\?/);
    expect(workflowsDb).toMatch(/WHERE id=\? AND tenant_id=\?/);
    expect(governanceDb).toMatch(/WHERE org_id=\?/);
  });

  it("mutating cloud routes require explicit role checks", () => {
    const routeFiles = [
      "apps/arcade/src/app/api/v1/gates/route.ts",
      "apps/arcade/src/app/api/v1/gates/[id]/route.ts",
      "apps/arcade/src/app/api/v1/api-keys/route.ts",
      "apps/arcade/src/app/api/v1/governance/memory/route.ts",
      "apps/arcade/src/app/api/v1/workflows/route.ts",
    ];

    for (const file of routeFiles) {
      const content = read(file);
      expect(content).toContain("requireRole");
    }
  });
});
