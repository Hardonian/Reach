# Security Model

This document describes the threat model for Reach, security boundaries, and trust assumptions.

## System Overview

Reach is a deterministic execution fabric for AI systems that provides:
- Cryptographic proof of execution
- Replayable and auditable decision workflows
- Verifiable state transitions

## Trust Boundaries

### Trusted Components
1. **Deterministic Engine Core** - Rust-based core that enforces deterministic behavior
2. **Fingerprinting Layer** - SHA-256 based hashing for state verification
3. **Replay System** - Ensures identical inputs produce identical outputs

### Untrusted Components
1. **User-Provided Input** - All external input must be validated
2. **Plugin System** - Third-party plugins run in isolated capability sandbox
3. **Network Communication** - All external communication must be validated

## Threat Categories

### STRIDE Analysis

| Category | Description | Mitigation |
|----------|-------------|------------|
| **Spoofing** | Impersonating another user or system | OAuth 2.0 + mTLS for service communication |
| **Tampering** | Modifying data in transit or at rest | SHA-256 fingerprints, signed bundles |
| **Repudiation** | Denying actions took place | Immutable audit logs with cryptographic proofs |
| **Information Disclosure** | Leaking sensitive data | redact() function, no secrets in logs |
| **Denial of Service** | Making system unavailable | Rate limiting, resource quotas |
| **Elevation of Privilege** | Gaining unauthorized capabilities | Capability-based sandboxing |

## Security Controls

### Input Validation
- Strict schema validation for all configuration
- Reject unknown fields (fail-closed)
- Archive path traversal protection

### Execution Safety
- No arbitrary shell execution
- Capability-based plugin sandboxing
- Explicit working directory restrictions

### Data Protection
- Secrets never logged
- OAuth tokens redacted by default
- Stripe payloads never logged

### Supply Chain
- SBOM generated for every release (CycloneDX)
- Cosign signatures for artifact verification
- OSV scanner for dependency vulnerabilities
- Cargo audit for Rust dependencies

## Attack Surface

### Public Interfaces
1. **CLI** - User-facing command-line interface
2. **HTTP API** - REST endpoints for cloud integration
3. **Plugin Protocol** - MCP-based plugin communication

### Network Services
- Runner service (execution engine)
- Connector Registry (pack distribution)
- Integration Hub (webhook/OAuth handling)

## Security Properties

### Determinism
- Same inputs always produce same outputs
- Verified via golden vector tests
- Fuzz testing for edge cases

### Integrity
- SHA-256 fingerprints for state verification
- Signed bundles for plugin distribution
- Immutable execution traces

### Isolation
- Plugins run in capability-gated sandbox
- Tenant scope enforced for multi-tenant deployments
- Session-level access control

## Incident Response

1. **Detection** - Automated security scanning, dependency audits
2. **Triage** - Severity assessment within 72 hours
3. **Remediation** - Patch development and testing
4. **Disclosure** - Coordinated release with release notes

## Reporting Security Issues

See [SECURITY.md](../SECURITY.md) for reporting procedures.

## Security Logging

All security-relevant events are logged with:
- Timestamp (UTC)
- Event type
- Actor identity (redacted where required)
- Outcome (success/failure)

Sensitive data is never logged:
- API keys
- OAuth tokens
- Stripe payloads
- Raw environment variables
