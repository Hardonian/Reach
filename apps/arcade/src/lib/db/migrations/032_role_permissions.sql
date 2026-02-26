-- Migration 032: Role editor with scoped custom roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  is_system_role INTEGER DEFAULT 0,
  is_custom INTEGER DEFAULT 1,
  permissions_json TEXT NOT NULL DEFAULT '[]',
  resource_scopes_json TEXT DEFAULT '{}',
  inherits_from TEXT REFERENCES roles(id),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  role_id TEXT NOT NULL REFERENCES roles(id),
  permission TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  conditions_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  assigned_by TEXT REFERENCES users(id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  UNIQUE(user_id, tenant_id, role_id)
);

-- Insert default system roles
INSERT OR IGNORE INTO roles (id, tenant_id, name, description, is_system_role, is_custom, permissions_json) VALUES
('role_admin', 'system', 'Admin', 'Full access to all resources', 1, 0, '["*"]'),
('role_editor', 'system', 'Editor', 'Can create and modify resources', 1, 0, '["read:*", "write:*", "delete:own"]'),
('role_viewer', 'system', 'Viewer', 'Read-only access', 1, 0, '["read:*"]'),
('role_security', 'system', 'Security Reviewer', 'Access to audit, compliance, and security features', 1, 0, '["read:*", "write:audit", "read:compliance", "write:policy"]'),
('role_operator', 'system', 'Platform Engineer', 'Operational access to gates, signals, and alerts', 1, 0, '["read:*", "write:gate", "write:signal", "write:alert", "read:trace"]');

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id, is_system_role);
CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_role_assignments(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_role_assignments(role_id);
