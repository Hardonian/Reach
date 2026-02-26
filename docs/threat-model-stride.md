# STRIDE Threat Model

This document outlines the formal threat model for the Reach CLI and core engine using the STRIDE methodology.

## System Scope & Components

1. **Reach CLI (Go/TS Wrapper):** User interface for command execution.
2. **Decision Engine (Rust Core):** Cryptographic and deterministic logic.
3. **Artifact Store:** Local file system storage for event logs and snapshots.
4. **CI/CD Pipeline:** Build, test, and release infrastructure.
5. **Installers:** Direct-to-consumer deployment scripts.

---

## 1. Spoofing (Identity)

**Threat:** An attacker poses as a legitimate Reach binary or a trusted contributor.

- **Attack Vector:** Distribution of a fake `reach` binary; spoofed commits in the repository.
- **Current Controls:** `cosign` signatures on releases; developer access controlled by GitHub MFA and mandatory PR reviews.
- **Residual Risk:** Social engineering of organization administrators.
- **Hardening:** Require hardware tokens (YubiKey) for all core maintainers.

## 2. Tampering (Integrity)

**Threat:** Unauthorized modification of decision records, binaries, or configuration.

- **Attack Vector:** Modifying local `.zeo` SQLite database files; patching the `reach` binary on disk.
- **Current Controls:** Deterministic hashing of all audit records; `SHA256SUMS` verification for the binary.
- **Residual Risk:** Attacker with local root access can modify the binary and the verification tools simultaneously.
- **Hardening:** Support for OS-level integrity protection (e.g., Code Signing on macOS/Windows).

## 3. Repudiation (Auditability)

**Threat:** A user or administrator performs an action but denies it, or the system fails to log a critical event.

- **Attack Vector:** Silencing the audit logger; deleting historical logs from the artifact store.
- **Current Controls:** Append-only event logs; deterministic chain of custody for all governance decisions.
- **Residual Risk:** Erasure of logs by an attacker with filesystem access.
- **Hardening:** Implement remote append-only logging to a verified cloud substrate (OIDC-authenticated).

## 4. Information Disclosure (Privacy)

**Threat:** Exposure of sensitive configuration, secrets, or internal decision logic to unauthorized parties.

- **Attack Vector:** Secrets leaked in CI logs; unredacted diagnostic reports (`bugreport`) containing PII.
- **Current Controls:** Automated redaction in `reach bugreport`; `gitleaks` scanning in CI.
- **Residual Risk:** Accidental inclusion of sensitive data in custom policy files.
- **Hardening:** Implement local-first encryption for sensitive fields in the local database.

## 5. Denial of Service (Availability)

**Threat:** Preventing the core engine from processing decisions or making the CLI unusable.

- **Attack Vector:** Providing malformed input that triggers an infinite loop or crash in the Rust core; filling up the local disk with massive event logs.
- **Current Controls:** Rust memory safety; strict schema validation; per-entry size limits in archive ingest.
- **Residual Risk:** Resource exhaustion (CPU/Disk) through oversized policy files.
- **Hardening:** Implement strict resource quotas (memory/CPU time) for the decision engine execution.

## 6. Elevation of Privilege (Authorization)

**Threat:** An unprivileged user gaining access to administrative or "enterprise-only" features.

- **Attack Vector:** Manipulating environment variables to bypass OSS-only gates; exploiting a parser bug to execute unauthorized code.
- **Current Controls:** `verify:oss` enforcement in CI; clear code-level separation between CLI commands.
- **Residual Risk:** Flaws in the CLI's argument parsing logic that allow command injection.
- **Hardening:** Move to a capability-based security model where the CLI must explicitly register and be granted the permissions it uses.

---

## Scope Diagram Description

The Reach system forms a circular chain of integrity:

- **Source Code** is verified by **CI/CD**.
- **CI/CD** produces **Signed Artifacts**.
- **Signed Artifacts** download and verify themselves via **Installers**.
- **Installers** deploy the **CLI** to the **User Environment**.
- **CLI** generates **Deterministic Logs** which are then verified against **Source Code** invariants.

Any break in this chain (e.g., untrusted source, unsigned artifact, unverified log) results in a total loss of system trust.
