CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  last_event_id INTEGER NOT NULL,
  state_payload BLOB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY(run_id) REFERENCES runs(id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_run_created ON snapshots(run_id, created_at);
