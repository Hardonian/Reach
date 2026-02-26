# Request for External Security Audit

## 1. Introduction

Project Reach is seeking a comprehensive, third-party security audit to independently validate our security posture, identify potential vulnerabilities, and provide expert recommendations for hardening our system. As a project centered on deterministic integrity, we believe rigorous external review is critical to earning and maintaining user trust.

This document provides a proposed scope for the audit. We are open to discussion and refinement with the selected audit partner.

## 2. Audit Objectives

The primary goals of this audit are:

1.  **Identify Vulnerabilities**: Discover vulnerabilities in the Reach CLI, its core logic, its dependency tree, and its build/release process.
2.  **Validate Security Claims**: Independently verify the key security claims made in our public documentation, particularly regarding determinism, reproducible builds, and release artifact integrity.
3.  **Assess Threat Model**: Review our existing threat model for gaps and provide recommendations for improvement.
4.  **Provide Actionable Recommendations**: Deliver a clear, prioritized list of findings and concrete steps for remediation.

## 3. Proposed Scope

### 3.1. In-Scope Components

-   **Source Code**: The entire `reach` Git repository, with a focus on the Rust-based core engine (`crates/`).
-   **Build & CI/CD Pipeline**:
    -   `Dockerfile`s and build scripts.
    -   GitHub Actions workflows (`.github/workflows/`).
    -   Dependency management and locking (`Cargo.lock`, `package-lock.json`).
-   **Release Process**:
    -   Artifact generation (binaries, archives).
    -   SBOM generation.
    -   Cryptographic signing process (`cosign`).
    -   Publication to GitHub Releases.
-   **Published Artifacts**: A recent release version, including binaries, installers, signatures, and SBOM.
-   **Public Documentation**: All documents within the `docs/` directory, to check for accuracy and unsubstantiated claims.

### 3.2. Out-of-Scope Components

-   **The underlying security of GitHub.com or GitHub Actions**: We consider the hosting provider's infrastructure to be out of scope, though we are interested in how we use it.
-   **Third-Party Dependencies**: The audit should assess *our use* of dependencies, but a deep audit of the source code of every third-party crate is out of scope. Known vulnerabilities (via `cargo audit`) should be noted.
-   **The user's host environment**: The audit should focus on the application, not the security of the operating system it is run on.
-   **Social engineering attacks against the development team.**

## 4. Known Risk Areas & Focus for Audit

We request that the audit pay special attention to the following areas, which we have identified as having higher potential risk:

1.  **Plugin/Extension Architecture**: Assess the security model for loading and running external code. As this is a developing feature, we are keen on early feedback regarding sandboxing and permission models.
2.  **Determinism Implementation**: Scrutinize the core logic responsible for generating deterministic outputs. Could it be manipulated or bypassed?
3.  **Input Parsing**: The parsing of all user-supplied configuration and policy files. Could a malformed file lead to a crash, information disclosure, or arbitrary code execution?
4.  **Installer Scripts**: Review the `install.sh` script for any potential vulnerabilities.

## 5. Deliverables

We expect the following deliverables from the audit partner:

1.  **A comprehensive audit report** containing:
    -   An executive summary of the findings.
    -   A detailed description of each vulnerability found, including its impact, severity (CVSS), and steps to reproduce.
    -   Prioritized, actionable recommendations for remediation.
    -   Positive findings and validation of existing security controls.
2.  **A debriefing session** with the core development team to discuss the findings.
3.  **A re-test** of all high-severity findings after we have implemented fixes.

## 6. Provided Evidence Artifacts

We will provide the auditors with full access to:

-   Our GitHub repository.
-   Our complete suite of security documentation (the contents of `docs/`).
-   Contact with the core engineering team for questions.
