-- Migration 020: Add alert delivery ledger for reliability tracking
CREATE TABLE IF NOT EXISTS alert_delivery_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  alert_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('email', 'slack', 'webhook', 'pagerduty', 'sms')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'suppressed')),
  
  -- Request/response tracking
  request_body TEXT,
  response_status INTEGER,
  response_body TEXT,
  
  -- Timing
  attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TEXT,
  
  -- Error details for failure analysis
  error_code TEXT,
  error_message TEXT,
  error_category TEXT CHECK(error_category IN ('network', 'auth', 'rate_limit', 'invalid_address', 'server_error', 'unknown')),
  
  -- Runbook/escalation
  escalation_triggered BOOLEAN DEFAULT 0,
  escalation_reason TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_alert_delivery_alert ON alert_delivery_log(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_delivery_tenant ON alert_delivery_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_delivery_status ON alert_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_alert_delivery_channel ON alert_delivery_log(channel);
CREATE INDEX IF NOT EXISTS idx_alert_delivery_retry ON alert_delivery_log(status, next_retry_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_alert_delivery_attempted ON alert_delivery_log(attempted_at);

-- View for failed deliveries requiring attention
CREATE VIEW IF NOT EXISTS alert_delivery_failures AS
SELECT 
  d.*,
  a.severity as alert_severity,
  a.title as alert_title,
  CASE 
    WHEN d.retry_count >= d.max_retries THEN 'requires_manual_intervention'
    WHEN d.error_category = 'rate_limit' THEN 'will_retry'
    WHEN d.error_category = 'network' THEN 'will_retry'
    ELSE 'requires_manual_intervention'
  END as recommended_action
FROM alert_delivery_log d
LEFT JOIN alerts a ON d.alert_id = a.id
WHERE d.status = 'failed';
