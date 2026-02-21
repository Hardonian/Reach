import { getDB } from './connection';

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

