# Reproducible Builds Strategy

## 1. Definition of Reproducibility for Reach

For Reach, a build is considered reproducible if, given the same source code, environment, and toolchain version, the resulting binary is identical. Our objective is to allow any third party to verify that the binaries distributed by the Reach project were built directly from the public source code without modifications.

---

## 2. Lockfile Discipline

Strict adherence to lockfiles is mandatory across all ecosystems:

- **npm:** `package-lock.json` is checked into the repository and enforced in CI using `npm ci`.
- **Rust:** `Cargo.lock` ensures deterministic dependency resolution for the core engine.
- **Go:** `go.sum` tracks the checksums of all Go modules used in the runner.

Any change to a lockfile must be accompanied by a justification and pass a full security audit gate.

---

## 3. Rust Toolchain Determinism

The Reach core engine is built using stable Rust. We use a fixed version defined in `rust-toolchain.toml` to ensure consistent code generation. The build process avoids non-deterministic features like macros that rely on build-time timestamps or environment-specific paths.

---

## 4. Node Build Determinism

Node.js builds (for the SDK and frontend) are notoriously difficult to reproduce bit-for-bit. Reach mitigates this by:

- Using fixed Node.js versions in `.node-version`.
- Stripping source maps from production bundles to hide build-path leakage.
- Enforcing consistent ordering in JSON serialization during build steps.

---

## 5. Embedded Metadata

Every Reach binary embeds the following metadata:

- **Version:** Semantic version number (e.g., `0.3.3`).
- **Commit Hash:** The 8-character SHA of the git commit.
- **Build Date:** The UTC timestamp of the build (this is the primary source of non-determinism and we are moving toward a constant "source date epoch").

Currently, binaries are reproducible except for the build time metadata. Future iterations will adopt `SOURCE_DATE_EPOCH` to eliminate this delta.

---

## 6. Artifact Reproducibility Expectations

| Component | Reproducibility Status | Scope |
| :--- | :--- | :--- |
| **Go Runner** | High | Built with `-trimpath` to remove host-specific file paths. |
| **Rust Core** | High | Deterministic compilation enabled. |
| **WASM Core** | Medium | Depends on toolchain alignment. |
| **JS Bundles** | Low | Significant "bundle noise" from minifiers and build IDs. |

---

## 7. CI Environment Cleanliness

Release builds are performed in a clean, isolated GitHub Actions environment. No local state or cached artifacts from previous builds are allowed to persist. The build environment is defined strictly by the `release.yml` workflow.

---

## 8. SBOM + Signature Workflow

1. **Build:** Binaries are compiled across the platform matrix.
2. **Scan:** `osv-scanner` checks for vulnerabilities.
3. **SBOM:** `anchore/sbom-action` generates a CycloneDX manifest.
4. **Digest:** `sha256sum` generates the `SHA256SUMS` manifest.
5. **Sign:** `cosign` signs the binaries and the manifest against the project's public key.
6. **Publish:** Artifacts, SBOMs, and signatures are uploaded to the GitHub Release.

---

## 9. Future Roadmap

- **Full Bit-for-Bit Reproducibility:** Implementation of `SOURCE_DATE_EPOCH` across all build steps.
- **Binary Attestation:** Implementation of SLSA (Supply-chain Levels for Software Artifacts) Level 3 provenance.
- **Independent Verification Bot:** A public CI runner that independently rebuilds releases and publishes a "Reproducibility Status" report.
