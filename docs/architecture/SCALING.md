# Reach Scaling Architecture

This document defines the architectural patterns required to support **100k+ event transcripts** and **high-concurrency replay** scenarios.

## 1. The 100k Event Reality

At 100k events, linear processing breaks down. The architecture must shift from "load-all" to "stream-and-window".

### Bottlenecks & Breakpoints

| Component         | Breakpoint   | Symptom                                          | Mitigation                                                         |
| :---------------- | :----------- | :----------------------------------------------- | :----------------------------------------------------------------- |
| **Event Log**     | ~10k events  | JSON Parse/Stringify overhead blocks main thread | Streaming JSON parser (SAX-style) or binary format (Protobuf/CBOR) |
| **Replay Engine** | ~50k events  | Memory exhaustion (O(n) state accumulation)      | Periodic Snapshots (every 1k events)                               |
| **Network**       | ~5MB payload | HTTP body limits / Timeout                       | Pagination / Chunked Transfer                                      |
| **Verification**  | ~10s latency | User perceived hang                              | Incremental Hashing (Merkle Tree)                                  |

## 2. Storage & I/O Strategy

### Append-Only Logs

The source of truth is an append-only log. Random access writes are forbidden in the core execution path.

- **Writes**: Buffered and flushed in batches (e.g., every 100ms or 50 events).
- **Reads**: Streaming iterators. Never `fs.readFile` the entire log into a Buffer.

### Content-Addressable Storage (CAS)

Large artifacts (images, large text blobs) must be offloaded to CAS (blob storage) and referenced by hash in the Event Log.

- **Threshold**: Payloads > 4KB must be stored in CAS.
- **Integrity**: The Event Log contains the SHA-256 of the blob.

## 3. Memory Management

### The 512MB Constraint

Each Runner instance is capped at 512MB RAM to ensure density in orchestration environments.

- **Object Pools**: Heavy objects (like VM contexts) must be pooled.
- **Zero-Copy**: Where possible, pass buffers by reference (Slice) rather than copying.
- **Garbage Collection**: Avoid creating short-lived closures in tight loops (e.g., event reducers).

## 4. Concurrency Model

Reach uses a **Actor-like** model for Sessions.

- **Isolation**: Each Session runs in its own logical boundary (Goroutine or V8 Isolate).
- **Communication**: Strictly via message passing (Channels / Event Emitters).
- **No Shared Mutable State**: Global variables are strictly forbidden.

## 5. Out of Scope (v0.1)

The following are explicitly NOT supported in the current architecture and will cause undefined behavior at scale:

- **Hot State Migration**: Moving a running session between physical nodes without a restart.
- **Multi-Master Writes**: A single session must have a single writer (Coordinator) at any given time.
- **Real-time Collaborative Editing**: The protocol is eventually consistent for observers, but strictly serialized for the executor.

## 6. Verification

Scale posture is verified by the `perf-gate` workflow using the `tools/perf` harness.

- **SLO**: P95 latency for `trigger_to_first_event` < 1200ms at 100 concurrent sessions.
