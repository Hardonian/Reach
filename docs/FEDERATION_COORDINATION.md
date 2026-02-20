# Federation Coordination ## handshake-and-identity
Each node publishes stable identity metadata: node_id, pub_key_ref fingerprint, spec_version, capabilities_hash, registry_snapshot_hash, and supported_modes. Identity is attached to handshake and delegation metadata.

## reputation-and-trust Reputation tracks delegation successes/failures, policy denials, replay mismatch incidents, and latency percentiles. Trust score is deterministic from a snapshot using weighted components (success, latency, policy compliance, spec/registry alignment, replay consistency).

## selection-and-quarantine Weighted selection can use trust, latency, capability match, and optional economic weight. Incompatible spec/registry and quarantined nodes are excluded. Nodes are auto-quarantined for replay mismatch or low trust score.

## failsafes - Auto-reject spec mismatch.
- Circuit breaker on repeated failures.
- Trust downgrade on repeated policy issues.
- Quarantine blocks delegation until reputation improves.
