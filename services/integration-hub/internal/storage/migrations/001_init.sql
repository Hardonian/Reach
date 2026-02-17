CREATE TABLE IF NOT EXISTS oauth_tokens (tenant_id TEXT NOT NULL, provider TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT, expires_at TEXT, scopes TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(tenant_id, provider));
CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS webhook_secrets (tenant_id TEXT NOT NULL, provider TEXT NOT NULL, secret TEXT NOT NULL, PRIMARY KEY(tenant_id, provider));
CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider TEXT NOT NULL, event_type TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider TEXT NOT NULL, trigger_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS replay_guard (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, created_at TEXT NOT NULL);
