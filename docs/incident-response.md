# Incident Response Policy

## 1. Introduction and Purpose

This document outlines the policy and plan for responding to a security incident affecting Project Reach. An "incident" is any event that compromises the confidentiality, integrity, or availability of our software, our build and release systems, or our users' trust.

The goal of this plan is to enable a swift, effective, and coordinated response to minimize harm, restore trust, and learn from the event.

## 2. Scope

This policy applies to any security incident involving:
-   The Reach source code.
-   The Reach CI/CD pipeline and build environment.
-   Official release artifacts and signatures.
-   The project's presence on GitHub (e.g., repository, releases, issues).

## 3. Roles and Responsibilities

-   **Incident Commander (IC)**: The designated point person responsible for leading the incident response. This is typically the first Core Maintainer to declare an incident.
-   **Incident Response Team (IRT)**: Composed of the Incident Commander and at least one other Core Maintainer. This team is responsible for executing the response plan.
-   **Communications Lead**: A member of the IRT designated to handle all internal and external communications.

## 4. Incident Response Phases

### Phase 1: Detection and Declaration

-   **Detection**: An incident may be detected via internal monitoring (e.g., a failed CI determinism check), a security vulnerability report, or external notification.
-   **Declaration**: Any Core Maintainer who identifies a potential incident must immediately notify the other core maintainers via a secure, private channel. If the event is deemed a credible incident, the first responder becomes the IC and formally declares an incident. A dedicated, private chat channel is opened for coordination.

### Phase 2: Containment and Analysis

-   **Goal**: Stop the bleeding. Prevent further damage.
-   **Actions**:
    -   The first priority is to contain the incident. This may involve:
        -   Revoking compromised credentials.
        -   Temporarily disabling the CI/CD pipeline.
        -   Removing compromised or suspicious release artifacts.
        -   Restricting write access to the repository.
    -   The IRT will then analyze the incident to determine the root cause, the extent of the impact, and the timeline of events.
    -   All actions taken are documented in a real-time incident log.

### Phase 3: Eradication and Remediation

-   **Goal**: Remove the attacker/vulnerability and fix the underlying issue.
-   **Actions**:
    -   Develop and test a patch for the vulnerability.
    -   Rotate any compromised keys or credentials.
    -   Scan all systems for backdoors or persistence mechanisms.
    -   Audit all code merged since the suspected time of compromise.
    -   For a determinism-specific incident, this includes a full audit of the core hashing logic and a regeneration of the blessed `determinism.vectors.json`.

### Phase 4: Recovery and Release

-   **Goal**: Safely restore service and provide a secure version to users.
-   **Actions**:
    -   Re-enable systems (CI/CD, etc.) after they have been secured.
    -   Follow the `release-governance-policy.md` to create and publish a new, secure version of Reach.
    -   This release will be accompanied by clear communication about the incident.

### Phase 5: Post-Incident Review (Postmortem)

-   **Goal**: Learn from the incident and improve our defenses.
-   **Actions**:
    -   Within 14 days of the incident being resolved, the IRT will conduct a blameless postmortem.
    -   A public postmortem report will be published, detailing:
        -   A summary of the incident and its impact on users.
        -   A timeline of key events.
        -   The root cause(s).
        -   A list of action items to prevent recurrence.

## 5. Communication Plan

-   **Internal**: All incident-related discussion among the IRT will happen in the designated private channel.
-   **External**: The Communications Lead is the sole voice for the project during an incident.
    -   We will not comment publicly on an ongoing investigation until we have a clear understanding of the impact.
    -   Our first public communication will be to acknowledge the incident and state that we are investigating.
    -   Once a fix is available, we will release it along with a detailed security advisory explaining the vulnerability and the steps users should take.
    -   A full postmortem will follow.

Transparency with our users is a primary goal, but it will be balanced with the need to avoid releasing information that could help attackers or hinder the investigation.
