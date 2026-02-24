# Reach v0.1 Whitepaper

## Problem
Reliable orchestration needs reproducible execution evidence, not only logs.

## Deterministic event-sourced orchestration
Reach stores event logs and derives run fingerprints from canonicalized data.

## Why replay matters
Replay recomputes fingerprints to detect transcript tampering or drift.

## Novel vs non-novel
- Not novel: SHA-256 content hashing, signed reports, event sourcing.
- Novel composition: deterministic run replay + capsule exchange + memory-anchor hashing bridge in one OSS pipeline.

## Comparison
- Temporal: durable workflow runtime; Reach focuses stronger on deterministic replay artifacts.
- LangGraph: agent orchestration focus; Reach emphasizes deterministic evidence contract.
- n8n: low-code automation; Reach targets reproducibility and trust artifacts.

## Threat model and limits
Protects against accidental drift and transcript tampering. Does not prove remote operator honesty or model-output truthfulness.

## CAC, remote validation, memory hashing
- CAC: deduplicates immutable objects by hash.
- Remote validation: optional third-party verification with signed report.
- Memory hashing: privacy-preserving proof of memory inputs only.

## Roadmap (non-binding)
Sandboxed validation workers, stronger resource isolation, richer capsule schema evolution tooling.
