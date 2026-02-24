# Pack Signing

Reach OSS supports local Ed25519 signing for packs.

## Manifest
`pack.manifest.json` includes:
- `name`, `version`, `author`
- `reach_version_range`
- `schema_version_range`
- `hash_version_range`
- `content_hash` (sha256)
- optional `signature`

## Commands
- `reach pack sign <pack-path>`
- `reach pack verify-signature <pack-path>`

Set `REACH_REQUIRE_PACK_SIGNATURE=1` to enforce signatures during validation/install paths.
Unsigned packs are allowed in OSS mode with warning.
