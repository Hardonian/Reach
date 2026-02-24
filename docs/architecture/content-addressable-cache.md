# Content-Addressable Cache

Local CAS path defaults to `~/.reach/cas`.

Object types:
- `transcript`
- `canonical-bytes`
- `bundle-manifest`
- `step-proof`

CLI:
- `reach cache status`
- `reach cache gc`

Properties:
- Immutable writes by SHA-256 key.
- Verification re-hashes stored bytes.
- GC is deterministic: removes only malformed keys.
