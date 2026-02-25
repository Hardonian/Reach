# 10-Minute Success

This is the canonical golden path for first success across CLI-only, Web-only, and mixed modes.

## Prereqs

- Node.js >= 20.9
- Repo cloned and dependencies installed
- Optional: `REACH_CLOUD_ENABLED=true` for tenant-authenticated web paths

## Flow 1: Install + Connect Repo + First Run (CLI)

```bash
npm install
./reach doctor
./reach quickstart
```

Expected result:

- deterministic run artifacts created
- bundle/report paths printed
- next actions printed

## Flow 2: Patch Pack -> SCCL Apply -> PR -> ReadyLayer Checks

```bash
# Generate demo artifacts (fixture-safe)
./reach quickstart

# Inspect generated bundle/report
ls -la dist/demo

# Run route and governance checks
npm run verify:routes
npm run verify:conformance
```

Expected result:

- SCCL/DGL/CPX artifact references emitted (fixture-labeled if no live auth)
- check/update surfaces validate without 500s

## Flow 3: CPX Arbitration on Two Candidate Packs

```bash
# Build demo candidate artifacts
./reach demo

# Run conformance and deterministic checks
npm run verify:conformance
npm run verify:determinism
```

Expected result:

- candidate outputs are reproducible
- merge-plan relevant artifacts and hashes are available in demo output paths

## Web-Only Path

```bash
npm run build --workspace arcade
npm run verify:routes
```

Then open key governance pages and API health:

- `/console/governance`
- `/console/artifacts`
- `/api/health`
- `/api/ready`

## Mixed Path (CLI + Web)

```bash
./reach quickstart
npm run verify:vercel
```

This validates local artifact generation and web route/runtime safety together.
