# Security Overview

Reach is designed as a secure-by-default, deterministic decision engine. We prioritize structural integrity and transparency over complex, hidden abstractions.

## Built with Deterministic Integrity

At the core of Reach is a deterministic engine implemented in Rust. Every decision, verification, and audit log is governed by cryptographic hashing. This ensures that the same inputs always produce the same outputs, and that any tampering with historical data is immediately detectable.

## Strict by Default

We follow a philosophy of minimal attack surface.

- **Schema Enforcement:** All configuration and data ingest are strictly validated against known schemas. Unknown or malformed fields are rejected.
- **Fail-Closed:** System errors result in a safe termination of execution rather than proceeding in an uncertain state.
- **Redaction:** Sensitive data is automatically redacted from logs and diagnostic reports locally, before it is ever shared.

## Signed & Verifiable Releases

Every release of Reach is built in a clean environment and cryptographically signed.

- **Transparency:** We provide a Software Bill of Materials (SBOM) for every release, allowing you to audit our dependency tree.
- **Integrity:** All binaries are shipped with SHA-256 checksums and `cosign` signatures.
- **Reproducibility:** We strive for reproducible builds, allowing third parties to verify that our distributed binaries match our public source code.

## Continuous Security Scanning

Security is integrated into our development lifecycle:

- **Dependency Audits:** We monitor our supply chain daily for new vulnerabilities.
- **Secret Scanning:** Automated tools prevent the accidental inclusion of credentials in the codebase.
- **Determinism Gates:** Our CI pipeline enforces that no non-deterministic or "theatrical" logic enters the production branch.

## Transparent Disclosure Policy

We value the work of security researchers and follow a responsible disclosure process. If you find a vulnerability, please report it to `security@reach.dev`. We commit to acknowledging your report within 72 hours and working with you to provide a timely remediation.

For technical details, please refer to our [Security Posture](./security-posture.md) and [STRIDE Threat Model](./threat-model-stride.md).
