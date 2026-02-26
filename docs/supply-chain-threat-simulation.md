# Supply-Chain Threat Simulation

This document simulates potential supply-chain attack vectors against Reach and evaluates current mitigations and residual risks.

---

## 1. Threat Categories

### Dependency Compromise

**Attack Scenario:** A malicious update is pushed to a deep dependency (e.g., a low-level utility in the `node_modules` tree).

- **Impact:** Remote code execution (RCE) during build or runtime; exfiltration of project secrets.
- **Current Mitigation:** `npm audit`, `cargo audit`, and `verify:no-toxic-deps` scripts. Specific known toxic packages are blacklisted.
- **Residual Risk:** Zero-day dependency compromise remains the highest risk.
- **Hardening:** Pinning dependencies to specific hashes (using `package-lock.json`) and transitioning to vendor-based dependency management for critical paths.

### Malicious Contributor Injection

**Attack Scenario:** An attacker gains contributor status or compromises an existing contributor's account to introduce a subtle logic bug or a "backdoor" in the determinism core.

- **Impact:** System-wide loss of integrity; undetectable manipulation of decision logic.
- **Current Mitigation:** Mandatory peer review for all PRs; `guard-structure.ps1` to prevent unauthorized file layout changes; CI determinism gates (`verify:determinism`).
- **Residual Risk:** High-sophistication "underhanded code" that passes human review.
- **Hardening:** Require GPG-signed commits; implement multi-party approval for changes to `crates/engine-core`.

### CI Poisoning

**Attack Scenario:** An attacker compromises the GitHub Actions workflow or the secrets stored in the repository.

- **Impact:** Unauthorized release of malicious binaries; bypass of security gates.
- **Current Mitigation:** Environment protection rules; restricted repository secrets access; concurrency controls in `release.yml`.
- **Residual Risk:** Compromise of the GitHub organization itself.
- **Hardening:** Move to OIDC-based authentication for all cloud interactions; use self-hosted, hardened CI runners for release builds.

### Artifact Tampering

**Attack Scenario:** An attacker intercepts the release process or compromises the distribution server (GitHub Releases) to replace a signed binary with a malicious one.

- **Impact:** Users download and execute malware.
- **Current Mitigation:** `SHA256SUMS` manifest and `cosign` signatures. The installer scripts verify the hash before execution.
- **Residual Risk:** Users bypassing the installer and downloading raw binaries without verification.
- **Hardening:** Publicly log all release signatures to a transparency log (e.g., Rekor).

### Install Script Compromise

**Attack Scenario:** The `install.sh` or `install.ps1` script is modified to include a malicious payload.

- **Impact:** Immediate RCE on the user's machine during installation.
- **Current Mitigation:** The install scripts are part of the signed release package and are reviewed during every release cycle.
- **Residual Risk:** Attacker compromising the URL used for the initial `curl | bash` command.
- **Hardening:** Encourage users to download the signed `tar.gz` and verify manually rather than using one-liner installers.

---

## 2. "If an xz-style incident happened to Reach"

### How Audits Surface It

The Reach `security-audit.yml` runs daily. A sudden change in binary size, a new dependency inclusion, or a failure in the `verify:no-toxic-deps` firewall would be the first indicators. If the attacker introduced a non-deterministic delay or side-effect, the `verify:determinism` suite would likely fail.

### How SBOM Exposes It

The SBOM (`reach-sbom.cyclonedx.json`) captures the entire dependency tree for every release. Security researchers can use this manifest to quickly identify if a compromised version of a library has been bundled into Reach.

### How Signed Artifacts Limit Blast Radius

If a single build runner was compromised, the resulting binary might match the source but fail a secondary verification check. Because artifacts are signed, an attacker cannot silently modify a binary without breaking the `cosign` signature.

### Where Risk Remains

The primary risk remains "stealthy" logic changes. If a malicious contributor introduces code that is functionally correct but contains a hidden vulnerability (like the `xz` multi-stage payload), it is extremely difficult to detect with automated tools.

---

## 3. Practical Hardening Recommendations

1. **Mandatory Signing:** Enforce GPG signing for all commits to the `main` branch.
2. **Binary Diffing:** Implement automated binary diffing between CI versions to highlight unexpected changes in compiled output.
3. **Dependency Vendoring:** Move from remote package registries to vendored dependencies for the core Rust engine to eliminate third-party registry risk.
