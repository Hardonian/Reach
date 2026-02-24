# External Review Simulation

## 1) Cryptography reviewer
- Criticism: capsule verification accepted large unbounded payloads in remote validation path (DoS risk).
- Evidence: new service now enforces `http.MaxBytesReader` and 10MiB cap.
- Validity: **Valid**.
- Remediation: added strict size limits, protocol version checks, signed deterministic report output.

## 2) Distributed systems reviewer
- Criticism: no rate limit on validation endpoint could starve worker process.
- Validity: **Valid**.
- Remediation: added in-flight concurrency guard (`429`) and deterministic report fields only.

## 3) OSS maintainer skeptic
- Criticism: trust features lacked clear self-hostable boundaries and optionality.
- Validity: **Valid**.
- Remediation: added OSS-native CAS + memory hash bridge + optional remote validator command/service and explicit threat-model docs.
