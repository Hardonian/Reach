import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compileGovernanceIntent,
  type GovernanceMemoryEntry,
} from "../../apps/arcade/src/lib/governance/compiler.js";
import { generateGovernanceArtifacts } from "../../apps/arcade/src/lib/governance/codegen.js";
import { validateGovernanceApplyGuard } from "../../apps/arcade/src/lib/governance/apply-guard.js";
import type { GovernanceScope } from "../../apps/arcade/src/lib/governance/types.js";

interface MemoryRow {
  id: string;
  org_id: string;
  workspace_id: string;
  scope: GovernanceScope;
  memory_type: GovernanceMemoryEntry["memoryType"];
  content_json: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

interface SpecRow {
  id: string;
  org_id: string;
  workspace_id: string;
  scope: GovernanceScope;
  version: number;
  source_intent: string;
  governance_plan_json: string;
  spec_json: string;
  spec_hash: string;
  rollout_mode: "dry-run" | "enforced";
  risk_summary_json: string;
  triggered_by: "user" | "assistant";
  actor_user_id: string | null;
  parent_spec_id: string | null;
  replay_link: string | null;
  created_at: string;
}

interface ArtifactRow {
  id: string;
  org_id: string;
  workspace_id: string;
  spec_id: string | null;
  artifact_type: string;
  artifact_path: string;
  content_text: string;
  content_hash: string;
  source_intent: string | null;
  governance_plan_json: string | null;
  spec_hash: string | null;
  output_hash: string | null;
  engine_name: string | null;
  engine_version: string | null;
  actor_type: "user" | "system" | null;
  actor_user_id: string | null;
  triggered_by: "user" | "assistant" | null;
  created_at: string;
}

interface FakeStore {
  memory: MemoryRow[];
  specs: SpecRow[];
  artifacts: ArtifactRow[];
}

interface Statement {
  all: (...args: unknown[]) => unknown[];
  get: (...args: unknown[]) => unknown;
  run: (...args: unknown[]) => unknown;
}

type GovernanceDbModule = typeof import("../../apps/arcade/src/lib/db/governance.js");

function descString(a: string, b: string): number {
  if (a < b) return 1;
  if (a > b) return -1;
  return 0;
}

function ascString(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function createStatement(sql: string, store: FakeStore): Statement {
  const normalized = normalizeSql(sql);

  if (normalized.includes("select * from governance_memory where org_id=? and workspace_id=?")) {
    return {
      all: (orgId, workspaceId, ...scopes) => {
        const scopeSet = new Set(scopes.map((scope) => String(scope)));
        return store.memory
          .filter(
            (row) =>
              row.org_id === orgId && row.workspace_id === workspaceId && scopeSet.has(row.scope),
          )
          .sort((a, b) => {
            if (a.confidence > b.confidence) return -1;
            if (a.confidence < b.confidence) return 1;
            const updatedCmp = descString(a.updated_at, b.updated_at);
            if (updatedCmp !== 0) return updatedCmp;
            return ascString(a.id, b.id);
          });
      },
      get: () => undefined,
      run: () => undefined,
    };
  }

  if (normalized.includes("select id from governance_memory")) {
    return {
      all: () => [],
      get: (orgId, workspaceId, scope, memoryType) =>
        store.memory
          .filter(
            (row) =>
              row.org_id === orgId &&
              row.workspace_id === workspaceId &&
              row.scope === scope &&
              row.memory_type === memoryType,
          )
          .map((row) => ({ id: row.id }))[0],
      run: () => undefined,
    };
  }

  if (normalized.startsWith("update governance_memory set content_json=?")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (contentJson, confidence, updatedAt, id) => {
        const row = store.memory.find((entry) => entry.id === id);
        if (row) {
          row.content_json = String(contentJson);
          row.confidence = Number(confidence);
          row.updated_at = String(updatedAt);
        }
        return undefined;
      },
    };
  }

  if (normalized.startsWith("insert into governance_memory")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (
        id,
        orgId,
        workspaceId,
        scope,
        memoryType,
        contentJson,
        confidence,
        createdAt,
        updatedAt,
      ) => {
        store.memory.push({
          id: String(id),
          org_id: String(orgId),
          workspace_id: String(workspaceId),
          scope: scope as GovernanceScope,
          memory_type: memoryType as GovernanceMemoryEntry["memoryType"],
          content_json: String(contentJson),
          confidence: Number(confidence),
          created_at: String(createdAt),
          updated_at: String(updatedAt),
        });
        return undefined;
      },
    };
  }

  if (normalized.includes("select * from governance_memory where id=? and org_id=?")) {
    return {
      all: () => [],
      get: (id, orgId) =>
        store.memory.find((row) => row.id === id && row.org_id === orgId) ?? undefined,
      run: () => undefined,
    };
  }

  if (
    normalized.includes(
      "select * from governance_specs where org_id=? and workspace_id=? and scope=? order by version desc limit 1",
    )
  ) {
    return {
      all: () => [],
      get: (orgId, workspaceId, scope) =>
        store.specs
          .filter(
            (row) =>
              row.org_id === orgId && row.workspace_id === workspaceId && row.scope === scope,
          )
          .sort((a, b) => b.version - a.version)[0],
      run: () => undefined,
    };
  }

  if (normalized.includes("select * from governance_specs where id=? and org_id=?")) {
    return {
      all: () => [],
      get: (id, orgId) =>
        store.specs.find((row) => row.id === id && row.org_id === orgId) ?? undefined,
      run: () => undefined,
    };
  }

  if (
    normalized.includes(
      "select * from governance_specs where org_id=? and workspace_id=? and scope=? order by version desc limit ?",
    )
  ) {
    return {
      all: (orgId, workspaceId, scope, limit) =>
        store.specs
          .filter(
            (row) =>
              row.org_id === orgId && row.workspace_id === workspaceId && row.scope === scope,
          )
          .sort((a, b) => b.version - a.version)
          .slice(0, Number(limit)),
      get: () => undefined,
      run: () => undefined,
    };
  }

  if (
    normalized.includes(
      "select * from governance_specs where org_id=? and workspace_id=? order by created_at desc, version desc limit ?",
    )
  ) {
    return {
      all: (orgId, workspaceId, limit) =>
        store.specs
          .filter((row) => row.org_id === orgId && row.workspace_id === workspaceId)
          .sort((a, b) => {
            const createdCmp = descString(a.created_at, b.created_at);
            if (createdCmp !== 0) return createdCmp;
            return b.version - a.version;
          })
          .slice(0, Number(limit)),
      get: () => undefined,
      run: () => undefined,
    };
  }

  if (normalized.startsWith("insert into governance_specs")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (
        id,
        orgId,
        workspaceId,
        scope,
        version,
        sourceIntent,
        governancePlanJson,
        specJson,
        specHash,
        rolloutMode,
        riskSummaryJson,
        triggeredBy,
        actorUserId,
        parentSpecId,
        replayLink,
        createdAt,
      ) => {
        store.specs.push({
          id: String(id),
          org_id: String(orgId),
          workspace_id: String(workspaceId),
          scope: scope as GovernanceScope,
          version: Number(version),
          source_intent: String(sourceIntent),
          governance_plan_json: String(governancePlanJson),
          spec_json: String(specJson),
          spec_hash: String(specHash),
          rollout_mode: rolloutMode as "dry-run" | "enforced",
          risk_summary_json: String(riskSummaryJson),
          triggered_by: triggeredBy as "user" | "assistant",
          actor_user_id: actorUserId === null ? null : String(actorUserId),
          parent_spec_id: parentSpecId === null ? null : String(parentSpecId),
          replay_link: replayLink === null ? null : String(replayLink),
          created_at: String(createdAt),
        });
        return undefined;
      },
    };
  }

  if (
    normalized.includes(
      "select * from artifacts where org_id=? and workspace_id=? and spec_id=? order by artifact_type asc, artifact_path asc",
    )
  ) {
    return {
      all: (orgId, workspaceId, specId) =>
        store.artifacts
          .filter(
            (row) =>
              row.org_id === orgId && row.workspace_id === workspaceId && row.spec_id === specId,
          )
          .sort((a, b) => {
            const typeCmp = ascString(a.artifact_type, b.artifact_type);
            if (typeCmp !== 0) return typeCmp;
            return ascString(a.artifact_path, b.artifact_path);
          }),
      get: () => undefined,
      run: () => undefined,
    };
  }

  if (
    normalized.includes(
      "select * from artifacts where org_id=? and workspace_id=? order by created_at desc, artifact_type asc",
    )
  ) {
    return {
      all: (orgId, workspaceId) =>
        store.artifacts
          .filter((row) => row.org_id === orgId && row.workspace_id === workspaceId)
          .sort((a, b) => {
            const createdCmp = descString(a.created_at, b.created_at);
            if (createdCmp !== 0) return createdCmp;
            return ascString(a.artifact_type, b.artifact_type);
          }),
      get: () => undefined,
      run: () => undefined,
    };
  }

  if (normalized.startsWith("insert into artifacts")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (
        id,
        orgId,
        workspaceId,
        specId,
        artifactType,
        artifactPath,
        contentText,
        contentHash,
        sourceIntent,
        governancePlanJson,
        specHash,
        outputHash,
        engineName,
        engineVersion,
        actorType,
        actorUserId,
        triggeredBy,
        createdAt,
      ) => {
        store.artifacts.push({
          id: String(id),
          org_id: String(orgId),
          workspace_id: String(workspaceId),
          spec_id: specId === null ? null : String(specId),
          artifact_type: String(artifactType),
          artifact_path: String(artifactPath),
          content_text: String(contentText),
          content_hash: String(contentHash),
          source_intent: sourceIntent === null ? null : String(sourceIntent),
          governance_plan_json: governancePlanJson === null ? null : String(governancePlanJson),
          spec_hash: specHash === null ? null : String(specHash),
          output_hash: outputHash === null ? null : String(outputHash),
          engine_name: engineName === null ? null : String(engineName),
          engine_version: engineVersion === null ? null : String(engineVersion),
          actor_type: actorType === null ? null : (actorType as "user" | "system"),
          actor_user_id: actorUserId === null ? null : String(actorUserId),
          triggered_by: triggeredBy === null ? null : (triggeredBy as "user" | "assistant"),
          created_at: String(createdAt),
        });
        return undefined;
      },
    };
  }

  if (normalized.includes("select * from artifacts where id=? and org_id=?")) {
    return {
      all: () => [],
      get: (id, orgId) =>
        store.artifacts.find((row) => row.id === id && row.org_id === orgId) ?? undefined,
      run: () => undefined,
    };
  }

  throw new Error(`Unhandled SQL in test double: ${sql}`);
}

function toCompilerMemory(
  records: ReturnType<GovernanceDbModule["listGovernanceMemory"]>,
): GovernanceMemoryEntry[] {
  return records.map((record) => ({
    id: record.id,
    orgId: record.org_id,
    workspaceId: record.workspace_id,
    scope: record.scope,
    memoryType: record.memory_type,
    content: record.content,
    confidence: record.confidence,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }));
}

function findThresholdValue(
  compiled: ReturnType<typeof compileGovernanceIntent>,
  metric: string,
): number | undefined {
  const threshold = compiled.spec.thresholds.find((entry) => entry.metric === metric);
  return threshold?.value;
}

let store: FakeStore;
let governanceDb: GovernanceDbModule;

beforeEach(async () => {
  let idCounter = 0;
  store = {
    memory: [],
    specs: [],
    artifacts: [],
  };

  vi.resetModules();
  vi.doMock("../../apps/arcade/src/lib/db/connection.js", () => ({
    getDB: () => ({
      prepare: (sql: string) => createStatement(sql, store),
    }),
  }));
  vi.doMock("../../apps/arcade/src/lib/db/helpers.js", () => ({
    newId: (prefix: string) => `${prefix}_${String(++idCounter).padStart(4, "0")}`,
  }));

  governanceDb = await import("../../apps/arcade/src/lib/db/governance.js");
});

afterEach(() => {
  vi.doUnmock("../../apps/arcade/src/lib/db/connection.js");
  vi.doUnmock("../../apps/arcade/src/lib/db/helpers.js");
});

describe("governance hardening", () => {
  it("enforces tenant isolation for governance memory/specs/artifacts", () => {
    const workspaceId = "workspace-isolation";
    const orgA = "org-A";
    const orgB = "org-B";

    const memoryA = governanceDb.upsertGovernanceMemory({
      orgId: orgA,
      workspaceId,
      scope: "project",
      memoryType: "eval_baseline",
      content: { evaluation_min: 0.92 },
      confidence: 0.8,
    });
    const memoryB = governanceDb.upsertGovernanceMemory({
      orgId: orgB,
      workspaceId,
      scope: "project",
      memoryType: "eval_baseline",
      content: { evaluation_min: 0.77 },
      confidence: 0.9,
    });

    const memoryForA = governanceDb.listGovernanceMemory(orgA, workspaceId, "project");
    expect(memoryForA.map((record) => record.id)).toContain(memoryA.id);
    expect(memoryForA.map((record) => record.id)).not.toContain(memoryB.id);
    expect(governanceDb.getGovernanceMemoryById(memoryB.id, orgA)).toBeUndefined();

    const specA = governanceDb.createGovernanceSpec({
      orgId: orgA,
      workspaceId,
      scope: "project",
      sourceIntent: "Tenant A governance spec",
      governancePlan: { plan: "a" },
      spec: { gates: [], thresholds: [], rolloutMode: "dry-run" },
      specHash: "hash-tenant-a",
      rolloutMode: "dry-run",
      riskSummary: ["tenant-a-only"],
      triggeredBy: "assistant",
      actorUserId: null,
    });
    const specB = governanceDb.createGovernanceSpec({
      orgId: orgB,
      workspaceId,
      scope: "project",
      sourceIntent: "Tenant B governance spec",
      governancePlan: { plan: "b" },
      spec: { gates: [], thresholds: [], rolloutMode: "dry-run" },
      specHash: "hash-tenant-b",
      rolloutMode: "dry-run",
      riskSummary: ["tenant-b-only"],
      triggeredBy: "assistant",
      actorUserId: null,
    });

    const specsForA = governanceDb.listGovernanceSpecs({
      orgId: orgA,
      workspaceId,
      scope: "project",
      limit: 10,
    });
    expect(specsForA.map((spec) => spec.id)).toContain(specA.id);
    expect(specsForA.map((spec) => spec.id)).not.toContain(specB.id);
    expect(governanceDb.getGovernanceSpecById(specB.id, orgA)).toBeUndefined();

    const artifactA = governanceDb.createGovernanceArtifact({
      orgId: orgA,
      workspaceId,
      specId: specA.id,
      artifactType: "gate-config",
      artifactPath: "governance/reach.governance.json",
      contentText: "{}",
      contentHash: "artifact-a",
    });
    const artifactB = governanceDb.createGovernanceArtifact({
      orgId: orgB,
      workspaceId,
      specId: specB.id,
      artifactType: "gate-config",
      artifactPath: "governance/reach.governance.json",
      contentText: "{}",
      contentHash: "artifact-b",
    });

    const artifactsForA = governanceDb.listGovernanceArtifacts({
      orgId: orgA,
      workspaceId,
    });
    expect(artifactsForA.map((artifact) => artifact.id)).toContain(artifactA.id);
    expect(artifactsForA.map((artifact) => artifact.id)).not.toContain(artifactB.id);
    expect(governanceDb.getGovernanceArtifactById(artifactB.id, orgA)).toBeUndefined();
  });

  it("persists memory and deterministically influences preview recommendations", () => {
    const orgId = "org-memory";
    const workspaceId = "workspace-memory-preview";
    const intent = "Make this safer.";

    const withoutMemory = compileGovernanceIntent({
      intent,
      orgId,
      workspaceId,
      scope: "project",
      memory: [],
      defaultRolloutMode: "dry-run",
    });

    governanceDb.upsertGovernanceMemory({
      orgId,
      workspaceId,
      scope: "project",
      memoryType: "eval_baseline",
      content: { evaluation_min: 0.97, hallucination_max: 0.04 },
      confidence: 0.95,
    });

    const persistedMemory = governanceDb.listGovernanceMemory(orgId, workspaceId, "project");
    expect(persistedMemory.length).toBeGreaterThan(0);
    expect(Number(persistedMemory[0]?.content.evaluation_min ?? Number.NaN)).toBe(0.97);

    const memoryForCompiler = toCompilerMemory(persistedMemory);
    const previewA = compileGovernanceIntent({
      intent,
      orgId,
      workspaceId,
      scope: "project",
      memory: memoryForCompiler,
      defaultRolloutMode: "dry-run",
    });
    const previewB = compileGovernanceIntent({
      intent,
      orgId,
      workspaceId,
      scope: "project",
      memory: toCompilerMemory(persistedMemory),
      defaultRolloutMode: "dry-run",
    });

    expect(previewA.canonicalSpec).toBe(previewB.canonicalSpec);
    expect(previewA.specHash).toBe(previewB.specHash);
    expect(findThresholdValue(previewA, "evaluation_score")).toBe(0.97);
    expect(findThresholdValue(previewA, "hallucination_risk")).toBe(0.04);
    expect(previewA.specHash).not.toBe(withoutMemory.specHash);

    const artifactsA = generateGovernanceArtifacts({
      intent,
      spec: previewA.spec,
      specHash: previewA.specHash,
      ciEnforcement: previewA.ciEnforcement,
    });
    const artifactsB = generateGovernanceArtifacts({
      intent,
      spec: previewB.spec,
      specHash: previewB.specHash,
      ciEnforcement: previewB.ciEnforcement,
    });

    expect(artifactsA.artifacts.map((artifact) => artifact.hash)).toEqual(
      artifactsB.artifacts.map((artifact) => artifact.hash),
    );
    expect(artifactsA.artifacts.map((artifact) => artifact.content)).toEqual(
      artifactsB.artifacts.map((artifact) => artifact.content),
    );

    const storedSpec = governanceDb.createGovernanceSpec({
      orgId,
      workspaceId,
      scope: "project",
      sourceIntent: intent,
      governancePlan: previewA.plan as unknown as Record<string, unknown>,
      spec: previewA.spec as unknown as Record<string, unknown>,
      specHash: previewA.specHash,
      rolloutMode: previewA.spec.rolloutMode,
      riskSummary: previewA.explainability.riskImpactSummary,
      triggeredBy: "assistant",
      actorUserId: null,
    });

    governanceDb.upsertGovernanceMemory({
      orgId,
      workspaceId,
      scope: "project",
      memoryType: "eval_baseline",
      content: { evaluation_min: 0.99, hallucination_max: 0.03 },
      confidence: 0.95,
    });

    const updatedMemory = toCompilerMemory(
      governanceDb.listGovernanceMemory(orgId, workspaceId, "project"),
    );
    const updatedPreview = compileGovernanceIntent({
      intent,
      orgId,
      workspaceId,
      scope: "project",
      memory: updatedMemory,
      defaultRolloutMode: "dry-run",
    });
    const reloadedStoredSpec = governanceDb.getGovernanceSpecById(storedSpec.id, orgId);

    expect(updatedPreview.specHash).not.toBe(previewA.specHash);
    expect(reloadedStoredSpec?.spec_hash).toBe(storedSpec.spec_hash);
    expect(reloadedStoredSpec?.version).toBe(storedSpec.version);
  });

  it("requires preview acknowledgement before apply", () => {
    const missingPreview = validateGovernanceApplyGuard({
      action: "apply",
      compiledSpecHash: "a".repeat(64),
    });
    expect(missingPreview).toEqual({
      code: "GOV_APPLY_PREVIEW_REQUIRED",
      message: "Apply requires an explicit preview acknowledgement",
      hint: "Run preview first and resubmit apply with preview_spec_hash.",
    });

    const stalePreview = validateGovernanceApplyGuard({
      action: "apply",
      compiledSpecHash: "a".repeat(64),
      previewSpecHash: "b".repeat(64),
    });
    expect(stalePreview).toEqual({
      code: "GOV_APPLY_PREVIEW_STALE",
      message: "Preview hash mismatch. Governance intent changed since preview.",
      hint: "Re-run preview and apply the latest spec hash.",
    });

    const acceptedApply = validateGovernanceApplyGuard({
      action: "apply",
      compiledSpecHash: "a".repeat(64),
      previewSpecHash: "a".repeat(64),
    });
    expect(acceptedApply).toBeNull();
  });

  it("stores artifact provenance metadata alongside deterministic hashes", () => {
    const created = governanceDb.createGovernanceArtifact({
      orgId: "org-prov",
      workspaceId: "workspace-prov",
      specId: "spec-prov",
      artifactType: "gate-config",
      artifactPath: "governance/reach.governance.json",
      contentText: "{}",
      contentHash: "artifact-hash",
      sourceIntent: "Require replay + provenance",
      governancePlan: { summary: "plan" },
      specHash: "spec-hash",
      outputHash: "artifact-hash",
      engineName: "reach.governance.codegen",
      engineVersion: "1.0.0",
      actorType: "user",
      actorUserId: "user-123",
      triggeredBy: "assistant",
    });

    expect(created.source_intent).toBe("Require replay + provenance");
    expect(created.governance_plan).toEqual({ summary: "plan" });
    expect(created.spec_hash).toBe("spec-hash");
    expect(created.output_hash).toBe("artifact-hash");
    expect(created.engine_name).toBe("reach.governance.codegen");
    expect(created.engine_version).toBe("1.0.0");
    expect(created.actor_type).toBe("user");
    expect(created.actor_user_id).toBe("user-123");
    expect(created.triggered_by).toBe("assistant");
  });
});
