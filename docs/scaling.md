# Reach Scaling & Performance Analysis

This document outlines the theoretical and practical scaling limits, complexity assumptions, and risk points for the Reach decision infrastructure. Because Reach guarantees determinism and relies on event sourcing for auditability, specific constraints apply to state growth and execution evaluation.

## 1. Complexity Assumptions

| Component | Time Complexity (Theoretical) | Space/Storage Complexity | Scaling Bottleneck |
| :--- | :--- | :--- | :--- |
| **Event Replay** | O(N) where N = number of events in transcript | O(E) where E = average event payload size | Replaying very long histories requires sequential processing. |
| **Junction Detection** | O(B) where B = number of branch/split points | O(S) where S = active state size | Evaluating divergent paths in complex decision trees requires state tracking. |
| **Decision Evaluation** | O(P) where P = plugin/WASM execution time | O(M) where M = Engine memory limit | Latency of external plugin execution or large sandboxed states. |
| **Capsule / Audit Export** | O(N) | O(N) + cryptographic overhead | Memory pressure during materialization of large transcripts. |
| **Data Retention** | O(1) per run | O(R) where R = total runs * payload | SQLite file size limits and disk IOPS over time. |

## 2. Risk Points & Mitigations

### 2.1 Replay History Unbounded Growth
**Risk:** Long-running workflows accumulate thousands of events, causing replay times to exceed acceptable UI latency or timeout limits.
**Mitigation:** State snapshotting. Workflows should periodically emit a compacted canonical state and prune historical events, treating the snapshot as the new genesis block.

### 2.2 Decision Evaluation Latency
**Risk:** Sandboxed decision plugins (WASM or isolated JS) hanging, infinite looping, or consuming excessive CPU during evaluation.
**Mitigation:** Strict execution timeouts (e.g., 50ms for synchronous evaluations) and hard memory limits (e.g., 10MB per isolate).

### 2.3 SQLite Vertical Scale Limit
**Risk:** Reaching SQLite concurrency (WAL mode locking) or file size limits at extremely high throughput.
**Mitigation:** Sharding by `tenant_id` or `workflow_id`. Reach prioritizes single-tenant or bounded context databases to isolate blast radius rather than a massive monolithic DB.

### 2.4 Export Memory Pressure
**Risk:** Exporting a massive workflow (Markdown, ICS, or portable bundle) blocks the event loop or causes an Out-Of-Memory (OOM) crash.
**Mitigation:** Streaming exports instead of buffering the entire bundle in memory; chunked cryptographic signing.

## 3. Recommended Scaling Thresholds

To maintain "Antigravity" principles (calm, deterministic, fast), operate within these recommended bounds:
- **Max Events per Workflow:** ~10,000 before snapshotting is required.
- **Max Decision Evaluation Time:** 100ms.
- **Max Plugin Bundle Size:** 5MB.
- **Max Concurrent Active Runs (Single Node SQLite):** ~500-1,000 depending on write volume.
- **Retention Strategy:** Prune ephemeral run data after 30 days; archive signed capsules to cold storage (e.g., S3/GCS) for long-term auditability.

---
*Reach: Reducing entropy in autonomous systems.*
