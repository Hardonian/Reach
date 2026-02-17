CREATE TABLE IF NOT EXISTS connectors (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  version TEXT NOT NULL,
  scopes TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(id, tenant_id)
);
CREATE TABLE IF NOT EXISTS tenant_policy_profiles (
  tenant_id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
