# Versioning and Support Policy

## 1. Introduction

This policy defines how Project Reach versions its releases, the stability guarantees that come with those versions, and the support window during which releases will receive bug fixes and security patches.

## 2. Semantic Versioning

Project Reach adheres strictly to [Semantic Versioning 2.0.0](https://semver.org/).

Given a version number `MAJOR.MINOR.PATCH`, we will increment the:

-   **MAJOR** version when we make incompatible API or CLI changes. This includes removing or renaming commands, flags, or configuration keys.
-   **MINOR** version when we add functionality in a backward-compatible manner. This includes adding new commands or optional flags.
-   **PATCH** version when we make backward-compatible bug fixes or security patches.

## 3. Determinism and Versioning

The core security promise of Reach is its deterministic behavior. Our versioning scheme explicitly accounts for this.

-   Any change that alters the output of the core engine for a given input—even if it's a bug fix—is considered a change to the system's "semantic behavior."
-   A **PATCH** release will *never* change the deterministic output. It is reserved for fixes that do not affect the core logic (e.g., fixing a typo in a help message, patching a non-core library).
-   A **MINOR** or **MAJOR** release *may* introduce a change to the deterministic output. All such changes will be clearly documented in the `CHANGELOG.md`.

This ensures that users can update patch versions with confidence that their existing workflows and test vectors will continue to produce identical results.

## 4. Release Support Window

We are committed to providing support and security patches for our software, but we cannot support all historical versions indefinitely.

Our support policy is as follows:

-   **Current Major Version**: The latest `MINOR` and `PATCH` release of the current `MAJOR` version is fully supported.
-   **Previous Major Version**: We will provide security patches for the latest `MINOR` release of the *previous* `MAJOR` version for a period of **12 months** after the new `MAJOR` version is released.

**Example**:
-   `v2.0.0` is released.
-   `v2.0.1` is later released with a security patch. Users of `v2.0.0` are expected to upgrade.
-   The latest release of the `v1.x` line (e.g., `v1.5.3`) will continue to receive critical security backports for the next 12 months.
-   After 12 months, the `v1.x` line is considered end-of-life (EOL) and will no longer receive updates.

## 5. Deprecation Policy

When we intend to remove a feature, command, or configuration option, we will follow a clear deprecation process:

1.  **Deprecation Announcement (MINOR Release)**: The feature will be marked as "deprecated" in a `MINOR` release. When used, it will print a non-intrusive warning to `stderr` that it will be removed in a future version. The documentation will be updated to reflect its deprecated status.
2.  **Removal (MAJOR Release)**: The deprecated feature will be removed in the next `MAJOR` release. This breaking change will be a primary driver for the major version bump and will be prominently featured in the release notes.

We will not remove a feature without at least one `MINOR` release deprecation cycle.
