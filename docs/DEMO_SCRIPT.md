# OSS Demo Script — 30-Second Deterministic Demo

Last Updated: 2026-02-22

## Purpose

This is the canonical 30-second demo path for showing Reach's deterministic execution, policy gate enforcement, fix suggestion, and replay verification — all locally, with no cloud dependencies.

The demo works in both the web playground (`apps/arcade`) and via CLI (`reachctl`).

---

## Demo Path

### Step 1 — Load Demo Pipeline (0–5 seconds)

The demo pipeline `arcadeSafe.demo` is pre-loaded in the playground. It contains:

- A 3-step execution pipeline
- A policy that denies a specific unsafe tool call
- Known-good and known-bad input scenarios

**Web**: Click "Load Demo" to load the pipeline.

**CLI**:

```bash
reachctl init --name demo-check --governed
```

---

Trigger the run with the unsafe tool call scenario (pre-configured in the demo pack).

**Web**: Click "Run Demo Check" on the failing scenario.

**CLI**:

```bash
reachctl run demo-check --input '{"tool":"disallowed-tool","action":"execute"}'
```

**Expected result:**

- Run fails with `RL-1001 PolicyDenied`
- Policy gate `capability-check` fires
- Suggestion is displayed: "Add the tool to the capability allowlist"

---

### Step 3 — Show the Failing Gate (12–18 seconds)

View the policy explanation and suggested fix.

**Web**: Click "Explain Failure" on the failed run card.

**CLI**:

```bash
reachctl explain-failure <run-id>
```

**Expected output:**

```text
Run sha256:abc123 failed with: RL-1001 PolicyDenied

  Rule:       capability-check (order: 1)
  Reason:     tool 'disallowed-tool' is not in the capability allowlist
  Suggestion: Add the tool to the capability allowlist in your pack manifest.
```

---

### Step 4 — Apply the Fix (18–24 seconds)

Update the pack manifest to add the tool to the capability allowlist.

**Web**: Click "Apply Suggested Fix" to automatically apply the fix to the demo manifest.

**CLI**:

```bash
# Edit pack manifest to add tool to allowlist
reachctl run demo-check --input '{"tool":"allowed-tool","action":"execute"}'
```

**Expected result:**

- Run succeeds with `status: success`
- Fingerprint is displayed

---

### Step 5 — Replay Success (24–30 seconds)

Verify the successful run is deterministic by replaying it.

**Web**: Click "Verify Replay" on the successful run card.

**CLI**:

```bash
reachctl replay <run-id>
```

**Expected output:**

```text
✓ REPLAY_VERIFIED
  Original fingerprint:  sha256:def456
  Replay fingerprint:    sha256:def456
  Events replayed: 9
```

---

## OSS Mode Banner

When `REACH_CLOUD` is unset or `=0`, the playground displays:

```text
🛡 OSS Mode — Local Only
All runs are stored on your machine. No data is sent to external servers.
```

---

## Evidence Chain Visualization

At the end of the demo, the Evidence Chain visualization shows:

```text
[Input]       input_hash: sha256:2c6242...
     │
     ▼
[Policy]      policy_version: sha256:aabb12...
     │         verdict: ALLOW
     ▼
[Artifacts]   artifact_hashes: [sha256:ef5678...]
     │
     ▼
[Execution]   event_log_hash: sha256:9f86d0...
     │
     ▼
[Output]      output_hash: sha256:4b4da8...
     │
     ▼
[Fingerprint] sha256:7a8b9c... ✓ VERIFIED
```

Each hash is clickable and shows the raw artifact content for inspection.

---

## Requirements

### Web Demo

- `apps/arcade` built and running (`npm run dev -w arcade`)
- No cloud credentials required
- SQLite available (bundled)
- Demo pack at `data/demo_seed.json` pre-loaded

### CLI Demo

- `reachctl` binary built (`npm run verify:cli`)
- `~/.reach/` data directory writable
- No cloud credentials required

---

## Demo Failure Modes

| Failure                      | Resolution                              |
| :--------------------------- | :-------------------------------------- |
| `npm run dev` fails to start | Check Node version ≥18: `node -v`       |
| `reachctl not found`         | Build CLI: `npm run verify:cli`         |
| Port 3000 in use             | `REACH_PORT=3001 npm run dev -w arcade` |
| SQLite error                 | Check writable tmp: `ls -la /tmp/`      |
| Demo pack not found          | Seed data: `npm run seed`               |

---

## Screen Recording Notes

For demos and screencasts:

- Use `--no-color` for better video capture.
- Use `reachctl run demo-check --json` for automated pipeline demos.
- The fingerprint hash should always end in exactly the same characters between takes to visually confirm determinism.

---

## Related Documents

- [`docs/EVIDENCE_CHAIN_MODEL.md`](EVIDENCE_CHAIN_MODEL.md) — Evidence chain details
- [`docs/CLI_REFERENCE.md`](CLI_REFERENCE.md) — Full CLI reference
- [`docs/REPLAY_PROTOCOL.md`](REPLAY_PROTOCOL.md) — How replay verification works
