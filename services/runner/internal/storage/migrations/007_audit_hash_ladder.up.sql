ALTER TABLE audit ADD COLUMN chain_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_chain_hash ON audit(chain_hash);
