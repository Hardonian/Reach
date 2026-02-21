import { getDB } from './connection';
import { newId } from './helpers';
import { type AuditEvent } from './types';

// --- Analytics ---
export function appendEvent(event: string, properties: Record<string, unknown>, ts: string): void {
  try {
    const db = getDB();
    db.prepare(
      'INSERT INTO analytics_events (event, properties_json, ts, created_at) VALUES (?, ?, ?, ?)'
    ).run(event, JSON.stringify(properties), ts, new Date().toISOString());
  } catch {
    // Non-blocking
  }
}

export function listEvents(limit = 100, offset = 0): { id: number; event: string; properties: Record<string, unknown>; ts: string }[] {
  const db = getDB();
  const rows = db.prepare(
    'SELECT id, event, properties_json, ts FROM analytics_events ORDER BY ts DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as { id: number; event: string; properties_json: string; ts: string }[];
  return rows.map((r) => ({ ...r, properties: JSON.parse(r.properties_json) as Record<string, unknown> }));
}

// --- Audit ---
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

// --- Webhooks ---
export function upsertWebhookEvent(stripeEventId: string, type: string, payloadJson: string): boolean {
  const db = getDB();
  const existing = db.prepare('SELECT id FROM webhook_events WHERE stripe_event_id=?').get(stripeEventId);
  if (existing) return false; // already processed
  db.prepare(`INSERT INTO webhook_events (id, stripe_event_id, type, payload_json, processed, created_at)
    VALUES (?,?,?,?,0,?)`)
    .run(newId('whe'), stripeEventId, type, payloadJson, new Date().toISOString());
  return true;
}

export function markWebhookProcessed(stripeEventId: string): void {
  const db = getDB();
  db.prepare('UPDATE webhook_events SET processed=1 WHERE stripe_event_id=?').run(stripeEventId);
}

// --- Onboarding ---
export function markOnboardingStep(userId: string, stepId: string): void {
  const db = getDB();
  db.prepare(
    'INSERT OR IGNORE INTO onboarding_progress (user_id, step_id, completed_at) VALUES (?, ?, ?)'
  ).run(userId, stepId, new Date().toISOString());
}

export function getOnboardingProgress(userId: string): string[] {
  const db = getDB();
  const rows = db.prepare(
    'SELECT step_id FROM onboarding_progress WHERE user_id = ?'
  ).all(userId) as { step_id: string }[];
  return rows.map((r) => r.step_id);
}
