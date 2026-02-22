-- Add fingerprint column to runs table for Replay Integrity Proof
ALTER TABLE runs ADD COLUMN fingerprint TEXT DEFAULT '';
