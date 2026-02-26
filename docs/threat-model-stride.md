# STRIDE Threat Model for Reach

## 1. Introduction

This document provides a threat model for the Reach system using the STRIDE framework. STRIDE is a methodology for identifying and categorizing threats, an acronym for:

-   **S**poofing
-   **T**ampering
-   **R**epudiation
-   **I**nformation Disclosure
-   **D**enial of Service
-   **E**levation of Privilege

This model focuses on the core Reach CLI and its interaction with user data and the local system.

## 2. System Components

For this analysis, we decompose Reach into the following key components and trust boundaries:

-   **User's Terminal**: The shell environment where the CLI is executed.
-   **Reach CLI Binary**: The compiled, signed executable.
-   **Configuration Files**: User-provided `.reach.toml` or other policy/config files.
-   **Input/Output Data**: Files or data being processed by Reach.
-   **Release Artifact Storage**: GitHub Releases where binaries are stored.
-   **CI/CD Environment**: GitHub Actions runner.

---

## 3. Threat Analysis

| Component | Threat Category | Threat Scenario | Mitigation | Residual Risk | Roadmap/Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CLI Binary** | **Spoofing** | A user is tricked into downloading and running a malicious binary disguised as `reach`. | - Official download page with clear instructions.<br>- Signed `SHA256SUMS` file.<br>- Manual verification steps documented. | Medium | Promote `reach verify-security` command once implemented. Improve user awareness. |
| **CLI Binary** | **Tampering** | A legitimate `reach` binary is modified on disk by malware after installation. | - The CLI cannot prevent tampering of itself once on a compromised system.<br>- Determinism checks would fail if the binary is re-run against source. | High | This is an OS-level security issue. We can only provide tools for verification, not prevent the attack. |
| **Config Files** | **Tampering** | A user's policy or configuration file is maliciously altered to produce an unintended outcome. | - Reach processes the config it is given.<br>- Users should use filesystem permissions to protect configs.<br>- Storing configs in Git provides an audit trail. | Medium | Consider a `--strict` mode that warns on unexpected config keys. |
| **Release Artifacts** | **Tampering** | A release binary on GitHub is replaced with a malicious version. | - All release artifacts and their SHA256 sums are signed with `cosign`.<br>- Users are instructed to verify signatures. | Low | Requires compromise of both GitHub repository and the signing key. |
| **CLI Execution** | **Repudiation** | A user (or malicious actor) performs an action with Reach and later denies it. | - Reach is a local CLI; it has no server-side audit trail.<br>- Shell history and file modification times provide weak, client-side evidence. | High | Not in scope. Reach is not an audited, server-based system. |
| **CLI Output** | **Information Disclosure** | A bug in Reach causes it to leak sensitive information from an input file into its logs or error messages. | - Strict error handling that avoids echoing excessive context.<br>- Core logic written in Rust for memory safety.<br>- Code reviews specifically check for this. | Low | Ongoing vigilance is required. A bug could always introduce this. |
| **Config Files** | **Information Disclosure** | A user accidentally commits a configuration file containing secrets to a public Git repository. | - Documentation warns against storing secrets in config files.<br>- Recommend using environment variables for secrets. | High | This is a user practice issue. We can only guide them. |
| **CLI Binary** | **Denial of Service** | A maliciously crafted input file (e.g., a "zip bomb" if Reach processed zips) causes the CLI to crash or consume all system resources. | - Strict input parsing and validation.<br>- Resource limits on certain operations.<br>- Rust's memory safety prevents many classes of crashes. | Medium | A complex, unforeseen input could still find a parsing bug or trigger a resource-intensive edge case. |
| **CI/CD** | **Denial of Service** | An attacker submits a PR with code designed to exhaust CI resources (e.g., an infinite loop in a test). | - GitHub Actions has built-in timeouts for all jobs.<br>- Our CI scripts are designed to fail fast. | Low | Primarily mitigated by the CI provider's platform controls. |
| **CLI Execution** | **Elevation of Privilege** | A bug in the Reach CLI allows it to perform actions on the host system that the user running it is not authorized to do. | - Reach is not a privileged process; it runs with the same permissions as the user who executes it.<br>- It does not use `sudo` or other privilege escalation mechanisms. | Low | A vulnerability would need to be chained with an OS-level exploit, which is out of scope for our model. |
| **Plugins** | **Elevation of Privilege** | A malicious third-party plugin, when loaded by Reach, accesses files or network resources it shouldn't. | - Currently, plugins run with the same permissions as the core process.<br>- Documentation must clearly state the trust model for plugins. | High | This is a major gap. The roadmap includes sandboxing plugins (e.g., using WASM). |
