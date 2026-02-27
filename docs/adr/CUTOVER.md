# Reach CLI + Requiem Cutover Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-26  
**Status:** PRODUCTION READY

---

## Executive Summary

This document describes the completed M5 cutover from Reach CLI to the Requiem engine. The cutover is **operator-proof** with comprehensive safety mechanisms, adaptive dual-run sampling, and clear rollback procedures.

---

## Quick Start

```bash
# Verify cutover status
npm run verify:cutover

# Check dual-run sampling
npm run verify:dual-run

# Full doctor check
npm run reach:doctor:cutover
```

---

## Safety Posture

### Default Behavior

| Scenario | Default Engine | Fallback Chain |
|----------|---------------|----------------|
| Clean environment | **Requiem** | Rust → TypeScript |
| Requiem unavailable | **Rust** | TypeScript |
| Both unavailable | **TypeScript** | None |

### Force Flags

Use these environment variables to override auto-selection:

```bash
# Force Requiem (fail if unavailable)
export FORCE_REQUIEM=1
unset FORCE_RUST

# Force Rust/WASM (fail if unavailable)
export FORCE_RUST=1
unset FORCE_REQUIEM

# Reset to auto-selection
unset FORCE_REQUIEM FORCE_RUST
```

### Safety Guards

The following checks are performed at **every execution entrypoint**:

1. **FORCE_RUST/FORCE_REQUIEM Validation** — If set, verifies the actual engine matches
2. **Engine Change Detection** — Logs when engine switches (prevents silent fallback)
3. **Binary Trust Verification** — Validates Requiem binary hash and permissions
4. **Environment Sanitization** — Filters secrets from child process environment

---

## reach doctor

The enhanced doctor command provides authoritative status:

```bash
# Human-readable output
npx tsx src/cli/reach-cli.ts doctor

# JSON output for automation
npx tsx src/cli/reach-cli.ts doctor --json
```

### Output Sections

```
🩺 Reach Cutover Doctor

Overall Status: ✅ Healthy

Engine Configuration
══════════════════════════════════════════════════
Primary: requiem
Fallback: rust
Mode: auto
Reason: Requiem is available and is the preferred engine

Protocol: 1.0.0
Hash: blake3
Determinism: verified

Dual-Run: enabled
Sampling Rate: 1.0%
Workloads: 150 (142 stable)

Rollback Instructions
══════════════════════════════════════════════════
Current Engine: requiem
Rollback Available: yes
Rollback To: rust
Command: export FORCE_RUST=1 && unset FORCE_REQUIEM

Environment Quick Reference
══════════════════════════════════════════════════
FORCE_REQUIEM: <unset>
FORCE_RUST: <unset>
REACH_DUAL_RUN: 1
```

---

## Dual-Run Sampling

### Adaptive Sampling Algorithm

| Condition | Sampling Rate | Duration |
|-----------|--------------|----------|
| New tenant | **100%** | Until 100 stable runs |
| New engine version | **100%** | Until 100 stable runs |
| New algorithm | **100%** | Until 100 stable runs |
| Stable workload | **1%** (configurable) | Ongoing |
| Post-mismatch | **100%** | Until 100 consecutive matches |

### Taper Schedule

After the initial 100% sampling period, rates taper gradually:

```
Rate = max(base_rate, 1.0 - (consecutive_matches / stability_threshold))
```

Example with base_rate=1% and threshold=100:
- Matches 0-50: 100% → 50% sampling
- Matches 50-99: 50% → 1% sampling
- Matches 100+: 1% sampling

### Diff Reports

Diff reports are stored in `.reach/engine-diffs/`:

```json
{
  "version": "dual-run-diff.v1",
  "requestId": "req_abc123",
  "timestamp": "2026-02-26T20:00:00Z",
  "tenantId": "tenant_hash",
  "engineVersion": "1.0.0",
  "contractVersion": "1.0.0",
  "algorithm": "minimax_regret",
  "match": true,
  "differences": [],
  "canonicalComparison": {
    "primaryFingerprint": "abc...",
    "secondaryFingerprint": "abc...",
    "fingerprintMatch": true
  },
  "samplingMetadata": {
    "rateApplied": 0.01,
    "isNewTenant": false,
    "isNewVersion": false,
    "isNewAlgorithm": false,
    "stabilityCount": 150
  }
}
```

### Storage Location

```
.reach/
├── engine-diffs/          # Diff reports (JSON)
│   ├── req_abc123.json
│   └── req_def456.json
├── events/                # Control plane events (JSONL)
│   ├── events-2026-02-26T20-00-00-000Z-0000.jsonl
│   └── events-2026-02-26T20-01-00-000Z-0001.jsonl
└── ...
```

---

## Error Types

Clear, actionable error codes for operator visibility:

| Code | Severity | Retryable | Description |
|------|----------|-----------|-------------|
| `mismatch` | CRITICAL | No | Engine results don't match |
| `queue_full` | WARNING | Yes | Request queue at capacity |
| `policy_violation` | ERROR | No | Policy rule blocked execution |
| `cas_integrity` | CRITICAL | No | Content-addressed storage hash mismatch |
| `sandbox_escape` | CRITICAL | No | Security boundary violation |
| `engine_unavailable` | ERROR | Yes | Primary engine not available |
| `request_too_large` | ERROR | No | Request exceeds size limits |
| `matrix_too_large` | ERROR | No | Decision matrix too large |

---

## Control Plane Event Export

### JSONL Event Stream

Events are exported to `.reach/events/` in JSONL format for ReadyLayer integration:

```json
{"schema_version":"1.0.0","event_type":"execution_start","timestamp":"2026-02-26T20:00:00Z","event_id":"evt_abc123","request_id":"req_xyz789","tenant_id":"tenant_hash","engine_version":"1.0.0","contract_version":"1.0.0","protocol_version":"1.0.0","algorithm":"minimax_regret","engine_type":"requiem","dual_run_enabled":true,"sampling_rate":1.0}
{"schema_version":"1.0.0","event_type":"execution_complete","timestamp":"2026-02-26T20:00:01Z","event_id":"evt_def456","request_id":"req_xyz789","tenant_id":"tenant_hash","engine_version":"1.0.0","contract_version":"1.0.0","protocol_version":"1.0.0","algorithm":"minimax_regret","engine_type":"requiem","fingerprint":"fp_abc123","confidence":0.95,"duration_ms":150,"status":"success","recommended_action_hash":"hash_def456","dual_run_performed":true,"dual_run_match":true,"action_count":3,"state_count":2}
```

### Schema Stability

- **Additive-only changes** — New fields may be added, existing fields never removed
- **No secrets** — All sensitive data is hashed or redacted
- **Stable identifiers** — Tenant IDs are hashed, action names are hashed

### Event Types

- `execution_start` — Request received
- `execution_complete` — Request processed successfully
- `execution_error` — Error during processing
- `engine_switch` — Engine changed (fallback/rollback)
- `dual_run_mismatch` — Dual-run comparison failed
- `policy_violation` — Policy blocked execution
- `rollback` — Rollback operation performed

---

## Rollback Procedures

### Automatic Detection

The system detects when fallback occurs and logs warnings:

```
[SAFETY] Engine changed from requiem to rust at 2026-02-26T20:00:00Z
```

### Manual Rollback

If you need to rollback due to issues:

```bash
# Check current status
npm run reach:doctor:cutover

# Rollback to Rust
export FORCE_RUST=1
unset FORCE_REQUIEM

# Verify rollback
npm run reach:doctor:cutover

# To rollback further to TypeScript
unset FORCE_RUST

# To restore Requiem
unset FORCE_RUST
export FORCE_REQUIEM=1
```

### Emergency Stop

To disable fallback entirely (fail fast mode):

```bash
export REACH_NO_FALLBACK=1
```

---

## Verification Commands

### verify:cutover

Validates the cutover is complete:

```bash
npm run verify:cutover
# or
npx tsx scripts/verify-cutover.ts
```

Checks:
- Requiem is available
- Requiem is default in auto mode
- Safety guards are active
- Rollback is available
- Environment variables are valid
- Error types are properly exported
- Dual-run sampler is working
- Event export is ready

### verify:dual-run

Validates dual-run sampling:

```bash
npm run verify:dual-run
# or
npx tsx scripts/verify-dual-run.ts
```

Checks:
- Adaptive sampling (100% → taper → base)
- Diff report storage
- Canonical comparison (not presentation)
- Stability tracking
- Event export integration

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FORCE_REQUIEM` | `<unset>` | Force Requiem engine |
| `FORCE_RUST` | `<unset>` | Force Rust/WASM engine |
| `REACH_DUAL_RUN` | `0` | Enable dual-run sampling |
| `REACH_DUAL_RUN_RATE` | `0.01` | Base sampling rate |
| `REACH_NO_FALLBACK` | `0` | Disable fallback (fail fast) |
| `REQUIEM_BIN` | `<auto>` | Path to Requiem binary |

### Sampling Configuration

```typescript
const config = {
  baseRate: 0.01,           // 1% for stable workloads
  newTenantRate: 1.0,       // 100% for new tenants
  newVersionRate: 1.0,      // 100% for new versions
  newAlgorithmRate: 1.0,    // 100% for new algorithms
  stabilityThreshold: 100,  // Runs before tapering
  diffStoragePath: '.reach/engine-diffs',
};
```

---

## Troubleshooting

### Issue: Requiem not available

```bash
# Check if binary exists
which requiem
ls -la ./requiem

# Set explicit path
export REQUIEM_BIN=/usr/local/bin/requiem
```

### Issue: Silent fallback occurring

```bash
# Check for warnings
npm run reach:doctor:cutover

# Force the desired engine
export FORCE_REQUIEM=1
```

### Issue: Dual-run mismatches

```bash
# Review diff reports
ls -la .reach/engine-diffs/
cat .reach/engine-diffs/req_*.json

# Check stability stats
npm run verify:dual-run
```

### Issue: Event export not working

```bash
# Check directory exists
mkdir -p .reach/events

# Check permissions
ls -la .reach/
```

---

## Contract Guarantees

1. **No Silent Fallback** — All engine changes are logged
2. **Deterministic Hashing** — Same input always produces same fingerprint
3. **Additive Schema** — Event schema only grows, never breaks
4. **No Secrets in Events** — All sensitive data is hashed
5. **100% Sampling for New Workloads** — New tenants/versions/algorithms are fully sampled
6. **Clear Rollback Path** — Rollback instructions are always available

---

## Support

For issues or questions:

1. Run `npm run reach:doctor:cutover` for diagnostics
2. Check `.reach/engine-diffs/` for mismatch details
3. Review `.reach/events/` for execution history
4. Use `FORCE_RUST=1` as immediate rollback if needed
