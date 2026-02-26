import { getDB } from "./connection";
import { newId } from "./helpers";
import {
  type Gate,
  type GateRun,
  type GithubInstallation,
  type CiIngestRun,
  type GateReport,
} from "./types";

function parseGate(row: Record<string, unknown>): Gate {
  return {
    ...row,
    trigger_types: JSON.parse(row.trigger_types as string),
    required_checks: JSON.parse(row.required_checks as string),
    thresholds: JSON.parse(row.thresholds as string),
  } as Gate;
}

export function createGate(tenantId: string, input: Partial<Gate>): Gate {
  const db = getDB();
  const id = newId("gat");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO gates (id, tenant_id, name, repo_owner, repo_name, default_branch, trigger_types, required_checks, thresholds, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,'enabled',?,?)`,
  ).run(
    id,
    tenantId,
    input.name,
    input.repo_owner,
    input.repo_name,
    input.default_branch ?? "main",
    JSON.stringify(input.trigger_types ?? ["pr", "push"]),
    JSON.stringify(input.required_checks ?? []),
    JSON.stringify(input.thresholds ?? { pass_rate: 1.0, max_violations: 0 }),
    now,
    now,
  );
  return getGate(id, tenantId)!;
}

export function getGate(id: string, tenantId: string): Gate | undefined {
  const db = getDB();
  const row = db.prepare("SELECT * FROM gates WHERE id=? AND tenant_id=?").get(id, tenantId) as
    | Record<string, unknown>
    | undefined;
  return row ? parseGate(row) : undefined;
}

export function listGates(tenantId: string): Gate[] {
  const db = getDB();
  const rows = db
    .prepare("SELECT * FROM gates WHERE tenant_id=? ORDER BY created_at DESC")
    .all(tenantId) as Record<string, unknown>[];
  return rows.map(parseGate);
}

export function updateGate(id: string, tenantId: string, patch: Partial<Gate>): boolean {
  const db = getDB();
  const existing = getGate(id, tenantId);
  if (!existing) return false;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE gates SET name=?,default_branch=?,trigger_types=?,required_checks=?,thresholds=?,status=?,updated_at=? WHERE id=? AND tenant_id=?`,
  ).run(
    patch.name ?? existing.name,
    patch.default_branch ?? existing.default_branch,
    JSON.stringify(patch.trigger_types ?? existing.trigger_types),
    JSON.stringify(patch.required_checks ?? existing.required_checks),
    JSON.stringify(patch.thresholds ?? existing.thresholds),
    patch.status ?? existing.status,
    now,
    id,
    tenantId,
  );
  return true;
}

export interface GateVersion {
  version: number;
  gate_id: string;
  tenant_id: string;
  name: string;
  repo_owner: string;
  repo_name: string;
  default_branch: string;
  trigger_types: string[];
  required_checks: string[];
  thresholds: Record<string, unknown>;
  status: string;
  created_at: string;
  created_by: string | null;
  change_reason: string | null;
}

export function createGateVersion(
  gateId: string,
  tenantId: string,
  gate: Gate,
  createdBy: string | null,
  changeReason: string | null,
): void {
  const db = getDB();
  const now = new Date().toISOString();
  
  // Get next version number
  const result = db
    .prepare("SELECT MAX(version) as max_version FROM gate_versions WHERE gate_id=? AND tenant_id=?")
    .get(gateId, tenantId) as { max_version: number | null } | undefined;
  const version = (result?.max_version ?? 0) + 1;
  
  db.prepare(
    `INSERT INTO gate_versions (gate_id, tenant_id, version, name, repo_owner, repo_name, default_branch,
     trigger_types, required_checks, thresholds, status, created_at, created_by, change_reason)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    gateId,
    tenantId,
    version,
    gate.name,
    gate.repo_owner,
    gate.repo_name,
    gate.default_branch,
    JSON.stringify(gate.trigger_types),
    JSON.stringify(gate.required_checks),
    JSON.stringify(gate.thresholds),
    gate.status,
    now,
    createdBy,
    changeReason,
  );
}

export function listGateVersions(gateId: string, tenantId: string, limit = 50): GateVersion[] {
  const db = getDB();
  const rows = db
    .prepare(
      `SELECT * FROM gate_versions WHERE gate_id=? AND tenant_id=? ORDER BY version DESC LIMIT ?`,
    )
    .all(gateId, tenantId, limit) as Array<{
      gate_id: string;
      tenant_id: string;
      version: number;
      name: string;
      repo_owner: string;
      repo_name: string;
      default_branch: string;
      trigger_types: string;
      required_checks: string;
      thresholds: string;
      status: string;
      created_at: string;
      created_by: string | null;
      change_reason: string | null;
    }>;
  
  return rows.map((r) => ({
    ...r,
    trigger_types: JSON.parse(r.trigger_types),
    required_checks: JSON.parse(r.required_checks),
    thresholds: JSON.parse(r.thresholds),
  }));
}

export function getGateVersion(
  gateId: string,
  tenantId: string,
  version: number,
): GateVersion | undefined {
  const db = getDB();
  const row = db
    .prepare("SELECT * FROM gate_versions WHERE gate_id=? AND tenant_id=? AND version=?")
    .get(gateId, tenantId, version) as
    | {
        gate_id: string;
        tenant_id: string;
        version: number;
        name: string;
        repo_owner: string;
        repo_name: string;
        default_branch: string;
        trigger_types: string;
        required_checks: string;
        thresholds: string;
        status: string;
        created_at: string;
        created_by: string | null;
        change_reason: string | null;
      }
    | undefined;
  
  if (!row) return undefined;
  return {
    ...row,
    trigger_types: JSON.parse(row.trigger_types),
    required_checks: JSON.parse(row.required_checks),
    thresholds: JSON.parse(row.thresholds),
  };
}

export function rollbackGate(
  gateId: string,
  tenantId: string,
  targetVersion: number,
  reason: string,
  userId: string,
): boolean {
  const db = getDB();
  const target = getGateVersion(gateId, tenantId, targetVersion);
  if (!target) return false;
  
  // Create a snapshot of current state before rollback
  const current = getGate(gateId, tenantId);
  if (current) {
    createGateVersion(gateId, tenantId, current, userId, `Pre-rollback to version ${targetVersion}`);
  }
  
  // Apply the target version configuration
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE gates SET name=?,default_branch=?,trigger_types=?,required_checks=?,thresholds=?,status=?,updated_at=? WHERE id=? AND tenant_id=?`,
  ).run(
    target.name,
    target.default_branch,
    JSON.stringify(target.trigger_types),
    JSON.stringify(target.required_checks),
    JSON.stringify(target.thresholds),
    target.status,
    now,
    gateId,
    tenantId,
  );
  
  // Record the rollback as a new version
  const rolledBackGate = getGate(gateId, tenantId);
  if (rolledBackGate) {
    createGateVersion(gateId, tenantId, rolledBackGate, userId, `Rollback to version ${targetVersion}: ${reason}`);
  }
  
  return true;
}

export function deleteGate(id: string, tenantId: string): boolean {
  const db = getDB();
  const res = db.prepare("DELETE FROM gates WHERE id=? AND tenant_id=?").run(id, tenantId);
  return res.changes > 0;
}

export function findGatesByRepo(
  repoOwner: string,
  repoName: string,
): Array<{ gateId: string; tenantId: string }> {
  const db = getDB();
  const rows = db
    .prepare(
      `SELECT id, tenant_id FROM gates WHERE repo_owner=? AND repo_name=? AND status='enabled'`,
    )
    .all(repoOwner, repoName) as Array<{ id: string; tenant_id: string }>;
  return rows.map((r) => ({ gateId: r.id, tenantId: r.tenant_id }));
}

function parseGateRun(row: Record<string, unknown>): GateRun {
  return { ...row, report: JSON.parse(row.report_json as string) } as GateRun;
}

export function createGateRun(tenantId: string, gateId: string, input: Partial<GateRun>): GateRun {
  const db = getDB();
  const id = newId("gtr");
  const now = new Date().toISOString();
  const emptyReport: GateReport = {
    verdict: "failed",
    pass_rate: 0,
    violations: 0,
    findings: [],
    summary: "Running…",
  };
  db.prepare(
    `INSERT INTO gate_runs (id, tenant_id, gate_id, status, trigger_type, commit_sha, pr_number, branch, report_json, created_at)
    VALUES (?,?,?,'running',?,?,?,?,?,?)`,
  ).run(
    id,
    tenantId,
    gateId,
    input.trigger_type ?? "manual",
    input.commit_sha ?? null,
    input.pr_number ?? null,
    input.branch ?? null,
    JSON.stringify(emptyReport),
    now,
  );
  return getGateRun(id, tenantId)!;
}

export function getGateRun(id: string, tenantId: string): GateRun | undefined {
  const db = getDB();
  const row = db.prepare("SELECT * FROM gate_runs WHERE id=? AND tenant_id=?").get(id, tenantId) as
    | Record<string, unknown>
    | undefined;
  return row ? parseGateRun(row) : undefined;
}

export function updateGateRun(
  id: string,
  tenantId: string,
  patch: Partial<GateRun & { report: GateReport }>,
): void {
  const db = getDB();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE gate_runs SET status=COALESCE(?,status), report_json=COALESCE(?,report_json),
    github_check_run_id=COALESCE(?,github_check_run_id), workflow_run_id=COALESCE(?,workflow_run_id),
    finished_at=COALESCE(?,finished_at)
    WHERE id=? AND tenant_id=?`,
  ).run(
    patch.status ?? null,
    patch.report ? JSON.stringify(patch.report) : null,
    patch.github_check_run_id ?? null,
    patch.workflow_run_id ?? null,
    patch.finished_at ?? (patch.status && patch.status !== "running" ? now : null),
    id,
    tenantId,
  );
}

export function listGateRuns(tenantId: string, gateId?: string, limit = 50): GateRun[] {
  const db = getDB();
  const rows = gateId
    ? (db
        .prepare(
          "SELECT * FROM gate_runs WHERE tenant_id=? AND gate_id=? ORDER BY created_at DESC LIMIT ?",
        )
        .all(tenantId, gateId, limit) as Record<string, unknown>[])
    : (db
        .prepare("SELECT * FROM gate_runs WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?")
        .all(tenantId, limit) as Record<string, unknown>[]);
  return rows.map(parseGateRun);
}

export function upsertGithubInstallation(tenantId: string, input: any): GithubInstallation {
  const db = getDB();
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      "SELECT id FROM github_installations WHERE tenant_id=? AND repo_owner=? AND repo_name=?",
    )
    .get(tenantId, input.repo_owner, input.repo_name) as { id: string } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE github_installations SET installation_id=COALESCE(?,installation_id),
      access_token=COALESCE(?,access_token), token_expires_at=COALESCE(?,token_expires_at), updated_at=?
      WHERE id=?`,
    ).run(
      input.installation_id ?? null,
      input.access_token ?? null,
      input.token_expires_at ?? null,
      now,
      existing.id,
    );
    return db
      .prepare("SELECT * FROM github_installations WHERE id=?")
      .get(existing.id) as GithubInstallation;
  }
  const id = newId("ghi");
  db.prepare(
    `INSERT INTO github_installations (id, tenant_id, installation_id, access_token, token_expires_at, repo_owner, repo_name, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    tenantId,
    input.installation_id ?? null,
    input.access_token ?? null,
    input.token_expires_at ?? null,
    input.repo_owner,
    input.repo_name,
    now,
    now,
  );
  return db.prepare("SELECT * FROM github_installations WHERE id=?").get(id) as GithubInstallation;
}

export function getGithubInstallation(
  tenantId: string,
  repoOwner: string,
  repoName: string,
): GithubInstallation | undefined {
  const db = getDB();
  return db
    .prepare(
      "SELECT * FROM github_installations WHERE tenant_id=? AND repo_owner=? AND repo_name=?",
    )
    .get(tenantId, repoOwner, repoName) as GithubInstallation | undefined;
}

export function createCiIngestRun(tenantId: string, input: any): CiIngestRun {
  const db = getDB();
  const id = newId("cir");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO ci_ingest_runs (id, tenant_id, workspace_key, commit_sha, branch, pr_number, actor, ci_provider, artifacts_json, run_metadata, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    tenantId,
    input.workspace_key ?? null,
    input.commit_sha ?? null,
    input.branch ?? null,
    input.pr_number ?? null,
    input.actor ?? null,
    input.ci_provider ?? "github",
    JSON.stringify(input.artifacts ?? {}),
    JSON.stringify(input.run_metadata ?? {}),
    now,
  );
  const row = db.prepare("SELECT * FROM ci_ingest_runs WHERE id=?").get(id) as Record<
    string,
    unknown
  >;
  return {
    ...row,
    artifacts: JSON.parse(row.artifacts_json as string),
    run_metadata: JSON.parse(row.run_metadata as string),
  } as CiIngestRun;
}

export function associateCiIngestToGateRun(ciRunId: string, gateRunId: string): void {
  const db = getDB();
  db.prepare("UPDATE ci_ingest_runs SET gate_run_id=?, status=? WHERE id=?").run(
    gateRunId,
    "processed",
    ciRunId,
  );
}

export function listCiIngestRuns(tenantId: string, limit = 50): CiIngestRun[] {
  const db = getDB();
  const rows = db
    .prepare("SELECT * FROM ci_ingest_runs WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?")
    .all(tenantId, limit) as Record<string, unknown>[];
  return rows.map(
    (r) =>
      ({
        ...r,
        artifacts: JSON.parse(r.artifacts_json as string),
        run_metadata: JSON.parse(r.run_metadata as string),
      }) as CiIngestRun,
  );
}
