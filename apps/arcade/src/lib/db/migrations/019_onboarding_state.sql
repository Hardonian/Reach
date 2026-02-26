-- Migration 019: Add server-side onboarding state table
CREATE TABLE IF NOT EXISTS onboarding_state (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'skipped')),
  completed_at TEXT,
  data_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tenant_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding_state(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON onboarding_state(tenant_id);
