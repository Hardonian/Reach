# CTO Skeptic Review: Reach Security

**Context:** This document simulates a hostile/skeptical security review by an Enterprise CTO evaluating Reach for mission-critical infrastructure.

---

## 10 Hard Questions

### Q1: "How do I know the binary I download from GitHub hasn't been backdoored between your CI and the release?"

**Answer:** Reach uses `cosign` for artifact signing. Every binary is cryptographically bound to the project's public key. The build happens in a clean GitHub Actions runner using OIDC credentials. We provide `SHA256SUMS` and an SBOM for every release. You are encouraged to verify the signature using `cosign verify`.

### Q2: "You claim '100% determinism'. If I run the same policy on two different machines and get different results, what is your liability?"

**Answer:** Reach provides determinism as a technical invariant, not a legal guarantee. Our `verify:determinism` suite tests cross-platform parity (Linux/Mac/Windows) and cross-language parity (TS/Rust). If a discrepancy is found, it is treated as a critical P0 security bug. We do not offer financial liability for drift, but we provide the tools for you to verify the integrity yourself.

### Q3: "What is your process for reacting to a 'Heartbleed' or 'xz'-level event in your dependency tree?"

**Answer:** We run daily automated security audits (`npm audit`, `cargo audit`, `osv-scanner`). Our dependency firewall blocks known toxic packages. In the event of a critical disclosure, we release a patched version within 24 hours. Because we use fixed lockfiles, we can precisely identify which versions are affected and roll back if necessary.

### Q4: "Does the Reach CLI send any telemetry or code snippets back to your servers?"

**Answer:** No. By default, Reach is entirely local and air-gapped. Telemetry is opt-in and is strictly limited to redacted usage metrics (command success/failure). No policy code, secrets, or decision logic ever leaves the local machine unless you explicitly configure a remote provider.

### Q5: "How do you handle tenant isolation in the local artifact store? Can one developer see another's decision logs?"

**Answer:** On a shared machine, Reach relies on OS-level file permissions. The local artifacts are stored in the user's home directory. Reach does not implement its own multi-tenant filesystem; we recommend using standard Linux/Windows user separation or containers for strict isolation.

### Q6: "Why should I trust your Rust engine? Rust has CVEs too."

**Answer:** We use the stable Rust toolchain and keep dependencies minimal. Most Reach-specific vulnerabilities would likely be logic errors, not memory safety issues, thanks to Rust's ownership model. We perform regular audits and fuzzing on the core engine to find edge-case crashes.

### Q7: "If your GitHub organization is compromised, can an attacker push a malicious update to all my users?"

**Answer:** Yes, this is a risk for any software project hosted on a central registry. We mitigate this through mandatory 2FA, protected branches, and signing artifacts. we are exploring the use of a secondary, offline signing key for high-severity releases to further isolate the release authority from the CI environment.

### Q8: "Your documentation mentions 'Enterprise-only' variables. Is there a backdoor in the OSS version?"

**Answer:** No. The OSS version is functionally pure. "Enterprise-only" variables enable integrations with Reach Cloud (auth, remote storage, etc.). If those variables are unset, the code paths are unreachable. We verify this via the `verify:oss` gate in every build.

### Q9: "What is your incident response time for a reported vulnerability?"

**Answer:** We acknowledge reports within 72 hours. Triage happens within 5 business days. For critical vulnerabilities, we aim for a fix within 7 days. Our public disclose policy is defined in `SECURITY.md`.

### Q10: "Can I build Reach from source myself and get the exact same binary you distribute?"

**Answer:** Nearly. We are at "High Reproducibility" for the Go and Rust components. The main source of non-determinism is the build timestamp, which we are working to eliminate. We provide the `Makefile` and instructions to reproduce our builds in an identical environment.

---

## Conclusion: Honest Limitations

Reach is built for developers who care about integrity. We are not a "black box" security solution; we are a transparent infrastructure layer. Our strengths are **determinism**, **minimalism**, and **verifiability**. Our weaknesses are typical of any modern software project: **dependency risk** and **hosting infrastructure trust**.
