# Marketplace Pack Publishing ## Build

```bash
go run ./tools/packkit-build --type connector --path ./connectors/slack --out ./dist
```

Build output:

- `manifest.json`
- `bundle.tar.gz` (generated artifact; do not commit binary archives to git)
- `sha256.txt`

## Sign ```bash
go run ./tools/packkit-sign --manifest ./dist/connector-slack-1.2.0/manifest.json --key ./private.pem --key-id marketplace
```

Produces `manifest.sig` next to the manifest.

## Install ```bash
curl -X POST http://localhost:8092/v1/connectors/install -d '{"id":"connector-slack","version":"=1.2.0"}'
```

## Upgrade (explicit only) ```bash
curl -X POST http://localhost:8092/v1/connectors/upgrade -d '{"id":"connector-slack"}'
```

## CI publish workflow summary `marketplace-publish.yml` runs on `pack-*` tags and performs:

1. pack build
2. manifest version/tag match check
3. pack sign using `PACKKIT_PRIVATE_KEY_B64` secret
4. static index update (`docs/marketplace/registry/index.json`)
5. release artifact upload + index commit
