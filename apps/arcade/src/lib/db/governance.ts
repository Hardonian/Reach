import { getDB } from "./connection";
import { newId } from "./helpers";
import type {
  GovernanceArtifact,
  GovernanceMemory,
  GovernanceScope,
  GovernanceSpecVersion,
} from "./types";

export interface GovernanceMemoryRecord {
  id: string;
  org_id: string;
  workspace_id: string;
  scope: GovernanceScope;
  memory_type: GovernanceMemory["memory_type"];
  content: Record<string, unknown>;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface GovernanceSpecRecord {
  id: string;
  org_id: string;
  workspace_id: string;
  scope: GovernanceScope;
  version: number;
  source_intent: string;
  governance_plan: Record<string, unknown>;
  spec: Record<string, unknown>;
  spec_hash: string;
  rollout_mode: "dry-run" | "enforced";
  risk_summary: string[];
  triggered_by: "user" | "assistant";
  actor_user_id: string | null;
  parent_spec_id: string | null;
  replay_link: string | null;
  created_at: string;
}

export interface GovernanceArtifactRecord {
  id: string;
  org_id: string;
  workspace_id: string;
  spec_id: string | null;
  artifact_type: string;
  artifact_path: string;
  content_text: string;
  content_hash: string;
  created_at: string;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseMemory(row: GovernanceMemory): GovernanceMemoryRecord {
  return {
    ...row,
    content: parseJson<Record<string, unknown>>(row.content_json, {}),
  };
}

function parseSpec(row: GovernanceSpecVersion): GovernanceSpecRecord {
  return {
    ...row,
    governance_plan: parseJson<Record<string, unknown>>(row.governance_plan_json, {}),
    spec: parseJson<Record<string, unknown>>(row.spec_json, {}),
    risk_summary: parseJson<string[]>(row.risk_summary_json, []),
  };
}

function parseArtifact(row: GovernanceArtifact): GovernanceArtifactRecord {
  return {
    ...row,
  };
}

function scopeSet(scope: GovernanceScope): GovernanceScope[] {
  if (scope === "global") return ["global"];
  return ["global", scope];
}

export function listGovernanceMemory(
  orgId: string,
  workspaceId: string,
  scope: GovernanceScope,
): GovernanceMemoryRecord[] {
  const db = getDB();
  const scopes = scopeSet(scope);
  const placeholders = scopes.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM governance_memory
       WHERE org_id=? AND workspace_id=? AND scope IN (${placeholders})
       ORDER BY confidence DESC, updated_at DESC, id ASC`,
    )
    .all(orgId, workspaceId, ...scopes) as GovernanceMemory[];

  return rows.map(parseMemory);
}

export function upsertGovernanceMemory(input: {
  orgId: string;
  workspaceId: string;
  scope: GovernanceScope;
  memoryType: GovernanceMemory["memory_type"];
  content: Record<string, unknown>;
  confidence: number;
}): GovernanceMemoryRecord {
  const db = getDB();
  const now = new Date().toISOString();

  const existing = db
    .prepare(
      `SELECT id FROM governance_memory
       WHERE org_id=? AND workspace_id=? AND scope=? AND memory_type=?`,
    )
    .get(input.orgId, input.workspaceId, input.scope, input.memoryType) as
    | { id: string }
    | undefined;

  if (existing) {
    db.prepare(
      `UPDATE governance_memory
       SET content_json=?, confidence=?, updated_at=?
       WHERE id=?`,
    ).run(JSON.stringify(input.content), input.confidence, now, existing.id);

    return getGovernanceMemoryById(existing.id, input.orgId)!;
  }

  const id = newId("gmem");
  db.prepare(
    `INSERT INTO governance_memory
      (id, org_id, workspace_id, scope, memory_type, content_json, confidence, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.orgId,
    input.workspaceId,
    input.scope,
    input.memoryType,
    JSON.stringify(input.content),
    input.confidence,
    now,
    now,
  );

  return getGovernanceMemoryById(id, input.orgId)!;
}

export function getGovernanceMemoryById(
  id: string,
  orgId: string,
): GovernanceMemoryRecord | undefined {
  const db = getDB();
  const row = db
    .prepare("SELECT * FROM governance_memory WHERE id=? AND org_id=?")
    .get(id, orgId) as GovernanceMemory | undefined;
  return row ? parseMemory(row) : undefined;
}

export function getLatestGovernanceSpec(
  orgId: string,
  workspaceId: string,
  scope: GovernanceScope,
): GovernanceSpecRecord | undefined {
  const db = getDB();
  const row = db
    .prepare(
      `SELECT * FROM governance_specs
       WHERE org_id=? AND workspace_id=? AND scope=?
       ORDER BY version DESC
       LIMIT 1`,
    )
    .get(orgId, workspaceId, scope) as GovernanceSpecVersion | undefined;
  return row ? parseSpec(row) : undefined;
}

export function getGovernanceSpecById(id: string, orgId: string): GovernanceSpecRecord | undefined {
  const db = getDB();
  const row = db
    .prepare("SELECT * FROM governance_specs WHERE id=? AND org_id=?")
    .get(id, orgId) as GovernanceSpecVersion | undefined;
  return row ? parseSpec(row) : undefined;
}

export function listGovernanceSpecs(input: {
  orgId: string;
  workspaceId: string;
  scope?: GovernanceScope;
  limit?: number;
}): GovernanceSpecRecord[] {
  const db = getDB();
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));

  if (input.scope) {
    const rows = db
      .prepare(
        `SELECT * FROM governance_specs
         WHERE org_id=? AND workspace_id=? AND scope=?
         ORDER BY version DESC
         LIMIT ?`,
      )
      .all(input.orgId, input.workspaceId, input.scope, limit) as GovernanceSpecVersion[];

    return rows.map(parseSpec);
  }

  const rows = db
    .prepare(
      `SELECT * FROM governance_specs
       WHERE org_id=? AND workspace_id=?
       ORDER BY created_at DESC, version DESC
       LIMIT ?`,
    )
    .all(input.orgId, input.workspaceId, limit) as GovernanceSpecVersion[];

  return rows.map(parseSpec);
}

export function createGovernanceSpec(input: {
  orgId: string;
  workspaceId: string;
  scope: GovernanceScope;
  sourceIntent: string;
  governancePlan: Record<string, unknown>;
  spec: Record<string, unknown>;
  specHash: string;
  rolloutMode: "dry-run" | "enforced";
  riskSummary: string[];
  triggeredBy: "user" | "assistant";
  actorUserId: string | null;
  replayLink?: string;
}): GovernanceSpecRecord {
  const db = getDB();
  const now = new Date().toISOString();
  const previous = getLatestGovernanceSpec(input.orgId, input.workspaceId, input.scope);
  const nextVersion = (previous?.version ?? 0) + 1;
  const id = newId("gspec");
  const replayLink = input.replayLink ?? `/api/v1/governance/specs/${id}/replay`;

  db.prepare(
    `INSERT INTO governance_specs
      (id, org_id, workspace_id, scope, version, source_intent, governance_plan_json, spec_json, spec_hash,
       rollout_mode, risk_summary_json, triggered_by, actor_user_id, parent_spec_id, replay_link, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.orgId,
    input.workspaceId,
    input.scope,
    nextVersion,
    input.sourceIntent,
    JSON.stringify(input.governancePlan),
    JSON.stringify(input.spec),
    input.specHash,
    input.rolloutMode,
    JSON.stringify(input.riskSummary),
    input.triggeredBy,
    input.actorUserId,
    previous?.id ?? null,
    replayLink,
    now,
  );

  return getGovernanceSpecById(id, input.orgId)!;
}

export function createGovernanceArtifact(input: {
  orgId: string;
  workspaceId: string;
  specId: string | null;
  artifactType: string;
  artifactPath: string;
  contentText: string;
  contentHash: string;
}): GovernanceArtifactRecord {
  const db = getDB();
  const id = newId("gart");
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO artifacts
      (id, org_id, workspace_id, spec_id, artifact_type, artifact_path, content_text, content_hash, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.orgId,
    input.workspaceId,
    input.specId,
    input.artifactType,
    input.artifactPath,
    input.contentText,
    input.contentHash,
    now,
  );

  return getGovernanceArtifactById(id, input.orgId)!;
}

export function listGovernanceArtifacts(input: {
  orgId: string;
  workspaceId: string;
  specId?: string;
}): GovernanceArtifactRecord[] {
  const db = getDB();

  const rows = input.specId
    ? (db
        .prepare(
          `SELECT * FROM artifacts
           WHERE org_id=? AND workspace_id=? AND spec_id=?
           ORDER BY artifact_type ASC, artifact_path ASC`,
        )
        .all(input.orgId, input.workspaceId, input.specId) as GovernanceArtifact[])
    : (db
        .prepare(
          `SELECT * FROM artifacts
           WHERE org_id=? AND workspace_id=?
           ORDER BY created_at DESC, artifact_type ASC`,
        )
        .all(input.orgId, input.workspaceId) as GovernanceArtifact[]);

  return rows.map(parseArtifact);
}

export function getGovernanceArtifactById(
  id: string,
  orgId: string,
): GovernanceArtifactRecord | undefined {
  const db = getDB();
  const row = db.prepare("SELECT * FROM artifacts WHERE id=? AND org_id=?").get(id, orgId) as
    | GovernanceArtifact
    | undefined;

  return row ? parseArtifact(row) : undefined;
}
