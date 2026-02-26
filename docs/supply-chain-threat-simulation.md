# Reach Supply Chain Threat Simulation

## 1. Introduction

The security of our users depends not only on the code we write but also on the integrity of our entire software supply chain. This document outlines potential attacks on our supply chain and the mitigations we have in place. This is a living document that is updated as new threats emerge and our defenses evolve.

## 2. Threat Analysis

We model threats based on their point of entry into our supply chain.

### Threat 1: Compromised Dependency

-   **Attack Scenario**: A malicious actor publishes a new version of a dependency that contains a backdoor, or takes over an existing unmaintained dependency. This is the most common supply chain attack vector.
-   **Specific "xz-style" Analysis**:
    -   **Vector**: An obfuscated backdoor is introduced into a core, widely-used dependency by a seemingly trusted maintainer over a long period.
    -   **Reach Mitigation**:
        1.  **Minimal Dependencies**: The core Rust engine has a minimal, carefully audited dependency set. We are less likely to pull in an obscure, un-vetted utility.
        2.  **Lockfiles**: `Cargo.lock` and `package-lock.json` prevent a malicious version from being used automatically. The update must be a deliberate act.
        3.  **CI Audits**: `cargo audit` and `npm audit` run on every PR, which would flag a *known* malicious version. This would not have caught `xz` before disclosure but is a critical layer of defense.
        4.  **Reproducible Builds**: If a malicious dependency altered build output, it would break our determinism checks, causing a build failure. This is a powerful, though indirect, defense against certain classes of tampering.
        5.  **Vendor/Cache Dependencies (Future)**: We are evaluating vendoring critical dependencies to further isolate our builds from upstream registry compromises.
-   **Residual Risk**: High. A sophisticated, previously unknown backdoor in a dependency remains a significant industry-wide threat. Our primary mitigation is a small dependency footprint and rapid patching once a vulnerability is disclosed.

### Threat 2: Compromised Build Environment (CI Poisoning)

-   **Attack Scenario**: An attacker gains access to our GitHub Actions environment and modifies the build script to inject malicious code into the final binary *after* the source code has been checked out and tested.
-   **Reach Mitigation**:
    1.  **Hardened GitHub Actions**: We enforce branch protection rules, requiring reviews for all changes, including to `.github/workflows/`.
    2.  **Third-Party Action Pinning**: We pin the versions of third-party GitHub Actions we use to a specific commit hash to prevent a malicious update to an Action from affecting our build.
    3.  **Post-Build Verification**: Our release process includes downloading the CI-built artifact and verifying its hash against a locally-reproduced build.
    4.  **Artifact Signing**: `cosign` signatures provide a final guarantee. An attacker would need to compromise both the build environment and our signing keys to succeed.
-   **Residual Risk**: Medium. Compromise of the underlying GitHub Actions infrastructure is a possibility, though unlikely.

### Threat 3: Release Artifact Tampering

-   **Attack Scenario**: An attacker with access to our release storage (e.g., GitHub Releases) replaces a legitimate binary with a compromised one after it has been built and signed.
-   **Reach Mitigation**:
    1.  **Signed Hashes**: We do not just sign the binaries; we sign the `SHA256SUMS` file. Users are instructed to first verify the signature on the hash file, then use that trusted file to verify the hash of the binary. An attacker would need to forge the signature to replace the hash file.
    2.  **Public Attestations**: Signatures and SBOMs are uploaded as immutable attestations where the platform supports it.
    3.  **Separation of Duties**: The ability to create a release is separate from the ability to generate a signature.
-   **Residual Risk**: Low. This would require compromising both our GitHub account and our signing key infrastructure.

### Threat 4: Malicious Install Script

-   **Attack Scenario**: The `install.sh` script recommended for users is compromised to perform malicious actions on the user's machine.
-   **Reach Mitigation**:
    1.  **Minimalist Script**: Our install script is designed to be simple and readable. Its only purpose is to detect the user's OS/architecture, download the correct `.tar.gz` from the official GitHub releases page, verify its hash against the signed `SHA256SUMS` file, and unpack it.
    2.  **No `sudo`**: The script installs to the user's home directory and does not require root privileges.
    3.  **User Verification**: We encourage users to inspect the script before running it via `curl | bash`.
-   **Residual Risk**: Medium. The "curl-to-bash" pattern is controversial. While we provide alternative manual download instructions, many users will prefer the convenience, trusting the source.

### Threat 5: Determinism Semantic Drift

-   **Attack Scenario**: A malicious contribution alters the logic of the determinism hashing itself, effectively "blessing" a malicious change to the core engine's output and allowing the CI checks to pass.
-   **Reach Mitigation**:
    1.  **CODEOWNERS**: The `determinism.vectors.json` file and the core hashing logic are owned by a small group of core maintainers. Changes require mandatory review from this group.
    2.  **Architectural Review**: Any change to the fundamental determinism logic is considered a major architectural change and is subject to intense scrutiny.
-   **Residual Risk**: Low. This would require collusion or a significant lapse in the review process by multiple core maintainers.
