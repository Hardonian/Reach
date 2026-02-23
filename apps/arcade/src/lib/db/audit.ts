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

export function listAuditEvents(tenantId: string, limit = 100, offset = 0): AuditEvent[] {
  const db = getDB();
  return db
    .prepare(
      "SELECT * FROM audit_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .all(tenantId, limit, offset) as AuditEvent[];
}
