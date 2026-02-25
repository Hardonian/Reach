CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT,
  run_id TEXT,
  agent_id TEXT,
  node_id TEXT,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_run_at TIMESTAMP NOT NULL,
  leased_until TIMESTAMP,
  lease_token TEXT,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS job_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS job_results (
  job_id TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  status TEXT NOT NULL,
  last_heartbeat_at TIMESTAMP,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  load_score INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
