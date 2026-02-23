# Reach Examples Library

A curated collection of example packs demonstrating Reach's capabilities for deterministic execution, policy enforcement, and replay verification.

## Quick Start (Copy-Paste Commands)

```bash
# Run all examples in sequence
node examples/01-quickstart-local/run.js
node examples/02-diff-and-explain/run.js
node examples/03-junction-to-decision/run.js
node examples/04-action-plan-execute-safe/run.js
node examples/05-export-verify-replay/run.js
node examples/06-retention-compact-safety/run.js
```

## Examples Index

### [Example 01: Quickstart Local](./01-quickstart-local/)

**Level:** Beginner | **Time:** 2 min

Minimal local run producing evidence output. Fastest way to see Reach in action.

```bash
node examples/01-quickstart-local/run.js
```

**Demonstrates:** Deterministic execution, evidence collection, fingerprint generation

---

### [Example 02: Diff and Explain](./02-diff-and-explain/)

**Level:** Beginner | **Time:** 3 min

Create two runs, generate diff, show explain output. Learn change detection.

```bash
node examples/02-diff-and-explain/run.js
```

**Demonstrates:** Change detection, input tracking, explainability, run tagging

---

### [Example 03: Junction to Decision](./03-junction-to-decision/)

**Level:** Intermediate | **Time:** 4 min

Generate junction, evaluate decision, show trace. Learn the junction-decision workflow.

```bash
node examples/03-junction-to-decision/run.js
```

**Demonstrates:** Junction creation, policy evaluation, decision selection, trace visualization

---

### [Example 04: Action Plan Execute (Safe)](./04-action-plan-execute-safe/)

**Level:** Intermediate | **Time:** 5 min

Accept decision → plan → approve → execute SAFE action → journal → events.

```bash
node examples/04-action-plan-execute-safe/run.js
```

**Demonstrates:** Full workflow, safe execution, journaling, event emission

---

### [Example 05: Export Verify Replay](./05-export-verify-replay/)

**Level:** Advanced | **Time:** 5 min

Export bundle → verify → replay → show parity summary. Learn capsule portability.

```bash
node examples/05-export-verify-replay/run.js
```

**Demonstrates:** Export, verification, replay, parity check, attestation

---

### [Example 06: Retention Compact Safety](./06-retention-compact-safety/)

**Level:** Advanced | **Time:** 4 min

Retention status → compact (safe mode) → verify integrity. Learn data lifecycle.

```bash
node examples/06-retention-compact-safety/run.js
```

**Demonstrates:** Retention analysis, safe compaction, chain verification, space recovery

---

## Learning Path

1. **Start Here** → Example 01 (understand core concepts)
2. **Compare Runs** → Example 02 (see how changes are tracked)
3. **Make Decisions** → Example 03 (junction-decision workflow)
4. **Execute Plans** → Example 04 (full execution lifecycle)
5. **Verify Replay** → Example 05 (portability and determinism)
6. **Manage Data** → Example 06 (retention and compaction)

## Running with Verbose Output

Add `--verbose` to any example for detailed output:

```bash
node examples/01-quickstart-local/run.js --verbose
```

## Creating Your Own Examples

Use the existing examples as templates:

1. Create a new directory: `examples/07-my-example/`
2. Add `README.md` with purpose and commands
3. Add seed input files (JSON/YAML)
4. Add `expected.json` for verification
5. Add `run.js` as the entry point
6. Update this README

## Prerequisites

- Node.js 18+
- Reach CLI (`reach` or `reachctl` in PATH)

## Legacy Examples

The following examples are also available for specific integrations:

- `examples/demo/` - Interactive demo
- `examples/ts-basic/` - TypeScript SDK basics
- `examples/python-basic/` - Python SDK basics
- `examples/express-basic/` - Express.js integration
- `examples/fastapi-basic/` - FastAPI integration
- `examples/nextjs-basic/` - Next.js integration

## Troubleshooting

**Issue:** `reach: command not found`  
**Fix:** Run from repo root, or use full path to `reachctl.exe` (Windows) or `./reach` (Unix)

**Issue:** Examples fail with module not found  
**Fix:** Run `npm install` from repo root

**Issue:** Permission denied on scripts  
**Fix:** On Unix, run `chmod +x examples/*/run.js`

## Contributing

When adding new examples:

1. Follow the existing directory structure
2. Include comprehensive README
3. Add seed scripts for reproducibility
4. Update this index
5. Ensure deterministic execution (`deterministic: true`)
6. Test with `node run.js --verbose`

See [CONTRIBUTING.md](../CONTRIBUTING.md) for more details.
