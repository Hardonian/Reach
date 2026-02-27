# Security Model

Reach runner enforces tenant isolation via authenticated sessions and tenant-scoped storage queries. Sensitive operations are capability-checked and audited. Logs redact secret-like fields and can suppress sensitive tool outputs.
