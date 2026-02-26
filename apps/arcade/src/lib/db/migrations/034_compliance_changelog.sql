-- Migration 034: Signed compliance exports and reality-based changelog
CREATE TABLE IF NOT EXISTS compliance_exports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- Export configuration
  export_type TEXT NOT NULL CHECK(export_type IN ('audit', 'policy', 'gate_history', 'full_compliance', 'custom')),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Date range
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  
  -- Status and file
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'generating', 'ready', 'failed', 'expired')),
  file_url TEXT,
  file_size_bytes INTEGER,
  
  -- Contents manifest
  manifest_json TEXT NOT NULL DEFAULT '{}',
  included_tables_json TEXT DEFAULT '[]',
  row_count INTEGER,
  
  -- Digital signature for integrity
  signature TEXT,
  signature_algorithm TEXT DEFAULT 'SHA256-RSA',
  signed_by TEXT REFERENCES users(id),
  signed_at TEXT,
  
  -- Verification
  verification_hash TEXT,
  expires_at TEXT,
  
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS changelog_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT REFERENCES tenants(id),
  
  -- Version info
  version TEXT NOT NULL,
  version_tag TEXT,
  
  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('feature', 'fix', 'security', 'performance', 'breaking', 'deprecation', 'docs')),
  
  -- Source tracking (reality-based)
  source_migration_id TEXT,
  source_commit_sha TEXT,
  source_pr_number INTEGER,
  source_feature_flag TEXT,
  source_author TEXT,
  
  -- Metadata
  affected_components_json TEXT DEFAULT '[]',
  breaking_change_details TEXT,
  migration_required INTEGER DEFAULT 0,
  
  -- Publication
  is_published INTEGER DEFAULT 0,
  published_at TEXT,
  published_by TEXT REFERENCES users(id),
  
  -- Auto-generation tracking
  auto_generated INTEGER DEFAULT 0,
  generation_source TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS changelog_drafts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT REFERENCES tenants(id),
  
  -- Draft content
  title TEXT NOT NULL,
  description TEXT,
  
  -- Auto-detected changes
  detected_migrations_json TEXT DEFAULT '[]',
  detected_commits_json TEXT DEFAULT '[]',
  detected_api_changes_json TEXT DEFAULT '[]',
  
  -- Review state
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'reviewing', 'approved', 'rejected')),
  reviewer_notes TEXT,
  
  -- Published version reference
  published_entry_id TEXT REFERENCES changelog_entries(id),
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_exports_tenant ON compliance_exports(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_exports_status ON compliance_exports(status);
CREATE INDEX IF NOT EXISTS idx_changelog_tenant ON changelog_entries(tenant_id, is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_version ON changelog_entries(version);
CREATE INDEX IF NOT EXISTS idx_changelog_source ON changelog_entries(source_commit_sha, source_migration_id);
CREATE INDEX IF NOT EXISTS idx_changelog_drafts ON changelog_drafts(tenant_id, status);
