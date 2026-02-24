# Local Pack Registry Overview

Reach OSS uses a local-first pack registry at `REACH_DATA_DIR/registry/index.json`.

## Core workflow

- `reach pack add <source>` adds a pack from:
  - local path
  - git URL
  - `.tar`, `.tar.gz`, `.tgz`, or `.zip` archive
- `reach pack list` lists local registry entries.
- `reach pack search <query>` searches by name/description.
- `reach pack update <name>` refreshes a pack from its original source.
- `reach pack remove <name>` removes registry entry and refreshes lock state.

## Reproducibility lockfile

`REACH_DATA_DIR/registry/pack.lock.json` pins:

- `version`
- `content_hash`
- `source`

The lockfile is updated after every add/remove/update operation.
