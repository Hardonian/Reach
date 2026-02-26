# Release Governance Policy

## 1. Introduction

This policy defines the process and controls for creating, signing, and publishing an official release of Project Reach. The goal is to ensure that every release is secure, stable, and verifiable. Adherence to this policy is mandatory for all public releases.

## 2. Roles and Responsibilities

-   **Core Maintainer**: Any member of the core development team. Core Maintainers can merge code and create release candidates.
-   **Release Manager**: A designated subset of Core Maintainers who have access to the release signing keys and the authority to publish an official release. A release requires approval from at least two Release Managers.

## 3. Release Process

### 3.1. Pre-Release Checklist

Before a release can be created, the following conditions must be met on the main branch:

1.  [ ] All CI checks (testing, linting, dependency audit) must be passing.
2.  [ ] All blocking issues for the target milestone must be closed.
3.  [ ] The `CHANGELOG.md` must be updated with all user-facing changes since the last release.
4.  [ ] The version number in the project's version file (e.g., `VERSION` or `Cargo.toml`) must be incremented according to Semantic Versioning rules.

### 3.2. Creating the Release Candidate

1.  A Core Maintainer creates a new Git tag (e.g., `v1.2.3`) on the release commit. The tag MUST be a GPG-signed tag.
2.  Pushing the tag triggers the `release` workflow in our CI/CD pipeline.
3.  The `release` workflow performs the following steps:
    -   Checks out the specified tag.
    -   Runs all tests one final time.
    -   Builds all release binaries in a clean, isolated environment.
    -   Generates the Software Bill of Materials (SBOM) for all binaries.
    -   Generates the `SHA256SUMS` file containing the hashes of all artifacts.
    -   Uploads all artifacts (binaries, archives, SBOM, hash file) to a draft GitHub Release.

### 3.3. Release Approval and Signing

1.  The draft release is reviewed by at least **two** Release Managers.
2.  The review process includes:
    -   Downloading a random binary from the draft release and verifying its functionality.
    -   Independently rebuilding the binary from the tag and verifying that the hash matches the one in the `SHA256SUMS` file.
3.  Once approved, a Release Manager with access to the signing key performs the final signing step. This is a manual, offline-enabled process.
    -   The `SHA256SUMS` file and all container images are signed using `cosign`.
    -   The resulting signatures (`.sig` and `.att` files) are uploaded to the draft release.
4.  With the signatures in place, the Release Manager publishes the draft release, making it public.

## 4. Emergency Patch Workflow

For a critical security vulnerability that requires an immediate patch, the following expedited process may be used:

1.  The fix is developed and merged to the main branch.
2.  The version is incremented at the patch level (e.g., `v1.2.3` -> `v1.2.4`).
3.  A release tag is created. The CI process runs as normal.
4.  The review process may be expedited to require only **one** Release Manager's approval and signature.
5.  The release is published along with a security advisory.

## 5. Policy Enforcement

-   **Branch Protection**: GitHub branch protection rules prevent direct pushes to the main branch and require CI checks to pass.
-   **Access Controls**: Only Release Managers have the necessary permissions in GitHub to publish a release.
-   **Key Management**: Signing keys are held by a limited number of individuals and are stored in secure hardware tokens, not in GitHub secrets.
