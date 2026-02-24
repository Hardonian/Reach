# Versioning Policy

Version constants are enforced in `services/runner/internal/trust/versions.go`.

Required bumps:
- Hash algorithm contract changes -> `HashVersion`
- Schema changes -> `SchemaVersion` and schema lock hash update
- Capsule wire changes -> `CapsuleVersion`
- Pack manifest compatibility changes -> `PackManifestVersion`
- CAS format changes -> `CACObjectFormatVersion`
- Remote API changes -> `RemoteProtocolVersion`
- Memory anchor shape changes -> `MemoryAnchorFormatVersion`

CI enforcement:
- `TestEventsSchemaHashLock` fails if `protocol/schemas/events.schema.json` changes without explicit lock update.
