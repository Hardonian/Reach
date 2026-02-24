# Reach CLI Reference

Reach provides:
- `reachctl` (core binary)
- `reach` (wrapper script that forwards to `reachctl` and repository tools)

## Core Commands

- `reach version`
- `reach doctor`
- `reach demo`
- `reach run <pack>`
- `reach capsule create <run-id>`
- `reach capsule verify <file>`
- `reach capsule replay <file>`
- `reach proof verify <run-id|capsule>`
- `reach packs search [query]`
- `reach packs install <name>`
- `reach bugreport`

## One-Command Demo

```bash
reach demo
```

This flow runs a sample pack, verifies output integrity, replays the capsule, and stores artifacts under `REACH_DATA_DIR` (default: `data`).

## Diagnostics

```bash
reach doctor
reach bugreport
```

`reach bugreport` creates a redacted zip bundle for support/issue filing.

## Installation

See [docs/INSTALL.md](./INSTALL.md).
