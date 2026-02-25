-- 006: Add state_hash to snapshots for integrity verification
ALTER TABLE snapshots ADD COLUMN state_hash TEXT;
