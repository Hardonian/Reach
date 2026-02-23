import { getDB } from "./connection";
import { newId } from "./helpers";
import { type Tenant } from "./types";

export function createTenant(name: string, slug: string): Tenant {
  const db = getDB();
  const id = newId("ten");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tenants (id, name, slug, plan, created_at) VALUES (?,?,?,'free',?)`,
  ).run(id, name, slug, now);
  // Create default entitlement row
  db.prepare(
    `INSERT INTO entitlements (id, tenant_id, plan, runs_per_month, pack_limit, retention_days, updated_at)
    VALUES (?,?,'free',100,5,7,?)`,
  ).run(newId("ent"), id, now);
  return getTenant(id)!;
}

export function getTenant(id: string): Tenant | undefined {
  const db = getDB();
  return db
    .prepare("SELECT * FROM tenants WHERE id=? AND deleted_at IS NULL")
    .get(id) as Tenant | undefined;
}

export function getTenantBySlug(slug: string): Tenant | undefined {
  const db = getDB();
  return db
    .prepare("SELECT * FROM tenants WHERE slug=? AND deleted_at IS NULL")
    .get(slug) as Tenant | undefined;
}

export function listTenantsForUser(userId: string): Tenant[] {
  const db = getDB();
  return db
    .prepare(
      `
    SELECT t.* FROM tenants t
    JOIN memberships m ON m.tenant_id = t.id
    WHERE m.user_id = ? AND t.deleted_at IS NULL
  `,
    )
    .all(userId) as Tenant[];
}
