-- Migration 031: Monitoring trends and SLO burn tracking
CREATE TABLE IF NOT EXISTS slo_definitions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('gate', 'signal', 'workflow', 'tenant')),
  resource_id TEXT,
  metric_type TEXT NOT NULL CHECK(metric_type IN ('availability', 'latency', 'error_rate', 'throughput', 'custom')),
  target_value REAL NOT NULL,
  target_unit TEXT NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 30,
  burn_rate_alert_threshold REAL DEFAULT 2.0,
  is_active INTEGER DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slo_measurements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slo_id TEXT NOT NULL REFERENCES slo_definitions(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  actual_value REAL NOT NULL,
  target_value REAL NOT NULL,
  error_budget_remaining REAL NOT NULL,
  error_budget_burn_rate REAL NOT NULL,
  is_breaching INTEGER DEFAULT 0,
  measurements_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS monitoring_trends (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  metric_name TEXT NOT NULL,
  metric_category TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  timestamp TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  metadata_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_slo_def_tenant ON slo_definitions(tenant_id, resource_type, is_active);
CREATE INDEX IF NOT EXISTS idx_slo_meas_slo ON slo_measurements(slo_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_slo_meas_breach ON slo_measurements(is_breaching, created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_trends ON monitoring_trends(tenant_id, metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_resource ON monitoring_trends(tenant_id, resource_type, resource_id, timestamp DESC);
