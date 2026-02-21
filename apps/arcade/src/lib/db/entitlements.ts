import { getDB } from './connection';
import { newId } from './helpers';
import { type Entitlement, type AuditEvent } from './types';

export const PLAN_LIMITS: Record<string, Omit<Partial<Entitlement>, 'id' | 'tenant_id' | 'stripe_customer_id' | 'stripe_subscription_id' | 'stripe_price_id' | 'status' | 'updated_at' | 'period_start' | 'period_end'>> = {
  free:       { plan: 'free',       runs_per_month: 100,   pack_limit: 5,   retention_days: 7  },
  pro:        { plan: 'pro',        runs_per_month: 10000, pack_limit: 100, retention_days: 90 },
  team:       { plan: 'team',       runs_per_month: 50000, pack_limit: 500, retention_days: 180 },
  enterprise: { plan: 'enterprise', runs_per_month: -1,    pack_limit: -1,  retention_days: 365 },
};

export function getEntitlement(tenantId: string): Entitlement | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM entitlements WHERE tenant_id=?').get(tenantId) as Entitlement | undefined;
}

export function upsertEntitlement(tenantId: string, patch: Partial<Entitlement>): void {
  const db = getDB();
  const now = new Date().toISOString();
  const existing = getEntitlement(tenantId);
  if (!existing) {
    const limits = PLAN_LIMITS[patch.plan ?? 'free'] ?? PLAN_LIMITS['free'];
    db.prepare(`INSERT INTO entitlements (id, tenant_id, plan, stripe_customer_id, stripe_subscription_id,
      stripe_price_id, status, runs_per_month, runs_used_this_month, pack_limit, retention_days, updated_at)
      VALUES (?,?,?,?,?,?,?,?,0,?,?,?)`)
      .run(newId('ent'), tenantId, limits.plan ?? 'free', patch.stripe_customer_id ?? null,
        patch.stripe_subscription_id ?? null, patch.stripe_price_id ?? null, patch.status ?? 'active',
        limits.runs_per_month ?? 100, limits.pack_limit ?? 5, limits.retention_days ?? 7, now);
  } else {
    db.prepare(`UPDATE entitlements SET
      plan=COALESCE(?,plan), stripe_customer_id=COALESCE(?,stripe_customer_id),
      stripe_subscription_id=COALESCE(?,stripe_subscription_id), stripe_price_id=COALESCE(?,stripe_price_id),
      status=COALESCE(?,status), runs_per_month=COALESCE(?,runs_per_month),
      pack_limit=COALESCE(?,pack_limit), retention_days=COALESCE(?,retention_days),
      period_start=COALESCE(?,period_start), period_end=COALESCE(?,period_end), updated_at=?
      WHERE tenant_id=?`)
      .run(patch.plan ?? null, patch.stripe_customer_id ?? null, patch.stripe_subscription_id ?? null,
        patch.stripe_price_id ?? null, patch.status ?? null, patch.runs_per_month ?? null,
        patch.pack_limit ?? null, patch.retention_days ?? null,
        patch.period_start ?? null, patch.period_end ?? null, now, tenantId);
  }
}

export function checkRunLimit(tenantId: string): { allowed: boolean; used: number; limit: number; plan: string } {
  const ent = getEntitlement(tenantId);
  if (!ent) return { allowed: true, used: 0, limit: 100, plan: 'free' };
  if (ent.runs_per_month === -1) return { allowed: true, used: ent.runs_used_this_month, limit: -1, plan: ent.plan };
  return {
    allowed: ent.runs_used_this_month < ent.runs_per_month,
    used: ent.runs_used_this_month,
    limit: ent.runs_per_month,
    plan: ent.plan,
  };
}

export function incrementRunUsage(tenantId: string): void {
  const db = getDB();
  db.prepare('UPDATE entitlements SET runs_used_this_month=runs_used_this_month+1 WHERE tenant_id=?').run(tenantId);
}

export function resetMonthlyUsage(tenantId: string): void {
  const db = getDB();
  db.prepare('UPDATE entitlements SET runs_used_this_month=0 WHERE tenant_id=?').run(tenantId);
}

// Audit
export function appendAudit(tenantId: string, userId: string | null, action: string, resource: string, resourceId: string, metadata: unknown, ip?: string): void {
  const db = getDB();
  db.prepare(`INSERT INTO audit_events (tenant_id, user_id, action, resource, resource_id, metadata_json, ip_address, created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(tenantId, userId ?? null, action, resource, resourceId, JSON.stringify(metadata), ip ?? null, new Date().toISOString());
}

export function listAuditEvents(tenantId: string, limit = 100, offset = 0): AuditEvent[] {
  const db = getDB();
  return db.prepare('SELECT * FROM audit_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(tenantId, limit, offset) as AuditEvent[];
}

// Webhooks
export function upsertWebhookEvent(stripeEventId: string, type: string, payloadJson: string): boolean {
  const db = getDB();
  const existing = db.prepare('SELECT id FROM webhook_events WHERE stripe_event_id=?').get(stripeEventId);
  if (existing) return false;
  db.prepare(`INSERT INTO webhook_events (id, stripe_event_id, type, payload_json, processed, created_at)
    VALUES (?,?,?,?,0,?)`)
    .run(newId('whe'), stripeEventId, type, payloadJson, new Date().toISOString());
  return true;
}

export function markWebhookProcessed(stripeEventId: string): void {
  const db = getDB();
  db.prepare('UPDATE webhook_events SET processed=1 WHERE stripe_event_id=?').run(stripeEventId);
}
