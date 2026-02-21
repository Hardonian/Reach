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
