# Reproducible Builds in Reach

## 1. Definition of Reproducibility

For Reach, a "reproducible build" is one that produces bit-for-bit identical binaries when built from the same source code commit on a consistent, well-defined build environment. This is a cornerstone of our security posture, as it allows any user to independently verify that the binary they are using corresponds exactly to the open-source code and has not been tampered with.

Our goal is to ensure that the official, pre-compiled binaries we release can be reproduced by a third party, proving their integrity beyond the trust provided by cryptographic signatures alone.

## 2. Key Components of Our Reproducibility Strategy

### 2.1. Toolchain and Dependency Pinning

The build process is highly sensitive to the versions of tools and dependencies used. We enforce consistency through:

-   **Rust Toolchain**: The `rust-toolchain.toml` file pins the exact version of the Rust compiler and toolchain used for the project, ensuring all developers and the CI environment use the same compiler.
-   **Node.js Version**: The `.nvmrc` and `package.json` engines field specify the exact version of Node.js required for the parts of our build process that depend on it.
-   **Go Version**: The `go.work` file specifies the Go version used for any Go components.
-   **Locked Dependency Trees**: We commit and enforce `Cargo.lock` (Rust), `package-lock.json` (Node.js), and `go.work.sum` (Go). This ensures that the exact same dependency versions are used for every build of a given commit.

### 2.2. Embedded Build Metadata

To aid in verification, our build script embeds critical metadata directly into the final binaries:

-   **Commit Hash**: The full Git commit hash of the `HEAD` at build time is embedded. This can be viewed by running `reach --version`.
-   **Build Timestamp**: We embed a build timestamp. For official releases, this is a fixed, deterministic timestamp recorded in the build environment to eliminate this source of variance.

### 2.3. Build Environment and Process

-   **CI Build Isolation**: All official builds are produced within ephemeral, clean Docker containers defined in our repository (`Dockerfile.dev`). This ensures that the build is not influenced by the state of a pre-existing machine.
-   **Source Code Path Normalization**: Build scripts use flags (e.g., Rust's `--remap-path-prefix`) to normalize absolute file paths that the compiler might otherwise embed in the binary, which would vary between build machines.
-   **Deterministic Archiving**: We use deterministic options for `tar` and `zip` when creating release archives to ensure the archives themselves are also reproducible.

## 3. Verifying a Build

A user can verify a build by following these general steps:

1.  Clone the repository and check out the specific Git tag of the release.
2.  Install the exact toolchain versions specified in `rust-toolchain.toml`, `.nvmrc`, etc.
3.  Run the official release build script provided in the repository.
4.  Compute the SHA256 hash of the locally-built binary.
5.  Compare this hash with the hash of the corresponding binary from the official `SHA256SUMS` file for that release.

## 4. Honest Limitations and Known Gaps

Achieving perfect, cross-platform reproducibility is a significant challenge. We are transparent about our current limitations:

-   **Cross-OS Variance**: We do not currently guarantee that a build on Windows will be bit-for-bit identical to a build on macOS or Linux. Our primary guarantee is that a build on a specific OS can be reproduced on another machine with the same OS and architecture.
-   **System Library Dependencies**: The core CLI binary has minimal dependencies on system libraries, but slight variations in these libraries (e.g., `libc`) between OS patch versions could theoretically introduce variance. Our testing has not shown this to be an issue in practice.
-   **Go Build Determinism**: Go provides strong reproducibility guarantees, but we continue to monitor best practices to ensure our Go components adhere to them.

## 5. Future Improvements

We are committed to continuously improving our reproducibility posture. Potential future work includes:

-   **Hermetic Build Systems**: Exploring the use of more strictly controlled build systems like Bazel to reduce reliance on the host system's environment.
-   **Published Build Environments**: Publishing the exact Docker image used for a release build to make reproduction even easier for third parties.
-   **Multi-Platform Verification**: Expanding our CI to automatically perform and attest to the reproducibility of builds across all three major platforms (Linux, macOS, Windows).
