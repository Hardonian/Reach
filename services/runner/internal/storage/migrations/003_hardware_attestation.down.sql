-- SQLite < 3.35.0 doesn't support DROP COLUMN.
-- However, for the sake of completeness in the migration suite:
ALTER TABLE nodes DROP COLUMN tpm_pub_key;
ALTER TABLE nodes DROP COLUMN hardware_fingerprint;
ALTER TABLE runs DROP COLUMN pack_cid;
