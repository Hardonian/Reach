-- Migration 022: Add executive digest reporting system
CREATE TABLE IF NOT EXISTS executive_digests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  
  -- Digest configuration
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK(day_of_week BETWEEN 0 AND 6), -- 0=Sunday, for weekly
  day_of_month INTEGER CHECK(day_of_month BETWEEN 1 AND 31), -- for monthly
  time_of_day TEXT NOT NULL DEFAULT '09:00', -- HH:MM format
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  
  -- Content configuration
  include_sections TEXT NOT NULL DEFAULT 'summary,gates,signals,audit,compliance',
  compare_to_previous BOOLEAN DEFAULT 1,
  highlight_anomalies BOOLEAN DEFAULT 1,
  
  -- Recipients
  recipient_emails TEXT NOT NULL, -- JSON array of email addresses
  
  -- Status
  is_active BOOLEAN DEFAULT 1,
  last_sent_at TEXT,
  next_scheduled_at TEXT,
  
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Store generated digest content
CREATE TABLE IF NOT EXISTS digest_executions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  digest_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  
  -- Generation status
  status TEXT NOT NULL CHECK(status IN ('pending', 'generating', 'sent', 'failed')),
  generated_at TEXT,
  sent_at TEXT,
  
  -- Content (compressed/encrypted for large reports)
  summary_json TEXT, -- Key metrics summary
  full_report_url TEXT, -- Link to full report storage
  
  -- Delivery tracking
  recipient_count INTEGER,
  delivered_count INTEGER,
  failed_count INTEGER,
  
  -- Error tracking
  error_message TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_digests_tenant ON executive_digests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_digests_active ON executive_digests(is_active, next_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_digest_exec_digest ON digest_executions(digest_id);
CREATE INDEX IF NOT EXISTS idx_digest_exec_status ON digest_executions(status);
