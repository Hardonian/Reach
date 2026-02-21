import { getDB } from './connection';
import { newId } from './helpers';

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
