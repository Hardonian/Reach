# Frontend Visibility Audit — Governance Layers

## Hidden features identified

- Determinism replay was only indirectly discoverable via demo APIs and did not have a dedicated governance route.
- Policy engine controls were mixed into legacy tabs without a focused explorer experience.
- Artifact registry governance visibility was buried outside the governance route tree.
- Provider capability posture was not directly presented as a governance matrix.
- Economics telemetry existed in scripts but had no dedicated governance page.

## Under-explained features

- DGL and CPX pages had strong telemetry but limited narrative context for enterprise buyers and operators.
- SCCL surfaced repo status but lacked explicit “sync state visualizer” framing.
- Governance landing view emphasized generic policy tabs rather than full control-plane posture.

## Missing UI surfaces added in this pass

- Determinism replay visualization page: `/governance/determinism`.
- DGL violation explorer hardening and command exports: `/governance/dgl`.
- CPX comparison view with conflict matrix and pagination: `/governance/cpx`.
- SCCL sync state visualizer and run record table: `/governance/sccl` and `/governance/source-control`.
- Policy engine rule explorer: `/governance/policy`.
- Provider capability matrix: `/governance/providers`.
- Economics telemetry summary: `/governance/economics`.
- Artifact registry browser: `/governance/artifacts`.

## Discoverability updates

- Governance and Enterprise links are now primary entries in OSS and enterprise navigation.
- Governance dashboard links all core subsystem pages.
- Footer links now expose Governance and Enterprise directly.

