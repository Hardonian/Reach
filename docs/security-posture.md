# Security Posture (Engineering)

## 1. Security Philosophy

The Reach security model is predicated on the reduction of architectural entropy and the enforcement of deterministic execution. Security is treated as a core invariant of the system, not an overlay.

### Minimal Attack Surface

Reach follows a "minimal viable capability" model. The CLI and associated services expose the smallest possible interface necessary for operation. Unused or experimental features are disabled by default and gated behind explicit configuration flags.

### Fail-Closed Behavior

In the event of an ambiguous state, invalid input, or integrity violation, Reach components are designed to fail-closed. This includes terminating execution rather than proceeding with unverified data, especially within the determinism-critical paths.

### Deterministic Governance Integrity

Governance decisions and audit logs are hashed into a chain of custody. Any modification to historical artifacts or decision records results in an immediate verification failure, preventing silent tampering.

### Parser Strictness

Parsers for configuration (YAML/JSON) and protocol messages use strict schema validation. Unknown fields are rejected (Deny Unknown Fields), and type coercions are prohibited to prevent "weird machine" style exploitation.

### Execution Isolation

The core decision engine (Rust) is isolated from the wrapper layers. Communication occurs via well-defined, typed boundaries. Memory safety is enforced by the Rust compiler, minimizing common classes of vulnerabilities like buffer overflows.

---

## 2. Secure Defaults

### Strict Schema Validation

All configuration files (`reach.yaml`, `policy.json`, etc.) are validated against JSON Schema at load time. Partial or malformed configurations result in immediate termination.

### Deny Unknown Fields

To prevent configuration injection or bypasses, Reach enforces a "deny unknown fields" policy for all serializable structures.

### No Arbitrary Shell Execution

Reach avoids direct shell invocation. When external processes are required, they are invoked with explicit argument arrays, preventing shell injection vulnerabilities.

### Atomic File Writes

State persistence and artifact generation use atomic rename operations to prevent partial writes or race conditions that could lead to corrupted or exploitable states.

### No Secret Logging

The logging infrastructure includes automated redaction filters for sensitive patterns (keys, tokens, PII). Diagnostics and bug reports are redacted locally before transport.

### Explicit Environment Allowlists

Only a predefined set of environment variables is permitted to influence Reach behavior. External variables are ignored to prevent environment-poisoning attacks.

---

## 3. Deterministic Integrity Controls

### TS ↔ Rust Parity

Security logic implemented in both TypeScript and Rust must pass cross-language parity tests. This ensures that security boundaries are identical regardless of the execution environment.

### Golden Vectors

Reach maintains a set of "golden" test vectors that include edge cases for hashing, signing, and verification. These vectors are verified on every commit to prevent regression in security semantics.

### CI Drift Detection

Continuous integration monitors for any drift in deterministic output. Even a single bit of difference in an audit hash or artifact fingerprint triggers a high-severity alert.

---

## 4. Release Integrity

The Reach release process is designed to prevent artifact tampering and provide verifiable chain-of-custody for all binaries.

### Distribution Formats

- **tar.gz (Primary):** Canonical distribution format for Linux and macOS.
- **zip (Windows):** Standard distribution format for Windows environments.
- **tar.zst (Optional):** High-performance compression format for large-scale deployments.

### Verification Artifacts

- **SHA256SUMS:** A manifest containing the SHA-256 hashes of all release artifacts.
- **Cosign Signatures:** All releases are signed using [Cosign](https://github.com/sigstore/cosign) to provide verifiable authenticity.
- **SBOM:** A comprehensive Software Bill of Materials in CycloneDX format (`reach-sbom.cyclonedx.json`).
- **Metadata:** Every release is tagged with the precise version and commit hash, embedded into the binary at build time.

---

## 5. CI Security Controls

### Dependency Audits

Automated `npm audit` and `cargo audit` runs on every pull request. Critical and high-severity vulnerabilities block the build.

### Secret Scanning

Continuous scanning for secrets and credentials using `gitleaks` and custom pattern-based scanners (`npm run security:scan`).

### Determinism Drift Enforcement

CI gates (`gates:reality`) ensure that simulated logic or non-deterministic behavior cannot be merged into the main branch.

### SBOM Generation

Every build generates an updated SBOM to monitor the dependency tree for new risks or unlicensed packages.

---

## 6. Disclosure Policy

### SECURITY.md

The primary point of contact for security vulnerabilities is defined in [SECURITY.md](../SECURITY.md).

### Supported Versions

Only the latest stable release and the current long-term support (LTS) version receive security patches. Users are encouraged to stay current to receive mitigations.

### Responsible Disclosure

Reach follows a 90-day responsible disclosure window. Vulnerabilities should be reported to `security@reach.dev` and will be acknowledged within 72 hours.
