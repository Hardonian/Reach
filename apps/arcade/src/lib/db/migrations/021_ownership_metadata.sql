-- Migration 021: Add ownership and escalation metadata to gates and signals

-- Add owner and escalation fields to gates
ALTER TABLE gates ADD COLUMN owner_team TEXT;
ALTER TABLE gates ADD COLUMN owner_email TEXT;
ALTER TABLE gates ADD COLUMN escalation_email TEXT;
ALTER TABLE gates ADD COLUMN runbook_url TEXT;
ALTER TABLE gates ADD COLUMN oncall_rotation TEXT;

-- Add owner and escalation fields to signals
ALTER TABLE signals ADD COLUMN owner_team TEXT;
ALTER TABLE signals ADD COLUMN owner_email TEXT;
ALTER TABLE gates ADD COLUMN documentation_url TEXT;

-- Create ownership summary view
CREATE VIEW IF NOT EXISTS resource_ownership AS
SELECT 
  'gate' as resource_type,
  id as resource_id,
  tenant_id,
  name as resource_name,
  owner_team,
  owner_email,
  escalation_email,
  runbook_url,
  oncall_rotation,
  created_at,
  updated_at
FROM gates
UNION ALL
SELECT 
  'signal' as resource_type,
  id as resource_id,
  tenant_id,
  name as resource_name,
  owner_team,
  owner_email,
  NULL as escalation_email,
  documentation_url,
  NULL as oncall_rotation,
  created_at,
  updated_at
FROM signals;

-- Index for ownership lookups
CREATE INDEX IF NOT EXISTS idx_gates_owner ON gates(tenant_id, owner_team);
CREATE INDEX IF NOT EXISTS idx_signals_owner ON signals(tenant_id, owner_team);
