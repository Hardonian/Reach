-- Add TPM and Hardware Attestation fields to nodes table
ALTER TABLE nodes ADD COLUMN tpm_pub_key TEXT DEFAULT '';
ALTER TABLE nodes ADD COLUMN hardware_fingerprint TEXT DEFAULT '';

-- Add PackCID to runs table for deterministic pinning
ALTER TABLE runs ADD COLUMN pack_cid TEXT DEFAULT '';
