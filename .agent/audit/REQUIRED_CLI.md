# Required CLI Commands - Build Spec

## Command Inventory

### P0: Must Ship - Local Commands

#### 1. `reach doctor`
**Status**: EXISTS ✅  
**Binary**: `tools/doctor/main.go`  
**Inputs**: `--json`, `--fix`  
**Outputs**: Health check results, remediation steps  
**Error Behavior**: Exit 1 if issues found  
**Example**:
```bash
$ reach doctor
reach doctor (darwin/arm64)
✓ git installed
✓ go installed (1.21.0)
✓ node installed (20.9.0)
✓ reach.db accessible
```

---

#### 2. `reach version`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Inputs**: None  
**Outputs**: Version, Go version, platform  
**Error Behavior**: Never fails  
**Example**:
```bash
$ reach version
Reach v0.3.3
  Go Version: go1.21.0
  Platform:   darwin/arm64
```

---

#### 3. `reach demo`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/demo_cmd.go`  
**Subcommands**: `smoke`, `run`, `status`  
**Inputs**: `[subcommand]`  
**Outputs**: Demo execution results  
**Error Behavior**: Exit 1 on failure  
**Example**:
```bash
$ reach demo smoke
Running smoke test...
✓ Determinism verified
✓ Capsule created
✓ Replay verified
```

---

#### 4. `reach quickstart` / `reach bootstrap`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Inputs**: `--fixture-mode`  
**Outputs**: Bootstrap completion status  
**Error Behavior**: Exit 1 on failure  
**Example**:
```bash
$ reach quickstart
Initializing deterministic local artifacts...
✓ Data directory: ./data
✓ Demo pack created
✓ Sample run completed
Next: reach run my-pack
```

---

#### 5. `reach status`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Inputs**: `--json`  
**Outputs**: Component health, reconciliation status  
**Error Behavior**: Exit 0 with degraded status  
**Example**:
```bash
$ reach status
Mode: OSS
Storage: ✓ reachable
Registry: ✓ 12 packs
Determinism: ✓ WASM available
```

---

#### 6. `reach capsule <create|verify|replay>`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Subcommands**:
- `create <runId> [--output file]` - Export run to capsule
- `verify <file>` - Verify capsule integrity
- `replay <file>` - Replay capsule

**Inputs**: Run ID or file path  
**Outputs**: Capsule metadata, verification results  
**Error Behavior**: Exit 1 if verification fails  
**Example**:
```bash
$ reach capsule create run-123 --output my-run.capsule.json
{"capsule": "my-run.capsule.json", "run_id": "run-123", "fingerprint": "abc123..."}

$ reach capsule verify my-run.capsule.json
{"verified": true, "run_fingerprint": "abc123..."}
```

---

#### 7. `reach proof <verify|explain>`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Subcommands**:
- `verify <runId>` - Verify execution proof
- `explain <runId> [--step N]` - Explain proof steps

**Inputs**: Run ID, optional step index  
**Outputs**: Verification status, explanation  
**Error Behavior**: Exit 1 if proof invalid  
**Example**:
```bash
$ reach proof verify run-123
{"run_id": "run-123", "deterministic": true, "audit_root": "sha256:..."}

$ reach proof explain run-123 --step 0
Step 0: Input canonicalization
  Input fingerprint: sha256:...
  Policy gate: integrity-shield
  Result: PASS
```

---

#### 8. `reach replay <runId>`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Inputs**: Run ID  
**Outputs**: Replay verification  
**Error Behavior**: Exit 1 if replay differs  
**Example**:
```bash
$ reach replay run-123
Replaying run-123...
✓ Replay verified (100% match)
```

---

#### 9. `reach verify-determinism`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Inputs**: `--trials N`  
**Outputs**: Determinism verification report  
**Error Behavior**: Exit 1 if non-deterministic  
**Example**:
```bash
$ reach verify-determinism
Running 3 trials...
Trial 1: ✓ fingerprint match
Trial 2: ✓ fingerprint match
Trial 3: ✓ fingerprint match
✓ Determinism verified
```

---

#### 10. `reach packs <search|install|verify>`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Subcommands**:
- `search <query>` - Search pack registry
- `install <name>` - Install pack
- `verify <name>` - Verify pack integrity

**Inputs**: Pack name or query  
**Outputs**: Pack list, install status  
**Error Behavior**: Exit 1 if pack not found/invalid  
**Example**:
```bash
$ reach packs search sentinel
Found: sentinel-v1.2.0, sentinel-lite-v1.0.0

$ reach packs install sentinel
✓ Installed sentinel-v1.2.0
```

---

#### 11. `reach run <pack>`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Inputs**: Pack name, optional flags  
**Outputs**: Run results, run ID  
**Error Behavior**: Exit 4 if policy blocked  
**Example**:
```bash
$ reach run my-pack
Run ID: run-456
Status: COMPLETE
Output: {...}
```

---

#### 12. `reach bugreport`
**Status**: EXISTS ✅  
**Binary**: `services/runner/cmd/reachctl/main.go`  
**Inputs**: `--output <file>`  
**Outputs**: Sanitized diagnostic zip  
**Error Behavior**: Exit 1 if cannot write  
**Example**:
```bash
$ reach bugreport --output diagnostic.zip
Bug report: diagnostic.zip
Contains: logs, env metadata (redacted), system status
```

---

### P0: Must Ship - Cloud Commands (Hybrid)

#### 13. `reach login`
**Status**: MISSING ❌  
**Spec**: 
- Inputs: `--token`, `--api-key`, `--browser`
- Outputs: Auth success/failure, token storage
- Scope: Hybrid (local + cloud)
- Security: Token stored in `~/.reach/credentials`

**Example**:
```bash
$ reach login
Opening browser for authentication...
✓ Logged in as user@company.com
Org: my-org (active)
```

**Data Dependencies**: Cloud auth API at `api.reach.dev`

---

#### 14. `reach logout`
**Status**: MISSING ❌  
**Spec**:
- Inputs: `--all` (revoke all sessions)
- Outputs: Logout confirmation
- Scope: Hybrid
- Security: Clears local credentials

**Example**:
```bash
$ reach logout
✓ Logged out
Local credentials cleared.
```

---

#### 15. `reach org <list|select>`
**Status**: MISSING ❌  
**Spec**:
- Subcommands: `list`, `select <org-id>`
- Inputs: Org ID for select
- Outputs: Org list or selection confirmation
- Scope: Cloud

**Example**:
```bash
$ reach org list
my-org (active) - Pro Plan
other-org - OSS

$ reach org select other-org
✓ Switched to other-org
```

---

### P1: Next 2 Weeks - Missing Commands

#### 16. `reach gate <list|create|run|connect>`
**Status**: PARTIAL ⚠️  
**Current**: Basic gate command exists  
**Missing**:
- [ ] `reach gate connect` (for GitHub integration)
- [ ] `reach gate create --from-template`
- [ ] `reach gate status`

**Spec**:
```bash
$ reach gate list
integrity-shield (active)
sentinel-policy (active)

$ reach gate connect github
Connecting to GitHub...
✓ Webhook configured for org/repo
✓ PR gate enabled

$ reach gate create --name my-gate --template integrity
✓ Gate created: my-gate
```

---

#### 17. `reach eval <run|compare|list>`
**Status**: MISSING ❌  
**Spec**:
- Subcommands: `run`, `compare <runA> <runB>`, `list`
- Scope: Local-first with cloud sync option
- Outputs: Eval results, comparison reports

**Example**:
```bash
$ reach eval run --pack my-pack --dataset test-suite
Eval run: eval-789
Results: 45/45 passed

$ reach eval compare eval-789 eval-790
Comparing eval-789 vs eval-790...
Differences: 2 steps
  Step 3: output changed
  Step 7: latency +15%
```

**Data Dependencies**: Local eval storage, optional cloud sync

---

#### 18. `reach artifacts <list|export|sync>`
**Status**: MISSING ❌  
**Spec**:
- Subcommands: `list`, `export <runId>`, `sync`
- Scope: Hybrid
- Outputs: Artifact listing, export paths

**Example**:
```bash
$ reach artifacts list
run-123 (local) - 2026-02-25
run-456 (cloud) - 2026-02-24

$ reach artifacts sync
Syncing to cloud...
✓ 3 artifacts uploaded
```

---

#### 19. `reach config <get|set|list>`
**Status**: EXISTS ✅ (partial)  
**Current**: `reach config` exists but limited  
**Missing**:
- [ ] `reach config list` (show all)
- [ ] `reach config unset <key>`
- [ ] JSON mode for scripting

---

#### 20. `reach cloud status`
**Status**: MISSING ❌  
**Spec**:
- Inputs: None
- Outputs: Cloud connection status, quota, plan
- Scope: Cloud

**Example**:
```bash
$ reach cloud status
Connected: ✓
Plan: Pro
Org: my-org
Quota: 450/1000 runs this month
```

---

### P2: Backlog - Future Commands

#### 21. `reach api-key <list|create|revoke>`
**Status**: MISSING ❌  
**Priority**: P1  
**Scope**: Cloud

#### 22. `reach webhook <list|create|delete>`
**Status**: MISSING ❌  
**Priority**: P2  
**Scope**: Cloud

#### 23. `reach analytics`
**Status**: MISSING ❌  
**Priority**: P2  
**Scope**: Cloud

#### 24. `reach runner <list|status>`
**Status**: MISSING ❌  
**Priority**: P2  
**Scope**: Cloud

#### 25. `reach team <list|invite|remove>`
**Status**: MISSING ❌  
**Priority**: P2  
**Scope**: Cloud

---

## Command Matrix Summary

| Category | Total | Exists | Missing | Priority |
|----------|-------|--------|---------|----------|
| Core Local | 12 | 12 | 0 | P0 |
| Auth/Cloud | 3 | 0 | 3 | P0 |
| Governance | 4 | 1 | 3 | P1 |
| Eval/Testing | 3 | 0 | 3 | P1 |
| Config/Misc | 6 | 2 | 4 | P1/P2 |

**Total Commands Required for Launch**: 15 (12 local + 3 auth)
**Total Commands Implemented**: 14
**Gap**: 1 command (`reach login/logout` as single unit)
