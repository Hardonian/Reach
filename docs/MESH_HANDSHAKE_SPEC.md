# Mesh Handshake Spec Reach mesh nodes identify with:
- `nodeId` (stable UUID)
- `orgId`
- `nodePublicKey` (ed25519)
- `capabilitiesHash` (hash of capability registry snapshot)

## Protocol 1. Acceptor emits challenge `{nonce, policyVersion, registrySnapshotHash, issuedAt}`.
2. Initiator signs `nonce|policyVersion|registrySnapshotHash|nodeId` using node private key.
3. Acceptor verifies signature with `nodePublicKey`, verifies challenge TTL, and rejects replayed signatures.
4. On success, acceptor issues in-memory short-lived session token `{value, expiresAt}`.

## Security - Replay prevention is enforced by per-node signature memoization for the handshake TTL.
- Only redacted identifiers are emitted to deterministic audit logs.
