import { getDB } from "./connection";
import { type AuditEvent } from "./types";

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
