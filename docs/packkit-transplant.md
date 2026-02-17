# Packkit transplant notes

## Discovery
- `../keys`: not found.
- git remote `keys`: not configured.
- `KEYS_PATH`: empty.

Because Keys source was unavailable, Reach packkit was implemented as a clean-room module with compatibility-oriented APIs (`ParseManifest`, `VerifyManifestSignature`, `ResolvePackage`, lockfile read/write, registry index read).

## Attribution and licensing
No Keys source files were copied into this repository in this change. Existing Reach project licensing remains unchanged.

## Usage
- Connector registry reads from `connectors/index.json`.
- Signed manifests are required unless `DEV_ALLOW_UNSIGNED=1`.
- Installed package pins are written to `reach.lock.json`.

## Signing
Use `tools/packkit-sign`:

```bash
go run ./tools/packkit-sign -mode sign -manifest connectors/connector.github/1.2.0/manifest.json -sig connectors/connector.github/1.2.0/manifest.sig -key-id dev -private-key ./dev.ed25519.private.b64

go run ./tools/packkit-sign -mode verify -manifest connectors/connector.github/1.2.0/manifest.json -sig connectors/connector.github/1.2.0/manifest.sig -trusted-keys services/runner/config/trusted_plugin_keys.json
```
