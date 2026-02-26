import { getDB } from "./connection";
import { newId } from "./helpers";
import { type AuditEvent } from "./types";

// --- Analytics ---
export function appendEvent(event: string, properties: Record<string, unknown>, ts: string): void {
  try {
    const db = getDB();
    db.prepare(
      "INSERT INTO analytics_events (event, properties_json, ts, created_at) VALUES (?, ?, ?, ?)",
    ).run(event, JSON.stringify(properties), ts, new Date().toISOString());
  } catch {
    // Non-blocking
  }
}

export function listEvents(
  limit = 100,
  offset = 0,
): {
  id: number;
  event: string;
  properties: Record<string, unknown>;
  ts: string;
}[] {
  const db = getDB();
  const rows = db
    .prepare(
      "SELECT id, event, properties_json, ts FROM analytics_events ORDER BY ts DESC LIMIT ? OFFSET ?",
    )
    .all(limit, offset) as {
    id: number;
    event: string;
    properties_json: string;
    ts: string;
  }[];
  return rows.map((r) => ({
    ...r,
    properties: JSON.parse(r.properties_json) as Record<string, unknown>,
  }));
}

// --- Audit ---
export function appendAudit(
  tenantId: string,
  userId: string | null,
  action: string,
  resource: string,
  resourceId: string,
  metadata: unknown,
  ip?: string,
): void {
  const db = getDB();
  db.prepare(
    `INSERT INTO audit_events (tenant_id, user_id, action, resource, resource_id, metadata_json, ip_address, created_at)
    VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    tenantId,
    userId ?? null,
    action,
    resource,
    resourceId,
    JSON.stringify(metadata),
    ip ?? null,
    new Date().toISOString(),
  );
}

export interface AuditFilter {
  action?: string;
  status?: string;
  actor?: string;
  fromDate?: string;
  toDate?: string;
  searchQuery?: string;
}

function buildWhereClause(tenantId: string, filter: AuditFilter): { clause: string; params: (string | number)[] } {
  const conditions = ["tenant_id = ?"];
  const params: (string | number)[] = [tenantId];

  if (filter.action) {
    conditions.push("action = ?");
    params.push(filter.action);
  }

  if (filter.status) {
    conditions.push("status = ?");
    params.push(filter.status);
  }

  if (filter.actor) {
    conditions.push("(user_id LIKE ? OR metadata_json LIKE ?)");
    params.push(`%${filter.actor}%`, `%${filter.actor}%`);
  }

  if (filter.fromDate) {
    conditions.push("created_at >= ?");
    params.push(filter.fromDate);
  }

  if (filter.toDate) {
    conditions.push("created_at <= ?");
    params.push(`${filter.toDate}T23:59:59.999Z`);
  }

  if (filter.searchQuery) {
    conditions.push("(action LIKE ? OR resource LIKE ? OR metadata_json LIKE ?)");
    const likeQuery = `%${filter.searchQuery}%`;
    params.push(likeQuery, likeQuery, likeQuery);
  }

  return { clause: conditions.join(" AND "), params };
}

export function listAuditEvents(
  tenantId: string,
  limit = 100,
  offset = 0,
  filter: AuditFilter = {},
): AuditEvent[] {
  const db = getDB();
  const { clause, params } = buildWhereClause(tenantId, filter);
  
  return db
    .prepare(
      `SELECT * FROM audit_events WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as AuditEvent[];
}

export function countAuditEvents(tenantId: string, filter: AuditFilter = {}): number {
  const db = getDB();
  const { clause, params } = buildWhereClause(tenantId, filter);
  
  const result = db
    .prepare(`SELECT COUNT(*) as count FROM audit_events WHERE ${clause}`)
    .get(...params) as { count: number } | undefined;
  
  return result?.count ?? 0;
}

// --- Webhooks ---
export function upsertWebhookEvent(
  stripeEventId: string,
  type: string,
  payloadJson: string,
): boolean {
  const db = getDB();
  const existing = db
    .prepare("SELECT id FROM webhook_events WHERE stripe_event_id=?")
    .get(stripeEventId);
  if (existing) return false; // already processed
  db.prepare(
    `INSERT INTO webhook_events (id, stripe_event_id, type, payload_json, processed, created_at)
    VALUES (?,?,?,?,0,?)`,
  ).run(newId("whe"), stripeEventId, type, payloadJson, new Date().toISOString());
  return true;
}

export function markWebhookProcessed(stripeEventId: string): void {
  const db = getDB();
  db.prepare("UPDATE webhook_events SET processed=1 WHERE stripe_event_id=?").run(stripeEventId);
}

// --- Onboarding ---
export function markOnboardingStep(userId: string, stepId: string): void {
  const db = getDB();
  db.prepare(
    "INSERT OR IGNORE INTO onboarding_progress (user_id, step_id, completed_at) VALUES (?, ?, ?)",
  ).run(userId, stepId, new Date().toISOString());
}

export function getOnboardingProgress(userId: string): string[] {
  const db = getDB();
  const rows = db
    .prepare("SELECT step_id FROM onboarding_progress WHERE user_id = ?")
    .all(userId) as { step_id: string }[];
  return rows.map((r) => r.step_id);
}
