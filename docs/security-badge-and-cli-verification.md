# Security Verification: Badge and CLI Command

## 1. Introduction

To make the security and integrity of Reach more transparent and accessible, we are proposing a two-part verification system:

1.  A **Public Security Badge** that can be displayed on our repository and website, providing an at-a-glance summary of our security posture for a given release.
2.  A `reach verify-security` command-line tool that allows users to perform a comprehensive, local audit of their installation.

This document outlines the design and criteria for both components. **This is a design document; the features are not yet implemented.**

---

## 2. Public Security Badge

The security badge is a dynamic SVG image that reports the status of key security metrics for the latest release. It provides immediate, visible assurance to users and stakeholders.

### 2.1. Badge Tiers & Criteria

The badge will display a summary "Tier" based on the following criteria being met for the latest release:

**Tier 1: Foundational Integrity**
-   [✔] Release artifacts have a published `SHA256SUMS` file.
-   [✔] All release artifacts are signed with `cosign`.
-   [✔] The release commit passed all standard CI checks (lint, test).

**Tier 2: Supply Chain Awareness**
-   [✔] All Tier 1 criteria are met.
-   [✔] A Software Bill of Materials (SBOM) in CycloneDX format is published.
-   [✔] Automated dependency vulnerability scans (`cargo audit`, `npm audit`) passed with no critical vulnerabilities.

**Tier 3: Verifiable Provenance**
-   [✔] All Tier 2 criteria are met.
-   [✔] The build is reproducible (attested by a successful third-party reproduction or a self-hosted re-build verification).
-   [✔] A SLSA-compliant provenance attestation is generated and published.

### 2.2. Badge Appearance

-   The badge will clearly display the verified release version (e.g., `v1.2.3`).
-   It will show the highest achieved tier (e.g., "SECURITY TIER 2").
-   Colors will indicate status: green for success, yellow for partial success, red for failure.
-   The badge will link to the `docs/security-posture.md` document for more details.

---

## 3. CLI Command: `reach verify-security`

This command will be the primary tool for users to audit their local environment and `reach` installation. It will perform a series of checks and produce a clear, actionable report.

### 3.1. Command Design

**Command**: `reach verify-security [OPTIONS]`

**Options**:

-   `--version <TAG>`: Run verification against a specific release tag (e.g., `v1.2.3`). Defaults to the version of the running binary.
-   `--online`: Perform checks that require internet access (e.g., fetching signatures, SBOMs from GitHub).
-   `--json`: Output the report in JSON format for machine parsing.

### 3.2. Verification Steps & Logic

When executed, the command will perform the following steps:

1.  **Identify Self**: The command first identifies its own version and embedded commit hash.
2.  **Fetch Release Assets (`--online` only)**:
    -   It contacts the GitHub API to find the release corresponding to its version.
    -   It downloads the `SHA256SUMS` file, its `.sig` signature file, and the SBOM for that release.
3.  **Verify Signature (`--online` only)**:
    -   It uses a built-in `cosign`-compatible library to verify the signature of the `SHA256SUMS` file.
    -   **EXIT CODE 1** if signature is invalid.
4.  **Verify Local Binary Hash**:
    -   It computes the SHA256 hash of the running `reach` executable.
    -   It compares this local hash to the corresponding hash in the trusted `SHA256SUMS` file.
    -   **EXIT CODE 2** if the hash does not match (indicates local tampering).
5.  **Analyze Local Environment (Future)**:
    -   Check for known insecure versions of system libraries (e.g., OpenSSL).
    -   Check permissions of the `reach` binary and its config directory.
6.  **Report Generation**:
    -   It prints a human-readable report to the console (or JSON if `--json` is used).
    -   The report clearly states "PASS" or "FAIL" for each check.

### 3.3. Exit Codes

The command will use specific exit codes to signal the outcome, making it suitable for use in scripts:

-   `0`: All verification checks passed.
-   `1`: Cryptographic signature verification failed.
-   `2`: Local binary hash mismatch (file may be tampered with).
-   `3`: Network error or could not fetch release assets.
-   `4+`: Reserved for future checks.

### 3.4. Example Output

```
$ reach verify-security --online

Verifying security for reach v1.2.3...

[PASS] Fetching release assets from GitHub.
[PASS] Signature of SHA256SUMS manifest is valid.
[PASS] Local binary hash matches the official release hash.

SUCCESS: Your installation of reach has been verified.
```
