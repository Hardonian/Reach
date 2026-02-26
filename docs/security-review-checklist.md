# Security Review Checklist

This document is intended for internal developers to perform a self-review of their changes before submitting a pull request, and for reviewers to use during the formal code review process. Ticking these boxes does not replace a formal security audit but serves as a critical first line of defense.

---

## Developer Self-Review Checklist

Before submitting your PR, please perform the following checks on your own code.

### 1. Input and Data Handling
-   [ ] **Validation**: Is all untrusted input (from files, command-line arguments, environment variables, network) validated against a strict schema? Are unexpected or malformed inputs handled gracefully without crashing?
-   [ ] **Parsing**: If you added or changed parsing logic, have you considered edge cases? (e.g., empty files, very large files, files with invalid encoding).
-   [ ] **Secrets**: Does your change handle secrets? If so, are you certain they are not being logged, printed to `stdout/stderr`, or stored in configuration files? Use environment variables.
-   [ ] **Output**: Have you ensured that error messages are clear but do not leak sensitive internal state (e.g., full file paths, stack traces in production builds, environment variables)?

### 2. Dependencies
-   [ ] **New Dependencies**: If you added a new dependency, why is it necessary? Is it from a reputable source? Is it actively maintained? Does it have a minimal dependency tree of its own?
-   [ ] **Vulnerability Scan**: Have you run `cargo audit` and `npm audit` locally to ensure your change does not introduce a dependency with a known vulnerability?

### 3. Logic and Behavior
-   [ ] **Determinism**: Does your change affect the core deterministic logic? If so, have you documented this and prepared for the necessary updates to the determinism vectors?
-   [ ] **Error Handling**: Are all `Result` and `Option` types in Rust handled correctly? Are there any `.unwrap()` or `.expect()` calls that could panic on unexpected input?
-   [ ] **Resource Management**: If your code deals with files or other resources, are they always closed properly, even on error paths?

### 4. Other
-   [ ] **Documentation**: Have you updated relevant documentation (e.g., `README.md`, command help text) to reflect your changes?
-   [ ] **Testing**: Have you added unit or integration tests that cover the new functionality and any relevant edge cases? If you fixed a bug, did you add a regression test?

---

## Peer Reviewer Checklist

During the review, please consider the following points in addition to general code quality.

### 1. Threat Model
-   [ ] **STRIDE**: Consider the change through the lens of our [STRIDE Threat Model](threat-model-stride.md). Does it introduce a new risk of Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, or Elevation of Privilege?
-   [ ] **Attack Surface**: Does this change increase the application's attack surface (e.g., by adding a new parser, opening a network port, adding a new type of plugin)? If so, is the increase justified and properly secured?

### 2. Code-Level Security
-   [ ] **"Security Hotspots"**: Pay extra attention to code that:
    -   Parses complex file formats.
    -   Uses `unsafe` blocks in Rust.
    -   Executes external commands (`std::process::Command`).
    -   Interacts with the filesystem or network.
-   [ ] **Dependency Review**: Scrutinize any newly added dependencies. Question their necessity and check their maintenance status and popularity.

### 3. Process and Integrity
-   [ ] **Clarity**: Is the code's intent clear? Could a future developer misunderstand it and introduce a vulnerability?
-   [ ] **Determinism Impact**: If the PR claims to have no impact on determinism, are you confident that is true? If it *does* change determinism, is the change justified and are the test vectors being updated correctly?
-   [ ] **CI Results**: Have all automated security checks (dependency audit, SAST, secret scanning) passed?
