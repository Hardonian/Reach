# Container Image Reproducibility and Security

## 1. Introduction

For users who run Reach within a containerized environment, the security and integrity of the container image are as important as the binary itself. This document outlines our practices for building and distributing secure, verifiable, and reproducible container images.

Our official container images are published to [Docker Hub/GHCR link here].

## 2. Image Security Best Practices

We follow industry best practices to create hardened container images with a minimal attack surface.

### 2.1. Minimal Base Images

-   We use minimal, trusted base images (e.g., `gcr.io/distroless/cc-static`, `alpine`).
-   We avoid including package managers, shells, or other unnecessary tools in the final production image, which could be used by an attacker who gains execution within the container.

### 2.2. Multi-Stage Builds

-   Our `Dockerfile` utilizes multi-stage builds.
-   The first stage (`builder`) contains the entire Rust toolchain and all build-time dependencies needed to compile the `reach` binary.
-   The final stage creates a new, clean image from a minimal base and copies *only* the compiled `reach` binary from the `builder` stage.
-   This practice ensures that no build tools, intermediate files, or development dependencies are present in the final image, drastically reducing its size and attack surface.

### 2.3. Non-Root User

-   The final container image is configured to run the `reach` process as a non-root user with minimal privileges.
-   This provides an important layer of defense if an attacker achieves code execution via a vulnerability in the application.

## 3. Image Integrity and Verifiability

### 3.1. Image Signing

-   All official container images are signed using `cosign`.
-   Users can verify the signature of an image to ensure it was published by the Reach team and has not been tampered with.
-   Verification command: `cosign verify <image-uri> --certificate-oidc-issuer https://token.actions.githubusercontent.com --certificate-identity <repo-url>`

### 3.2. Digest Pinning

-   We strongly recommend that users pull and reference our container images by their immutable digest (`@sha256:...`) rather than by a mutable tag (like `:latest` or `:v1.2.3`).
-   Pinning to a digest ensures you are always using the exact same image, even if a tag is maliciously or accidentally moved. CI/CD systems should always use digest pinning for production deployments.

### 3.3. Embedded Software Bill of Materials (SBOM)

-   We embed a comprehensive SBOM directly into the container image as a standard label.
-   This allows security scanners and users to get a complete inventory of all components within the image without needing to download external files.

## 4. Container Reproducibility

Just as with our binaries, we strive for reproducible container images.

-   **Dockerfile Source**: The `Dockerfile` is version-controlled in our main repository.
-   **Base Image Pinning**: Our `Dockerfile` pins the base image to a specific digest (`@sha256:...`) to ensure the build always starts from the exact same foundation.
-   **Deterministic `COPY`**: We structure our `Dockerfile` to optimize layer caching and ensure that file copy operations are as deterministic as possible.

**Limitation**: True bit-for-bit reproducibility of container images is an industry-wide challenge due to factors like embedded timestamps in filesystem layers. However, by pinning all inputs (source commit, base image digest), we achieve a high degree of confidence that the resulting image is functionally and securely identical to the one we built in CI.

## 5. Conclusion

Our container security strategy mirrors our overall philosophy: minimal, verifiable, and secure by default. By using multi-stage builds, non-root users, image signing, and digest pinning, we provide a secure foundation for running Reach in any containerized environment.
