import { getDB } from "./connection";
import { newId } from "./helpers";
import {
  type Signal,
  type SignalType,
  type MonitorRun,
  type AlertRule,
  type Scenario,
  type ScenarioRun,
  type ReportShare,
} from "./types";
import crypto from "crypto";

// Signals
function parseSignal(row: Record<string, unknown>): Signal {
  return {
    ...row,
    threshold: JSON.parse(row.threshold_json as string),
  } as Signal;
}

export function createSignal(tenantId: string, input: Partial<Signal>): Signal {
  const db = getDB();
  const id = newId("sig");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO signals (id, tenant_id, name, type, source, threshold_json, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,'enabled',?,?)`,
  ).run(
    id,
    tenantId,
    input.name,
    input.type,
    input.source ?? "webhook",
    JSON.stringify(input.threshold ?? {}),
    now,
    now,
  );
  return getSignal(id, tenantId)!;
}

export function getSignal(id: string, tenantId: string): Signal | undefined {
  const db = getDB();
  const row = db.prepare("SELECT * FROM signals WHERE id=? AND tenant_id=?").get(id, tenantId) as
    | Record<string, unknown>
    | undefined;
  return row ? parseSignal(row) : undefined;
}

export function listSignals(tenantId: string): Signal[] {
  const db = getDB();
  const rows = db
    .prepare("SELECT * FROM signals WHERE tenant_id=? ORDER BY created_at DESC")
    .all(tenantId) as Record<string, unknown>[];
  return rows.map(parseSignal);
}

export function updateSignal(id: string, tenantId: string, patch: Partial<Signal>): boolean {
  const db = getDB();
  const existing = getSignal(id, tenantId);
  if (!existing) return false;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE signals SET name=COALESCE(?,name), threshold_json=COALESCE(?,threshold_json), status=COALESCE(?,status), updated_at=? WHERE id=? AND tenant_id=?`,
  ).run(
    patch.name ?? null,
    patch.threshold ? JSON.stringify(patch.threshold) : null,
    patch.status ?? null,
    now,
    id,
    tenantId,
  );
  return true;
}

export function deleteSignal(id: string, tenantId: string): boolean {
  const db = getDB();
  const res = db.prepare("DELETE FROM signals WHERE id=? AND tenant_id=?").run(id, tenantId);
  return res.changes > 0;
}

// Monitor Runs
export function createMonitorRun(
  tenantId: string,
  signalId: string,
  value: number,
  metadata: Record<string, unknown>,
  alertTriggered: boolean,
): MonitorRun {
  const db = getDB();
  const id = newId("mnr");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO monitor_runs (id, tenant_id, signal_id, value, metadata_json, alert_triggered, created_at)
    VALUES (?,?,?,?,?,?,?)`,
  ).run(id, tenantId, signalId, value, JSON.stringify(metadata), alertTriggered ? 1 : 0, now);
  return {
    id,
    tenant_id: tenantId,
    signal_id: signalId,
    value,
    metadata,
    alert_triggered: alertTriggered,
    created_at: now,
  };
}

export function listMonitorRuns(tenantId: string, signalId?: string, limit = 100): MonitorRun[] {
  const db = getDB();
  const rows = signalId
    ? (db
        .prepare(
          "SELECT * FROM monitor_runs WHERE tenant_id=? AND signal_id=? ORDER BY created_at DESC LIMIT ?",
        )
        .all(tenantId, signalId, limit) as Record<string, unknown>[])
    : (db
        .prepare("SELECT * FROM monitor_runs WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?")
        .all(tenantId, limit) as Record<string, unknown>[]);
  return rows.map(
    (r) =>
      ({
        ...r,
        metadata: JSON.parse(r.metadata_json as string),
        alert_triggered: r.alert_triggered === 1,
      }) as MonitorRun,
  );
}

export function getMonitorHealth(tenantId: string): {
  total: number;
  alerts_today: number;
  latest_drift: number;
} {
  const db = getDB();
  const since = new Date(Date.now() - 86400000).toISOString();
  const total = (
    db.prepare("SELECT COUNT(*) as c FROM monitor_runs WHERE tenant_id=?").get(tenantId) as {
      c: number;
    }
  ).c;
  const alerts_today = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM monitor_runs WHERE tenant_id=? AND alert_triggered=1 AND created_at>?",
      )
      .get(tenantId, since) as { c: number }
  ).c;
  const driftRow = db
    .prepare(
      "SELECT value FROM monitor_runs WHERE tenant_id=? AND signal_id IN (SELECT id FROM signals WHERE tenant_id=? AND type='drift') ORDER BY created_at DESC LIMIT 1",
    )
    .get(tenantId, tenantId) as { value: number } | undefined;
  return { total, alerts_today, latest_drift: driftRow?.value ?? 0 };
}

// Alert Rules
export function createAlertRule(tenantId: string, input: Partial<AlertRule>): AlertRule {
  const db = getDB();
  const id = newId("alr");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO alert_rules (id, tenant_id, signal_id, name, channel, destination, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,'enabled',?,?)`,
  ).run(
    id,
    tenantId,
    input.signal_id ?? null,
    input.name,
    input.channel,
    input.destination,
    now,
    now,
  );
  return db.prepare("SELECT * FROM alert_rules WHERE id=?").get(id) as AlertRule;
}

export function listAlertRules(tenantId: string): AlertRule[] {
  const db = getDB();
  return db
    .prepare("SELECT * FROM alert_rules WHERE tenant_id=? ORDER BY created_at DESC")
    .all(tenantId) as AlertRule[];
}

export function updateAlertRule(
  id: string,
  tenantId: string,
  patch: {
    name?: string;
    destination?: string;
    status?: "enabled" | "disabled";
  },
): boolean {
  const db = getDB();
  const now = new Date().toISOString();
  const res = db
    .prepare(
      `UPDATE alert_rules SET name=COALESCE(?,name), destination=COALESCE(?,destination), status=COALESCE(?,status), updated_at=? WHERE id=? AND tenant_id=?`,
    )
    .run(patch.name ?? null, patch.destination ?? null, patch.status ?? null, now, id, tenantId);
  return res.changes > 0;
}

export function deleteAlertRule(id: string, tenantId: string): boolean {
  const db = getDB();
  const res = db.prepare("DELETE FROM alert_rules WHERE id=? AND tenant_id=?").run(id, tenantId);
  return res.changes > 0;
}

// Scenarios
function parseScenario(row: Record<string, unknown>): Scenario {
  return {
    ...row,
    variants: JSON.parse(row.variants_json as string),
    compare_metrics: JSON.parse(row.compare_metrics_json as string),
  } as Scenario;
}

export function createScenario(tenantId: string, input: Partial<Scenario>): Scenario {
  const db = getDB();
  const id = newId("scn");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO scenarios (id, tenant_id, name, base_run_id, variants_json, compare_metrics_json, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    tenantId,
    input.name,
    input.base_run_id ?? null,
    JSON.stringify(input.variants ?? []),
    JSON.stringify(input.compare_metrics ?? ["pass_rate", "latency", "cost"]),
    now,
    now,
  );
  return getScenario(id, tenantId)!;
}

export function getScenario(id: string, tenantId: string): Scenario | undefined {
  const db = getDB();
  const row = db.prepare("SELECT * FROM scenarios WHERE id=? AND tenant_id=?").get(id, tenantId) as
    | Record<string, unknown>
    | undefined;
  return row ? parseScenario(row) : undefined;
}

export function listScenarios(tenantId: string): Scenario[] {
  const db = getDB();
  const rows = db
    .prepare("SELECT * FROM scenarios WHERE tenant_id=? ORDER BY updated_at DESC")
    .all(tenantId) as Record<string, unknown>[];
  return rows.map(parseScenario);
}

export function updateScenario(
  id: string,
  tenantId: string,
  patch: { name?: string; variants?: unknown[]; compare_metrics?: string[] },
): boolean {
  const db = getDB();
  const existing = getScenario(id, tenantId);
  if (!existing) return false;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE scenarios SET name=COALESCE(?,name), variants_json=COALESCE(?,variants_json), compare_metrics_json=COALESCE(?,compare_metrics_json), updated_at=? WHERE id=? AND tenant_id=?`,
  ).run(
    patch.name ?? null,
    patch.variants ? JSON.stringify(patch.variants) : null,
    patch.compare_metrics ? JSON.stringify(patch.compare_metrics) : null,
    now,
    id,
    tenantId,
  );
  return true;
}

export function deleteScenario(id: string, tenantId: string): boolean {
  const db = getDB();
  const res = db.prepare("DELETE FROM scenarios WHERE id=? AND tenant_id=?").run(id, tenantId);
  return res.changes > 0;
}

export function listScenarioRuns(tenantId: string, scenarioId?: string, limit = 50): ScenarioRun[] {
  const db = getDB();
  const rows = scenarioId
    ? (db
        .prepare(
          "SELECT * FROM scenario_runs WHERE tenant_id=? AND scenario_id=? ORDER BY created_at DESC LIMIT ?",
        )
        .all(tenantId, scenarioId, limit) as Record<string, unknown>[])
    : (db
        .prepare("SELECT * FROM scenario_runs WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?")
        .all(tenantId, limit) as Record<string, unknown>[]);
  return rows.map(parseScenarioRun);
}

// Scenario Runs
function parseScenarioRun(row: Record<string, unknown>): ScenarioRun {
  return {
    ...row,
    results: JSON.parse(row.results_json as string),
  } as ScenarioRun;
}

export function createScenarioRun(tenantId: string, scenarioId: string): ScenarioRun {
  const db = getDB();
  const id = newId("scr");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO scenario_runs (id, tenant_id, scenario_id, status, results_json, created_at)
    VALUES (?,?,?,'running','[]',?)`,
  ).run(id, tenantId, scenarioId, now);
  return getScenarioRun(id, tenantId)!;
}

export function getScenarioRun(id: string, tenantId: string): ScenarioRun | undefined {
  const db = getDB();
  const row = db
    .prepare("SELECT * FROM scenario_runs WHERE id=? AND tenant_id=?")
    .get(id, tenantId) as Record<string, unknown> | undefined;
  return row ? parseScenarioRun(row) : undefined;
}

export function updateScenarioRun(id: string, tenantId: string, patch: Partial<ScenarioRun>): void {
  const db = getDB();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE scenario_runs SET status=COALESCE(?,status), results_json=COALESCE(?,results_json),
    recommendation=COALESCE(?,recommendation), finished_at=COALESCE(?,finished_at)
    WHERE id=? AND tenant_id=?`,
  ).run(
    patch.status ?? null,
    patch.results ? JSON.stringify(patch.results) : null,
    patch.recommendation ?? null,
    patch.status && patch.status !== "running" ? now : null,
    id,
    tenantId,
  );
}

// Report Shares
export function createReportShare(
  tenantId: string,
  resourceType: string,
  resourceId: string,
  expiresIn?: number,
): ReportShare {
  const db = getDB();
  const id = newId("rsh");
  const slug = crypto.randomBytes(16).toString("base64url");
  const now = new Date().toISOString();
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  db.prepare(
    `INSERT INTO report_shares (id, tenant_id, resource_type, resource_id, slug, expires_at, created_at)
    VALUES (?,?,?,?,?,?,?)`,
  ).run(id, tenantId, resourceType, resourceId, slug, expiresAt, now);
  return {
    id,
    tenant_id: tenantId,
    resource_type: resourceType,
    resource_id: resourceId,
    slug,
    expires_at: expiresAt,
    created_at: now,
  };
}

export function getReportShareBySlug(slug: string): ReportShare | undefined {
  const db = getDB();
  const row = db
    .prepare("SELECT * FROM report_shares WHERE slug=? AND (expires_at IS NULL OR expires_at > ?)")
    .get(slug, new Date().toISOString()) as ReportShare | undefined;
  return row;
}
