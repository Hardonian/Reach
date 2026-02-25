# SOC2 Control Mapping: Deterministic Governance

## Overview

This document maps the Reach Determinism System to the SOC 2 Trust Services Criteria (TSC). It provides a narrative of how the technical implementation of fingerprints, canonicalization, and drift detection supports specific compliance requirements.

---

## 1. Governance & Control Environment (CC1.x)

### CC1.1: The organization demonstrates a commitment to integrity and ethical values

- **Narrative**: Reach enforces integrity through "Determinism by Default." By mandating that all governance intents are fingerprinted, the system removes the ability for administrators to bypass policy logic without leaving an auditable trace.
- **Mechanism**: All state transitions require a valid fingerprint preimage. [See Determinism Spec v1.0](../specs/determinism-v1.0.md).

---

## 2. Communication and Information (CC2.x)

### CC2.1: The organization obtains or generates and uses relevant, quality information to support the functioning of internal control

- **Narrative**: The Reach "Evidence Chain" captures the preimage and resulting fingerprint for every decision. This information is high-quality, verifiable, and used to monitor the effectiveness of governance controls.

---

## 3. Control Activities (CC5.x)

### CC5.1: The organization identifies and develops control activities that contribute to the mitigation of risks

- **Narrative**: Fingerprint enforcement acts as an automated control activity. It mitigates the risk of "Unauthorized Execution" by ensuring that only pre-validated and signed intents can be processed by the runner.
- **Evidence**: `determinism.vectors.json` and CI logs showing 100% passing fingerprint tests.

---

## 4. Logical Access (CC6.x)

### CC6.1: The organization implements logical access security software, infrastructure, and architectures

- **Narrative**: Reach uses fingerprints as a "Cryptographic Lock." Access to specific governance actions is tied to the fingerprint of the authorized intent, preventing elevation of privilege through raw data modification.

---

## 5. System Operations (CC7.x)

### CC7.2: The organization monitors system components and operations for anomalies

- **Narrative**: "Drift Detection" is a core operational control. If the system detects a deviation between the expected fingerprint and the actual computed fingerprint during execution, it halts operation and alerts the monitoring system (DETERMINISM_DRIFT exception).
- **Audit Walkthrough**:

    1. View "Drift Alert" in logs.
    2. Retrieve Preimage from the Evidence Store.
    3. Replay Preimage through the [Reach Doctor CLI](../../README.md) to verify implementation consistency.

---

## Evidence Collection Guidance

For auditors seeking to verify these controls:

1. **Fingerprint Consistency Sample**: Export five decision records from the Reach Evidence Store and use the `reach doctor verify` command to regenerate fingerprints from the provided preimages.
2. **CI Integrity Review**: Examine the `.github/workflows/decision-engine.yml` file to verify that "Golden Vector" tests are mandatory for all production builds.
3. **Canonicalization Review**: Review `packages/core/src/nl-compiler/deterministic.ts` to confirm lexicographical key sorting is enforced.

---

## Summary Statement

The Reach Determinism System serves as an automated, cryptographic control layer that supports the **Integrity**, **Availability**, and **Security** of the governed environment.
