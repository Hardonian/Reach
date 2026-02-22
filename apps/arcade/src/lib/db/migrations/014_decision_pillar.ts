/**
 * Migration 014: Decision Pillar - Decision Reports and Junctions
 */

export const MIGRATION_014 = `
-- Decision reports table for decision tracking
CREATE TABLE IF NOT EXISTS decision_reports (
  id                TEXT PRIMARY KEY,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  scope_keys        TEXT NOT NULL DEFAULT '{}',
  source_type       TEXT NOT NULL,
  source_ref        TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  decision_input    TEXT NOT NULL,
  decision_output   TEXT,
  decision_trace    TEXT,
  recommended_action_id TEXT,
  status            TEXT NOT NULL DEFAULT 'draft',
  outcome_status    TEXT NOT NULL DEFAULT 'unknown',
  outcome_notes     TEXT,
  calibration_delta REAL
);

-- Junctions table for critical junction events
CREATE TABLE IF NOT EXISTS junctions (
  id                TEXT PRIMARY KEY,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  junction_type     TEXT NOT NULL,
  severity_score    REAL NOT NULL DEFAULT 0,
  fingerprint       TEXT NOT NULL,
  source_type       TEXT NOT NULL,
  source_ref        TEXT NOT NULL,
  trigger_data      TEXT NOT NULL DEFAULT '{}',
  trigger_trace     TEXT NOT NULL DEFAULT '{}',
  cooldown_until    TEXT,
  deduplication_key TEXT,
  decision_report_id TEXT REFERENCES decision_reports(id),
  status            TEXT NOT NULL DEFAULT 'active'
);

-- Action intents table for governance tracking
CREATE TABLE IF NOT EXISTS action_intents (
  id                TEXT PRIMARY KEY,
  created_at        TEXT NOT NULL,
  decision_report_id TEXT NOT NULL REFERENCES decision_reports(id),
  action_type       TEXT NOT NULL,
  action_payload    TEXT NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending',
  executed_at       TEXT,
  execution_result  TEXT
);

CREATE INDEX IF NOT EXISTS idx_decision_reports_source ON decision_reports(source_type, source_ref);
CREATE INDEX IF NOT EXISTS idx_decision_reports_fingerprint ON decision_reports(input_fingerprint);
CREATE INDEX IF NOT EXISTS idx_decision_reports_status ON decision_reports(status);
CREATE INDEX IF NOT EXISTS idx_junctions_type ON junctions(junction_type);
CREATE INDEX IF NOT EXISTS idx_junctions_fingerprint ON junctions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_junctions_cooldown ON junctions(cooldown_until);
CREATE INDEX IF NOT EXISTS idx_action_intents_decision ON action_intents(decision_report_id);
`;
