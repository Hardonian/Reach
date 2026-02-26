# Compliance Evidence Binder Structure

## 1. Introduction

To support future compliance and audit efforts (such as SOC 2, ISO 27001, or procurement reviews), Project Reach will maintain a structured "Evidence Binder." This binder is a designated, version-controlled location within our repository or a secure internal system where we collect and organize artifacts that demonstrate our adherence to our stated security policies and controls.

This document defines the structure of that binder.

## 2. Evidence Binder Location

-   **Primary Location**: A secure, access-controlled internal repository or document management system.
-   **Public Reference**: A subset of non-sensitive evidence may be stored or referenced within the `compliance/` directory of the main public repository.

## 3. Binder Structure and Content

The binder is organized by control families, mirroring common compliance frameworks.

### `/CC1 - Control Environment`

This section contains documents related to our organizational structure and governance.

-   `CC1.1_organizational_chart.md`: Defines key roles and responsibilities (e.g., Core Maintainer, Release Manager).
-   `CC1.2_governance_policy.md`: References our `GOVERNANCE.md` file.

### `/CC2 - Communication`

This section contains evidence of how we communicate policies and security information.

-   `CC2.1_policy_documentation/`: A snapshot or link to the `docs/` directory, demonstrating that policies are documented and accessible.
-   `CC2.2_security_advisories/`: A log of all published security advisories.

### `/CC3 - Risk Management`

This section contains artifacts from our risk assessment process.

-   `CC3.1_threat_model.md`: A snapshot of our STRIDE threat model (`docs/threat-model-stride.md`).
-   `CC3.2_risk_assessment_report.md`: The output from our latest internal risk assessment or external audit.
-   `CC3.3_supply_chain_analysis.md`: A snapshot of `docs/supply-chain-threat-simulation.md`.

### `/CC4 - Monitoring and Control Activities`

This section provides evidence of our security controls in action.

-   `CC4.1_ci_cd_configuration/`: Exported YAML files of our GitHub Actions workflows.
-   `CC4.2_dependency_scan_reports/`: A selection of recent `cargo audit` and `npm audit` reports from CI builds.
-   `CC4.3_branch_protection_screenshots/`: Screenshots of the branch protection rules from our GitHub repository settings.
-   `CC4.4_code_review_samples/`: Links to specific pull requests demonstrating our mandatory code review process.
-   `CC4.5_release_audit_log/`: A log containing checklists and sign-offs for each official release, demonstrating adherence to the release governance policy.

### `/CM - Change Management`

This section demonstrates how we manage changes to the production environment.

-   `CM1.1_pull_request_log.csv`: An export of pull requests for a given period, showing review and approval status.
-   `CM1.2_release_notes/`: Copies of all release notes (`CHANGELOG.md`).

### `/SL - System Operations`

This section contains evidence related to the operation and integrity of the system.

-   `SL1.1_release_artifact_manifests/`: Copies of `SHA256SUMS` and `*.sbom.json` files for all releases.
-   `SL1.2_artifact_signature_log/`: A log confirming that all release artifacts were successfully signed.
-   `SL2.1_incident_response_reports/`: Postmortem reports for any security or availability incidents.

## 4. Evidence Retention and Responsibility

-   **Retention Policy**: All evidence artifacts will be retained for a minimum of 24 months.
-   **Update Frequency**: The binder will be updated on a quarterly basis and immediately following any major release or security incident.
-   **Responsibility**: The designated "Release Manager" role is responsible for ensuring the evidence binder is kept up to date.
