import { getDB } from "./connection";

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
