# Federation

Reach federation enables node-to-node execution while preserving policy and replay safety.

## Compatibility boundaries

- Registry snapshot hashes must match across deterministic paths.
- Policy version mismatches are rejected.
- Signed handshakes and replay protection are required.

## Safety controls

- Delegation depth limits
- Circuit-breaker behavior for unhealthy peers
- Registry compatibility checks before accepting delegated work

## References

- `FEDERATED_EXECUTION_SPEC.md`
- `docs/MESH_HANDSHAKE_SPEC.md`
