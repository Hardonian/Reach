-- Migration 033: Incident communications workflow and approval system
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')),
  status TEXT NOT NULL CHECK(status IN ('detected', 'investigating', 'mitigating', 'monitoring', 'resolved', 'postmortem')),
  
  -- Impact tracking
  affected_services_json TEXT DEFAULT '[]',
  affected_gates_json TEXT DEFAULT '[]',
  affected_signals_json TEXT DEFAULT '[]',
  
  -- Timeline
  detected_at TEXT NOT NULL,
  acknowledged_at TEXT,
  mitigated_at TEXT,
  resolved_at TEXT,
  
  -- Ownership
  created_by TEXT REFERENCES users(id),
  acknowledged_by TEXT REFERENCES users(id),
  lead_responder TEXT REFERENCES users(id),
  
  -- Postmortem
  postmortem_url TEXT,
  postmortem_status TEXT CHECK(postmortem_status IN ('pending', 'draft', 'published')),
  lessons_learned TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incident_updates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  is_public INTEGER DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incident_subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  notify_on_severity_json TEXT DEFAULT '["critical", "high"]',
  notify_on_status_change INTEGER DEFAULT 1,
  notify_on_update INTEGER DEFAULT 1,
  unsubscribe_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- What is being approved
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  proposed_changes_json TEXT NOT NULL,
  
  -- Risk assessment
  risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
  impact_summary TEXT,
  
  -- Request state
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  requested_by TEXT NOT NULL REFERENCES users(id),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- Approval chain
  approver_role_id TEXT REFERENCES roles(id),
  assigned_approver_id TEXT REFERENCES users(id),
  
  -- Resolution
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  resolution_reason TEXT,
  
  -- Timeout
  expires_at TEXT NOT NULL,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id, status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_updates ON incident_updates(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_subs_tenant ON incident_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approvals_tenant ON approval_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_resource ON approval_requests(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_approvals_expires ON approval_requests(expires_at) WHERE status = 'pending';
