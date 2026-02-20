# Issue Triage & Labeling Guide

This document describes how we prioritize and label issues in the Reach repository.

## Priorities

| Label | Description | SLA (Estimated) |
| :--- | :--- | :--- |
| `priority:critical` | System is unusable, major security flaw, or data corruption. | < 4 hours |
| `priority:high` | Major feature broken, significant performance regression. | < 24 hours |
| `priority:medium` | Feature partially broken, non-critical bug. | Next release |
| `priority:low` | UI glitch, minor doc fix, suggestion. | Backlog |

## Common Labels

- `status:triage`: New issues awaiting review.
- `status:confirmed`: Issue reproduced and ready for work.
- `status:blocked`: Waiting on external dependency or more info.
- `type:bug`: Reproducible defect.
- `type:feature`: New capability or enhancement.
- `type:docs`: Documentation updates or errors.
- `area:engine`: Core deterministic layer (Rust).
- `area:runner`: Orchestration layer (Go).
- `area:arcade`: Web UI / Dashboard.
- `area:docs`: Documentation and FAQ.

## Triage Process
1. **Initial Review**: Confirm the bug reproduction steps or feature alignment.
2. **Labeling**: Apply `area`, `type`, and `priority` labels.
3. **Assignment**: Assign to a maintainer or mark as `help wanted`.
