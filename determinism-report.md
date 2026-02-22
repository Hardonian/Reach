# Determinism Audit Report

**Scan ID:** `18c77592ac45f607`

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 311 |
| 🟡 MEDIUM | 460 |
| 🟢 LOW | 186 |
| **Total** | **957** |

**Files Scanned:** 625
**Proof Hash Risks (CRITICAL in engine paths):** 18

## 🔴 Critical Findings

These findings may directly compromise proof hash stability. Fix before merging.

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/run/route.ts:38`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
{ timestamp: Date.now(), type: 'policy.gate.check', status: 'success', details: 'Allow policies: ' + (pack.policyConstra
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/run/route.ts:39`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
{ timestamp: Date.now() + 50, type: 'execution.queued', status: 'pending', id: `run-${Math.random().toString(36).substri
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/run/route.ts:40`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
{ timestamp: Date.now() + 200, type: 'execution.admitted', status: 'running' },
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/run/route.ts:41`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
{ timestamp: Date.now() + 400, type: 'tool.call', tool: pack.tools[0], inputs: inputs },
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/run/route.ts:42`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
{ timestamp: Date.now() + 800, type: 'tool.result', output: 'Simulated strict output result.' },
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/run/route.ts:43`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
{ timestamp: Date.now() + 1000, type: 'execution.completed', status: 'success' },
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/run/route.ts:50`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
runId: `run-${Date.now()}`,
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/run/route.ts:39`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
{ timestamp: Date.now() + 50, type: 'execution.queued', status: 'pending', id: `run-${Math.random().toString(36).substri
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/auth/github/callback/route.ts:112`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const finalSlug = getTenantBySlug(baseSlug) ? `${baseSlug}-${Date.now()}` : baseSlug;
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/auth/magic-link/route.ts:41`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/auth/magic-link/route.ts:103`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const finalSlug = getTenantBySlug(slug) ? `${slug}-${Date.now()}` : slug;
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/execute/route.ts:40`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
await new Promise((r) => setTimeout(r, 400 + Math.floor(Math.random() * 400)));
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/playground/route.ts:92`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
await new Promise((r) => setTimeout(r, 600 + Math.floor(Math.random() * 400)));
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/simulate/page.tsx:84`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
id: v.id ?? `v${Math.random().toString(36).slice(2, 6)}`,
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/stitch/console/pages/AdversarialSafetyMonitor.tsx:79`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
<div key={i} className={`flex-1 transition-all rounded-t ${i === 12 || i === 18 ? 'bg-red-500/80 hover:bg-red-500' : 'bg
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/stitch/console/pages/BillingChargeback.tsx:81`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
<div className="absolute bottom-0 w-full bg-[#137fec] rounded-t hover:bg-blue-400 transition-all cursor-help" style={{ h
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/stitch/console/pages/CostOptimization.tsx:60`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
<div key={i} className="flex-1 bg-[#135bec]/20 hover:bg-[#135bec]/40 transition-all rounded-t relative group" style={{ h
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/ab.ts:45`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/ab.ts:44`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
const assigned: Variant = Math.random() < 0.5 ? 'A' : 'B';
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/cloud-auth.ts:45`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/cloud-auth.ts:45`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/api-keys.ts:12`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:71`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const since = new Date(Date.now() - 86400000).toISOString();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:206`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/gate-engine.ts:26`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const now = Math.floor(Date.now() / 1000);
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/marketplace-api.ts:381`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
workflowId: `workflow-${Date.now()}`,
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/marketplace-api.ts:389`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
id: `pack-${Date.now()}`,
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/providers/provider-adapter.ts:313`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/ratelimit.ts:28`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const now = Date.now();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:40`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:81`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const toolStart = new Date(Date.now() + i * 100).toISOString();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:83`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const toolEnd = new Date(Date.now() + i * 100 + toolDuration).toISOString();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:151`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const completedAt = new Date(Date.now() + totalDurationMs).toISOString();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:40`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:82`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
const toolDuration = 50 + Math.floor(Math.random() * 200);
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:161`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
inputTokens: 1200 + Math.floor(Math.random() * 800),
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:162`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
outputTokens: 600 + Math.floor(Math.random() * 400),
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:208`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
const checksRun = 8 + Math.floor(Math.random() * 8);
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/skills.ts:133`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
id: `comp-${Date.now()}`,
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/simulation-runner.ts:25`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const start = Date.now();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/simulation-runner.ts:79`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const latency_ms = Date.now() - start;
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/simulation-runner.ts:97`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
latency_ms: Date.now() - start,
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:166`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
if (Date.now() - this.lastFailureTime >= this.timeoutMs) {
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:196`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
this.lastFailureTime = Date.now();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:239`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const now = Date.now();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:249`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
lastRefill = Date.now();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:285`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const now = Date.now();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:300`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
return 60000 - (Date.now() - this.lastRefill) % 60000;
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:304`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
return 3600000 - (Date.now() - this.lastRefill) % 3600000;
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:447`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const startTime = Date.now();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:464`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
execution_time_ms: Date.now() - startTime,
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:492`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
execution_time_ms: Date.now() - startTime,
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/core/evaluation/engine.go:43`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp:          time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/core/evaluation/engine.go:177`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
f.CreatedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/core/evaluation/engine.go:197`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
cutoff := time.Now().UTC().AddDate(0, 0, -windowDays)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/docs.go:137`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
GeneratedAt: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/publisher.go:168`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
PublishedAt:     time.Now().UTC().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/publisher.go:201`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
VerifiedAt:      time.Now().UTC().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/scoring.go:119`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/scripts/scan-determinism.ts:36`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
description: "Date.now() produces nondeterministic timestamps",
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/scripts/scan-determinism.ts:44`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
description: "Math.random() is nondeterministic",
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/scripts/validate-import-boundaries.js:476`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const t0 = Date.now();
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/scripts/validate-import-boundaries.js:494`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const elapsed      = Date.now() - t0;
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/capsule-sync/internal/store/store.go:58`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/capsule-sync/internal/store/store.go:100`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
current.UpdatedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace.go:245`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
s.installIntents[key] = intentEntry{response: resp, expiresAt: time.Now().Add(10 * time.Minute)}
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace.go:279`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if time.Now().After(entry.expiresAt) {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace.go:308`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if len(cache.items) > 0 && time.Now().Before(cache.expiresAt) {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace.go:329`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
s.catalogCache = catalogCacheEntry{items: append([]MarketplaceItem{}, items...), etag: etag, modified: modified, expires
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server_test.go:40`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
deadline := time.Now().Add(1 * time.Second)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server_test.go:41`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
for time.Now().Before(deadline) {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server_test.go:163`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
_, _ = rand.Read(key)
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server_test.go:206`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
_, _ = rand.Read(mask[:])
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server.go:112`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
s.editors[id] = &editorState{id: id, registeredAt: time.Now()}
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server.go:178`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
editor.lastHeartbeat = time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server.go:203`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
editor.lastHeartbeat = time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server.go:409`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
if _, err := rand.Read(buf); err != nil {
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server_test.go:88`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
timestamp := fmt.Sprint(time.Now().Unix())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server_test.go:125`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
req.Header.Set("X-Reach-Timestamp", fmt.Sprint(time.Now().Unix()))
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server_test.go:151`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
req.Header.Set("X-Reach-Timestamp", fmt.Sprint(time.Now().Unix()))
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server_test.go:272`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if rec := mk("d1", fmt.Sprint(time.Now().Unix())); rec.Code != http.StatusOK {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server_test.go:275`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if rec := mk("d1", fmt.Sprint(time.Now().Unix())); rec.Code != http.StatusUnauthorized {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server_test.go:278`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if rec := mk("d2", fmt.Sprint(time.Now().Add(-10*time.Minute).Unix())); rec.Code != http.StatusUnauthorized {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server_test.go:292`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := fmt.Sprint(time.Now().Unix())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server.go:70`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server.go:135`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if err := s.store.SaveToken(tenantID, provider, encAccess, encRefresh, time.Now().Add(time.Hour).UTC().Format(time.RFC33
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server.go:164`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if err := verifySignature(provider, secret, r, body, time.Now().UTC()); err != nil {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server.go:236`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
in.CreatedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server.go:257`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
e := core.NormalizedEvent{SchemaVersion: core.SchemaVersion, EventID: randToken(), TenantID: tenantID, Provider: provide
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server.go:305`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
_, _ = rand.Read(buf)
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/providers/providers.go:41`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
EventID:       fmt.Sprintf("%s-%d", provider, time.Now().UnixNano()),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/providers/providers.go:44`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
OccurredAt:    time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/router/router.go:107`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if time.Now().Before(d.circuitUntil) {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/router/router.go:125`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
d.circuitUntil = time.Now().Add(20 * time.Second)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/router/router.go:100`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
jitter := time.Duration(rand.Intn(50)) * time.Millisecond
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/security/security.go:91`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:30`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
path = filepath.Join(os.TempDir(), fmt.Sprintf("reach-integration-%d.sqlite", time.Now().UnixNano()))
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:89`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
state, tenantID, provider, time.Now().UTC())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:116`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
tenantID, provider, accessToken, refreshToken, expiresAt, string(scopeJSON), time.Now().UTC())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:177`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
e.EventID, e.TenantID, e.Provider, e.TriggerType, encoded[:n], time.Now().UTC())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:240`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
tenantID, action, encoded[:n], time.Now().UTC())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:287`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
tenantID, time.Now().Add(-maxAge).UTC())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:291`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
tenantID+":"+provider+":"+nonce, tenantID, time.Now().UTC())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:320`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:358`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
tenantID, profile, time.Now().UTC())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-eval/main.go:114`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
runID := fmt.Sprintf("eval-%s-%d", test.ID, time.Now().Unix())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:105`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
startTime: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:285`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
"created_at":   time.Now().UTC().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:306`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
"created_at": time.Now().UTC().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:626`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:            time.Now().UTC().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:717`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
corrID = "corr_" + strings.ReplaceAll(strconv.FormatInt(time.Now().UnixNano(), 36), " ", "")
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:754`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:829`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
v = &visitor{lastSeen: time.Now()}
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:839`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
v.lastSeen = time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:572`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
"timestamp": time.Now().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:2113`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
PublishedAt:     time.Now().UTC().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:2828`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
w.State.RunID = fmt.Sprintf("run-%d", time.Now().Unix())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:2836`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
{"step": 1, "action": "init", "ts": time.Now().UTC().Format(time.RFC3339)},
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:2993`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
runID := fmt.Sprintf("run-%d", time.Now().Unix())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3026`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
"ts":     time.Now().UTC().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3923`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return stableHash(map[string]any{"pack": *packID, "ts": time.Now().Format(time.RFC3339)}), nil
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3952`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3988`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
"timestamp":       time.Now().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3998`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
benchFile := filepath.Join(dataRoot, "benchmarks", fmt.Sprintf("benchmark_%s_%d.json", *packID, time.Now().Unix()))
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:4110`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
"checkpoint_id": runID + "-" + time.Now().Format("20060102150405"),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:4514`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
"timestamp":        time.Now().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/activity.go:123`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
entry.Timestamp = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `UUID_V4` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/bridge.go:41`

**Description:** UUID v4 generation is nondeterministic

**Snippet:**
```
taskID := TaskID(uuid.New().String())
```
**Remedy:** Derive IDs deterministically from content hash
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/runtime.go:139`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
startedAt := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/runtime.go:159`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CompletedAt: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/runtime.go:277`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
result.Metrics.CompletedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/runtime.go:312`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
completedAt := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/runtime.go:444`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/runtime.go:463`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/handlers.go:152`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
started:      time.Now(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/handlers.go:166`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server_test.go:118`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:235`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
s.handshakes[challenge] = mobileHandshakeChallenge{Challenge: challenge, NodeID: body.NodeID, OrgID: body.OrgID, PubKey:
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:380`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
started := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:443`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if err != nil || sess.ExpiresAt.Before(time.Now()) {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:463`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:496`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
started := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:517`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_ = s.store.PublishEvent(r.Context(), run.ID, jobs.Event{Type: "trigger.received", Payload: payload, CreatedAt: time.Now
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:556`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_ = s.store.PublishEvent(r.Context(), parentID, jobs.Event{Type: "spawn.denied", Payload: mustJSON(map[string]any{"paren
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:607`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "tool.result.accepted", Payload: mustJSON(map[string]any{"
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:630`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:635`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
started := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:667`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:712`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
n.LastHeartbeatAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:716`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
n.UpdatedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:920`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
_, _ = rand.Read(b)
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/arcade/gamification/achievements.go:81`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
UpdatedAt: time.Now(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/arcade/gamification/achievements.go:118`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
e.progress.UpdatedAt = time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/arcade/gamification/achievements.go:132`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/arcade/gamification/achievements.go:279`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
UpdatedAt: time.Now(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/audit/receipts.go:37`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/notification_test.go:10`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/notification.go:38`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
n.At = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator_test.go:85`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return &jobs.AutonomousSession{Goal: "g", MaxIterations: 10, MaxToolCalls: 20, MaxRuntime: time.Minute, StartedAt: time.
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator_test.go:199`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
s.StartedAt = time.Now().Add(-time.Second)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:145`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
burstDeadline := time.Now().UTC().Add(scheduler.burstForIteration(session.IterationCount))
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:146`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
for time.Now().UTC().Before(burstDeadline) {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:153`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
session.UpdatedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:160`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
session.UpdatedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:298`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
session.UpdatedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:384`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return l.Store.PublishEvent(ctx, runID, jobs.Event{Type: event, Payload: body, CreatedAt: time.Now().UTC()}, "autonomous
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:394`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
"timestamp":       time.Now().UTC().Format(time.RFC3339Nano),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:399`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if err := l.Store.PublishEvent(ctx, runID, jobs.Event{Type: "autonomous.checkpoint", Payload: capsule, CreatedAt: time.N
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `UUID_V4` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:280`

**Description:** UUID v4 generation is nondeterministic

**Snippet:**
```
ID:        uuid.New().String(),
```
**Remedy:** Derive IDs deterministically from content hash
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/backpressure/backpressure_test.go:116`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/backpressure/backpressure.go:245`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
lastAdjustment: time.Now(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/backpressure/backpressure.go:282`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
ab.lastAdjustment = time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/backpressure/circuit.go:163`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
atomic.StoreInt64(&cb.lastFailure, time.Now().Unix())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/backpressure/circuit.go:175`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
cb.openedAt = time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/stress_test.go:47`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
t1 := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/reach_error.go:128`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/reputation_v2.go:258`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UnixNano()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/reputation_v2.go:392`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
nr.lastCircuitOpen.Store(time.Now().Unix())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/reputation_v2.go:426`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp:      time.Now().Unix(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/reputation_v2.go:525`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp:      time.Now().Unix(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/reputation_v2.go:764`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
nr.lastCircuitOpen.Store(time.Now().Unix())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/budget.go:110`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
timestamp: time.Now(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/budget.go:376`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
bc.projectionModel.AddPoint(time.Now().Unix(), actualCost)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/budget.go:400`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
trendProjection := bc.projectionModel.Predict(time.Now().Add(time.Minute).Unix())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/dag_executor.go:56`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/event_schema_test.go:25`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_, err = store.AppendEvent(context.Background(), run.ID, Event{Type: "tool.result", Payload: []byte(`{"tool":"echo"}`), 
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/event_schema_test.go:58`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_, err = store.AppendEvent(context.Background(), run.ID, Event{Type: "tool.result", Payload: []byte(`{"schemaVersion":"1
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/queue.go:56`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
job.NextRunAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/queue.go:61`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/queue.go:66`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
token := fmt.Sprintf("lease-%d", time.Now().UnixNano())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/queue.go:67`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
jobs, err := q.db.LeaseReadyJobs(ctx, time.Now().UTC(), limit, token, leaseFor)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/queue.go:72`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return q.db.CompleteJob(ctx, jobID, leaseToken, resultJSON, time.Now().UTC())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/queue.go:86`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return time.Now().UTC().Add(time.Duration(base)*time.Second + jitter)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store_test.go:22`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if _, err := store.AppendEvent(context.Background(), run.ID, Event{Type: "x", Payload: []byte(`{}`), CreatedAt: time.Now
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:222`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:231`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:282`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
evt.CreatedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:372`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return s.PublishEvent(context.Background(), runID, Event{Type: "policy.gate.stored", Payload: body, CreatedAt: time.Now(
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:380`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return s.PublishEvent(context.Background(), runID, Event{Type: "policy.gate.resolved", Payload: body, CreatedAt: time.No
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:384`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return s.audit.AppendAudit(ctx, storage.AuditRecord{TenantID: tenantID, RunID: runID, Type: typ, Payload: payload, Creat
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:401`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mcpserver/audit.go:39`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_ = l.Store.PublishEvent(ctx, entry.RunID, jobs.Event{Type: "tool.audit", Payload: body, CreatedAt: time.Now().UTC()}, "
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mcpserver/audit.go:66`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_ = l.Store.PublishEvent(ctx, entry.RunID, jobs.Event{Type: "audit.trail", Payload: body, CreatedAt: time.Now().UTC()}, 
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mcpserver/runner_loop.go:36`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if publishErr := r.Store.PublishEvent(ctx, runID, jobs.Event{Type: evtType, Payload: body, CreatedAt: time.Now().UTC()},
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/config.go:275`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return fmt.Sprintf("reach-%d", time.Now().UnixNano())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/correlation_test.go:171`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp:     time.Now().UTC().Add(-10 * time.Minute),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/correlation.go:21`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return CorrelationID(fmt.Sprintf("cid-%d", time.Now().UnixNano()))
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/correlation.go:127`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
entry.Timestamp = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/correlation.go:222`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
cutoff := time.Now().UTC().Add(-maxAge)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/correlation.go:19`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
if _, err := rand.Read(b); err != nil {
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/discovery.go:186`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp:  time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/discovery.go:261`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/discovery.go:331`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp:    time.Now().UTC().Unix(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/handshake.go:82`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
IssuedAt:             time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/handshake.go:174`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
token := SessionToken{Value: base64.StdEncoding.EncodeToString(tokenRaw), ExpiresAt: time.Now().UTC().Add(h.ttl)}
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/handshake.go:74`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
if _, err := rand.Read(nonce); err != nil {
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/handshake.go:170`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
if _, err := rand.Read(tokenRaw); err != nil {
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/node.go:257`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
DiscoveredAt: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/node.go:258`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
LastSeen:     time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/node.go:296`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
DiscoveredAt: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/node.go:297`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
LastSeen:     time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/node.go:667`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
b[i] = byte(time.Now().UnixNano() % 256)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/peer.go:180`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
peer.DiscoveredAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/peer.go:227`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
p.LastSeen = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/peer.go:387`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
ExpiresAt:  time.Now().UTC().Add(ttl),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/peer.go:394`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return !pc.Used && time.Now().UTC().Before(pc.ExpiresAt)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/peer.go:412`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp:  time.Now().UTC().Unix(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/peer.go:459`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
chars[i] = byte('0' + (time.Now().UnixNano() % 10))
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/ratelimit_test.go:147`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/ratelimit.go:106`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/ratelimit.go:193`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
return time.Now().UTC().Before(window.cooldownUntil)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/ratelimit.go:201`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:17`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:    time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:39`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:    time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:58`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:    time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:76`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:    time.Now().UTC().Add(-1 * time.Second),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:90`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
router.seen["task-5"] = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:98`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:    time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:117`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:    time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:144`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:    time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:164`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:    time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:177`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
router.seen["old-task"] = time.Now().UTC().Add(-10 * time.Minute)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router_test.go:178`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
router.seen["new-task"] = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router.go:250`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
ExecutedAt:     time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router.go:257`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
r.seen[route.TaskID] = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router.go:289`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
r.seen[route.TaskID] = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router.go:303`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
ExecutedAt:     time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router.go:321`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
ExecutedAt:     time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router.go:332`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
result.ExecutedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router.go:367`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
cutoff := time.Now().UTC().Add(-maxAge)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:125`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
b.Timestamp = time.Now().UTC().Unix()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:251`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp: time.Now().UTC().Unix(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:368`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
state.LastSync = time.Now().UTC().Unix()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:444`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
state.LastSync = time.Now().UTC().Unix()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:629`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
b[i] = byte(time.Now().UnixNano() % 256)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:60`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
m.Timestamp = time.Now().UTC().Unix()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:136`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
c.LastActive = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:433`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
LastActive:  time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:434`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Established: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:491`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
conn.LastActive = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:556`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
"timestamp": time.Now().UTC().Unix(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:568`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp: time.Now().UTC().Unix(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:601`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
LastActive:  time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:602`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Established: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:705`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:788`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
b[i] = byte(time.Now().UnixNano() % 256)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/hosted.go:111`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/hosted.go:115`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
status := HealthStatus{LastChecked: time.Now().Unix()}
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/local.go:114`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/local.go:118`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
status := HealthStatus{LastChecked: time.Now().Unix()}
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/small.go:62`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/small.go:114`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
LastChecked: time.Now().Unix(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/containment.go:120`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/containment.go:207`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/containment.go:241`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
now := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/lockfile.go:72`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
lf.GeneratedAt = time.Now().UTC().Format(time.RFC3339)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/performance/memory.go:167`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
g.stats.LastChecked = time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/performance/memory.go:199`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
g.stats.LastChecked = time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/performance/optimizer.go:386`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start: time.Now(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/poee/poee.go:301`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp:     time.Now().UTC().Format(time.RFC3339),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/poee/poee.go:357`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
timestamp := time.Now().UTC().UnixNano()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** ⚠️ Yes

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/storage/storage_test.go:35`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt:    time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/storage/storage_test.go:56`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/storage/storage_test.go:77`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
CreatedAt: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/storage/storage.go:520`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
nowTime := time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/logger.go:92`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/metrics.go:155`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
start := time.Now()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/metrics.go:280`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/pack_telemetry.go:54`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
metrics.LastExecutedAt = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/trace.go:60`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
ID:     SpanID(fmt.Sprintf("%s_%d", name, time.Now().UnixNano())),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/trace.go:62`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Start:  time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/trace.go:94`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
s.End = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/trace.go:105`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
s.End = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/trace.go:120`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
Timestamp: time.Now().UTC(),
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/workspace/workspace_test.go:31`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
old := time.Now().Add(-5 * time.Second)
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/workspace/workspace_test.go:33`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
if err := m.CleanupExpired(time.Now()); err != nil {
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/tests/chaos/chaos_test.go:140`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_, err = store.AppendEvent(context.Background(), run.ID, jobs.Event{Type: "tool.result", Payload: []byte(`{"schemaVersio
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/session-hub/internal/hub/hub_test.go:140`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_ = c2.conn.SetReadDeadline(time.Now().Add(2 * time.Second))
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/session-hub/internal/hub/hub_test.go:40`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
_, _ = rand.Read(key)
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `RAND_UNSEED` — `c:/Users/scott/Documents/GitHub/Reach/services/session-hub/internal/hub/hub_test.go:75`

**Description:** math/rand without explicit seeding is nondeterministic

**Snippet:**
```
_, _ = rand.Read(mask[:])
```
**Remedy:** Remove from proof-contributing paths or use a deterministic seed derived from inputs
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/services/session-hub/internal/hub/hub.go:150`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
msg.At = time.Now().UTC()
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/sqlite.go:106`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
_, err := s.db.ExecContext(ctx, query, key, fullPath, len(data), time.Now())
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

### `DATE_NOW` — `c:/Users/scott/Documents/GitHub/Reach/tools/economics/src/cli.ts:161`

**Description:** Date.now() produces nondeterministic timestamps

**Snippet:**
```
const file = path.join(LEDGER_DIR, `sim-${Date.now()}.jsonl`);
```
**Remedy:** Accept timestamp as a parameter or use src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/tools/economics/src/cli.ts:168`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
id: `run-${Math.random().toString(36).substr(2, 9)}`,
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/tools/economics/src/cli.ts:170`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
tenant_id: Math.random() > 0.5 ? 'tenant-a' : 'tenant-b',
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/tools/economics/src/cli.ts:171`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
workflow_id: workflows[Math.floor(Math.random() * workflows.length)],
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/tools/economics/src/cli.ts:172`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
model_id: models[Math.floor(Math.random() * models.length)],
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/tools/economics/src/cli.ts:173`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
tokens_in: Math.floor(Math.random() * 1000),
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/tools/economics/src/cli.ts:174`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
tokens_out: Math.floor(Math.random() * 500),
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `MATH_RANDOM` — `c:/Users/scott/Documents/GitHub/Reach/tools/economics/src/cli.ts:175`

**Description:** Math.random() is nondeterministic

**Snippet:**
```
duration_ms: Math.floor(Math.random() * 5000) + 500,
```
**Remedy:** Use seededRandom() from src/determinism/seededRandom.ts
**Affects Proof Hash:** No

### `TIME_NOW` — `c:/Users/scott/Documents/GitHub/Reach/tools/perf/main.go:68`

**Description:** time.Now() in fingerprint-contributing paths breaks determinism

**Snippet:**
```
r := report{Profile: profile, GeneratedAt: time.Now().UTC(), Metrics: metrics, ChokePoints: chokes}
```
**Remedy:** Pass time as a parameter or use a fixed epoch anchor
**Affects Proof Hash:** No

## 🟡 Medium Findings

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/__tests__/readylayer-suite.test.ts:31`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/__tests__/readylayer-suite.test.ts:37`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/__tests__/readylayer-suite.test.ts:39`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/studio/state/route.ts:55`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/auth/github/callback/route.ts:64`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/billing/webhook/route.ts:43`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/marketplace/publish/route.ts:86`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/seed/route.ts:70`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/[id]/route.ts:35`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/[id]/route.ts:30`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts:66`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts:73`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts:74`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts:83`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts:84`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/route.ts:25`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/route.ts:25`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/cloud/login/page.tsx:49`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/cloud/login/page.tsx:72`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/cloud/register/page.tsx:32`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/console/governance/config-as-code/page.tsx:47`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/console/governance/config-as-code/page.tsx:48`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/console/governance/config-as-code/page.tsx:65`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/console/governance/config-as-code/page.tsx:102`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/console/ops/page.tsx:133`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/dashboard/page.tsx:25`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/faq/page.tsx:163`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/governance/page.tsx:209`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/monitoring/page.tsx:72`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/monitoring/page.tsx:87`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/page.tsx:36`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/playground/page.tsx:108`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/reports/[id]/page.tsx:99`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/reports/share/[slug]/page.tsx:141`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/reports/share/[slug]/page.tsx:142`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/settings/alerts/page.tsx:39`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/settings/alerts/page.tsx:54`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/settings/release-gates/page.tsx:51`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/settings/release-gates/page.tsx:66`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/settings/release-gates/page.tsx:77`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/share/page.tsx:56`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/simulate/page.tsx:93`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/skills/page.tsx:162`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/tools/page.tsx:153`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/tools/page.tsx:158`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/ExecutionDetails.tsx:173`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/ExecutionDetails.tsx:177`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/ExecutionDetails.tsx:181`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/ExecutionTimeline.tsx:69`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `LOCALE_FORMAT` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/PolicyRow.tsx:83`
**Description:** Locale-sensitive formatting varies across environments and platforms
**Remedy:** Use .toISOString() or fixed-locale Intl.DateTimeFormat

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/StudioShell.tsx:104`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/StudioShell.tsx:112`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/StudioShell.tsx:133`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/StudioShell.tsx:278`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/components/StudioShell.tsx:349`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/alert-service.ts:23`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/alert-service.ts:74`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/analytics.ts:43`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/cloud-auth.ts:68`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/config-snapshot/schema.ts:150`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/config-snapshot/schema.ts:151`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/config-snapshot/schema.ts:144`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/config-snapshot/schema.ts:144`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/analytics.ts:8`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/api-keys.ts:37`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/audit.ts:8`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/founder.ts:112`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:21`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:22`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:22`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:45`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:46`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:47`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:78`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:95`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:143`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/gates.ts:144`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/ops.ts:11`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/ops.ts:30`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/packs.ts:19`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/packs.ts:19`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/packs.ts:20`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:18`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:40`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:57`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:124`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:125`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:148`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:149`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/scenarios.ts:194`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/schema-hardening.ts:105`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/schema-hardening.ts:157`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/schema-hardening.ts:158`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/schema-hardening.ts:159`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/db/workflows.ts:68`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/diff-engine.ts:160`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/diff-engine.ts:161`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/diff-engine.ts:184`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/diff-engine.ts:184`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/diff-engine.ts:590`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/diff-engine.ts:591`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/gate-engine.ts:27`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/gate-engine.ts:28`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/gate-engine.ts:66`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/gate-engine.ts:96`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/gate-engine.ts:243`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/logger.ts:30`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/logger.ts:41`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:224`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/runtime/engine.ts:230`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/scoring-engine.ts:280`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/scoring-engine.ts:296`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/scoring-engine.ts:306`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/scoring-engine.ts:306`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/scoring-engine.ts:245`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/scoring-engine.ts:246`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/simulation-runner.ts:63`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/tool-sandbox.ts:625`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/compat/compat-suite.mjs:183`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/compat/compat-suite.mjs:202`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/core/config/features/features.go:68`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/core/config/features/features.go:162`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/core/evaluation/engine.go:205`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/core/evaluation/engine.go:216`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/core/evaluation/engine.go:252`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/diff.go:31`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/diff.go:39`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/diff.go:68`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/extensions/vscode/src/bridgeClient.ts:88`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/extensions/vscode/src/marketplaceClient.ts:51`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/extensions/vscode/src/panel.ts:167`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/internal/packkit/registry/index_golden_test.go:12`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/internal/packkit/registry/index_golden_test.go:30`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/docs.go:367`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/docs.go:419`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/docs.go:424`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/docs.go:545`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/doctor.go:212`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/harness.go:275`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/harness.go:293`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/linter.go:134`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/linter.go:150`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/linter.go:160`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/linter.go:258`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/linter.go:261`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/registry_validator.go:249`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/registry_validator.go:291`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/registry_validator.go:292`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/registry_validator.go:369`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/registry_validator.go:381`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/scoring.go:188`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/scoring.go:446`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/scoring.go:461`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/scoring.go:475`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/scripts/scan-determinism.ts:467`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/scripts/scan-determinism.ts:471`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/sdk/ts/src/index.ts:134`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace.go:159`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace.go:180`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace.go:576`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace.go:580`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/registry.go:348`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server_test.go:207`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/websocket.go:113`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server_test.go:39`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server.go:378`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/security/security.go:97`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:60`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:171`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:213`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:234`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/policy-engine/internal/policies/loader.go:19`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-eval/main.go:102`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-eval/main.go:169`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-eval/main.go:201`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:346`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:652`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:814`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/assistant_cmd.go:427`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/assistant_cmd.go:473`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/bench_repro.go:157`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/bench_repro.go:177`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/bench_repro.go:229`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/bench_repro.go:268`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/bench_repro.go:273`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/bench_repro.go:285`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/bench_repro.go:298`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:200`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:82`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:244`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:542`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:657`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:700`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:751`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:812`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:912`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:929`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:966`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:1084`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:1359`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:1412`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:1527`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:1635`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:1651`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:1810`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:2326`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:2357`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3022`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3278`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3396`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3534`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3976`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:4053`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:4322`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:4398`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:4471`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/policy_cmd.go:134`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/policy_cmd.go:166`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/policy_cmd.go:235`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/runner-audit-inspector/main.go:47`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/runner-audit-inspector/main.go:59`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/adaptive/strategy_test.go:228`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/adaptive/strategy_test.go:365`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/adaptive/strategy_test.go:392`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/adaptive/strategy_test.go:456`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/adaptive/strategy.go:320`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/adaptive/strategy.go:507`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/activity.go:113`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/bridge_test.go:85`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/bridge.go:37`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/bridge.go:117`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/contract_test.go:57`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/contract_test.go:133`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/contract_test.go:148`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/contract_test.go:153`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/runtime_test.go:381`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/runtime_test.go:532`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/handlers.go:216`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/ratelimit_test.go:163`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/registry_test.go:35`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/registry.go:45`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/registry.go:48`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:289`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:295`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:310`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:335`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:355`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:710`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:840`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:899`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:956`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/arcade/gamification/achievements.go:229`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator_test.go:145`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator_test.go:229`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/pack_executor.go:25`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/routing.go:39`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/routing.go:55`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/routing.go:78`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/routing.go:84`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/routing.go:92`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/routing.go:111`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/routing.go:119`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/routing.go:133`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/config/config_test.go:186`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/config/load.go:158`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/config/load.go:242`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/config/load.go:263`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/config/load.go:266`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/archive.go:48`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/archive.go:61`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/archive.go:100`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/archive.go:112`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/archive.go:171`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/archive.go:177`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/determinism.go:45`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/determinism.go:52`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/determinism.go:60`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/diff.go:67`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/diff.go:70`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/diff.go:76`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/diff.go:81`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/diff.go:109`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/diff.go:112`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/diff.go:116`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/diff.go:120`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/fixtures_loader_test.go:23`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step_test.go:321`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step_test.go:334`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step.go:118`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step.go:141`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step.go:147`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step.go:202`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step.go:210`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step.go:251`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step.go:256`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step.go:261`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/step.go:280`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/stress_test.go:61`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/stress_test.go:86`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/stress_test.go:103`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/classify_test.go:56`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/classify_test.go:109`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/format_test.go:27`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/format_test.go:130`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/format_test.go:151`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/format.go:47`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/format.go:59`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/format.go:128`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/reach_error_test.go:178`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/reach_error_test.go:198`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/reach_error_test.go:210`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/reach_error.go:82`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/coordinator.go:75`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/delegation_selector.go:29`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/delegation_selector.go:70`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/delegation_selector.go:73`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/reputation_v2.go:662`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/federation/reputation_v2.go:736`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/governance/dsl.go:344`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/scheduler.go:41`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:214`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:272`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:349`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mcpserver/policy.go:11`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mcpserver/server.go:263`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/correlation_test.go:38`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/correlation.go:201`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/discovery.go:291`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/identity_test.go:158`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/identity.go:113`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/identity.go:147`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/node.go:360`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/node.go:666`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:33`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:36`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:50`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:53`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:60`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:546`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:628`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:345`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:787`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/adapter_registry.go:153`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/adapter.go:277`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/adapter.go:302`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/factory.go:109`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/factory.go:145`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/future.go:396`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/future.go:449`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/future.go:461`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/hosted.go:171`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/hosted.go:182`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/local.go:198`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint_test.go:270`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/merkle_test.go:120`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/merkle_test.go:231`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/merkle.go:42`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/merkle.go:72`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/merkle.go:296`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/validate.go:129`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/validate.go:167`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/compat.go:76`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/compat.go:195`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/containment.go:265`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/inject.go:102`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/inject.go:117`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/inject.go:142`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader_test.go:130`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader_test.go:167`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:61`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:147`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:175`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:183`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:188`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:274`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:280`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:295`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:312`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/lockfile.go:116`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/lockfile.go:146`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/lockfile.go:184`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/manifest_test.go:66`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/manifest_test.go:84`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/manifest.go:195`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/manifest.go:212`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/manifest.go:261`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/version_test.go:21`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/version_test.go:40`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/version_test.go:70`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/version_test.go:91`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/version_test.go:152`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/performance/memory.go:153`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/performance/optimizer.go:162`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/performance/optimizer.go:170`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/performance/optimizer.go:185`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/performance/performance_test.go:223`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/performance/performance_test.go:543`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/poee/mesh_integration.go:208`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/poee/poee.go:359`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/recipe/recipe.go:127`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/recipe/recipe.go:175`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/recipe/recipe.go:206`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/recipe/recipe.go:228`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/recipe/recipe.go:299`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/recipe/recipe.go:374`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/bundle.go:212`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/bundle.go:217`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/bundle.go:226`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/bundle.go:239`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/bundle.go:309`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/report.go:337`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/report.go:370`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/report.go:390`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/report.go:421`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/sandbox/sandbox_test.go:75`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/sandbox/sandbox_test.go:144`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/sandbox/sandbox_test.go:204`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/sandbox/sandbox_test.go:219`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/sandbox/sandbox.go:51`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/sandbox/sandbox.go:54`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/sandbox/sandbox.go:57`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/signing/ed25519.go:289`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/spec/version_test.go:31`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/spec/version_test.go:55`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/spec/version_test.go:134`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/storage/storage.go:271`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/storage/storage.go:452`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/support/bot.go:76`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/support/bot.go:84`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/logger.go:105`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/metrics.go:191`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/metrics.go:223`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/trace.go:186`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/tutorial/tutorial.go:250`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/workspace/workspace.go:33`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/services/session-hub/internal/hub/hub_test.go:76`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/src/determinism/__tests__/canonicalJson.test.ts:56`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/src/determinism/__tests__/canonicalJson.test.ts:73`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/src/determinism/__tests__/canonicalJson.test.ts:143`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/src/determinism/canonicalJson.ts:59`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/src/determinism/canonicalJson.ts:60`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/src/determinism/canonicalJson.ts:68`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/src/determinism/canonicalJson.ts:69`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/src/determinism/deterministicSort.ts:80`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/stress_test.go:26`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/tools/docs/drift/claims.ts:96`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/tools/docs/drift/links.ts:165`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/docs/drift/truth.ts:35`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `OBJECT_KEYS_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/docs/drift/truth.ts:39`
**Description:** Object.keys() without .sort() has undefined iteration order in hashing paths
**Remedy:** Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/tools/docs/drift/truth.ts:148`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/doctor/main.go:49`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/doctor/main.go:120`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/doctor/main.go:178`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/doctor/main.go:210`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/doctor/main.go:218`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/doctor/mobile.go:102`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/doctor/mobile.go:245`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/doctor/mobile.go:380`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `MAP_ITERATION_UNSORTED` — `c:/Users/scott/Documents/GitHub/Reach/tools/doctor/mobile.go:382`
**Description:** Go map iteration order is randomized by the runtime — sort keys first
**Remedy:** Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON

### `JSON_STRINGIFY_NON_CANONICAL` — `c:/Users/scott/Documents/GitHub/Reach/tools/economics/src/cli.ts:178`
**Description:** JSON.stringify without canonicalization may produce unstable key ordering
**Remedy:** Use canonicalJson() from src/determinism/canonicalJson.ts

## 🟢 Low Findings

- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/next.config.ts:17`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/auth/logout/route.ts:8`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/auth/magic-link/route.ts:44`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/auth/magic-link/route.ts:45`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/auth/magic-link/route.ts:83`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/seed/route.ts:20`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/seed/route.ts:23`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/seed/route.ts:75`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts:61`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/layout.tsx:16`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/layout.tsx:18`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/layout.tsx:19`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/app/robots.ts:4`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/alert-service.ts:37`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/alert-service.ts:43`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/brand.ts:13`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:49`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:50`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:51`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:52`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:53`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:54`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:55`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:56`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:57`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:58`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:59`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:60`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:61`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:62`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:63`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:64`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:65`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:66`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:67`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:68`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:69`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:70`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:71`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:72`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:73`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:74`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/env.ts:75`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/simulation-runner.ts:48`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/apps/arcade/src/lib/simulation-runner.ts:48`: Implicit environment reads may vary across machines without validation
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/core/evaluation/engine.go:159`: json.Marshal on maps may produce unstable ordering across Go versions
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/examples/express-basic/server.ts:28`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/examples/express-basic/server.ts:112`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/examples/nextjs-basic/app/api/reach/route.ts:11`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/examples/nextjs-basic/app/page.tsx:8`: Implicit environment reads may vary across machines without validation
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/hash.go:20`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/hash.go:25`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/harness.go:256`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/publisher.go:151`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/pack-devkit/harness/scoring.go:402`: json.Marshal on maps may produce unstable ordering across Go versions
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/scripts/check-node-version.mjs:35`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/scripts/validate-brand.ts:123`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/scripts/validate-oss-purity.ts:22`: Implicit environment reads may vary across machines without validation
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/scripts/validate-simplicity.ts:28`: Implicit environment reads may vary across machines without validation
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/capsule-sync/internal/api/server_test.go:25`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace_flow_test.go:32`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace_flow_test.go:42`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace_flow_test.go:71`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace_test.go:26`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace_test.go:33`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace_test.go:37`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace_test.go:130`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace_test.go:146`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/marketplace_test.go:156`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/registry_test.go:27`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/registry_test.go:31`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/registry_test.go:39`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/registry_test.go:97`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/registry_test.go:120`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/registry_test.go:153`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/connector-registry/internal/registry/registry_test.go:186`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server_test.go:201`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server.go:224`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/server.go:243`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/ide-bridge/internal/bridge/websocket.go:84`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/api/server.go:433`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/router/router.go:49`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:112`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:168`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:231`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:272`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:318`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/integration-hub/internal/storage/store.go:319`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-eval/main.go:125`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reach-serve/main.go:347`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:26`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:69`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:104`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:149`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:201`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:207`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:256`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:294`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main_test.go:351`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:2962`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:3003`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/cmd/reachctl/main.go:4032`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/activity.go:137`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/agents/runtime.go:494`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:894`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:903`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/api/server.go:977`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/audit/receipts.go:41`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/audit/receipts.go:42`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/audit/receipts.go:53`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:380`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:388`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/autonomous/orchestrator.go:408`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/determinism/determinism.go:33`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/engineclient/client.go:97`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/format.go:89`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/format.go:97`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/errors/reach_error.go:111`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/event_schema.go:36`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:371`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:379`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/jobs/store.go:469`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mcpserver/audit.go:35`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mcpserver/audit.go:48`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mcpserver/runner_loop.go:27`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/discovery.go:336`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/discovery.go:369`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/peer.go:415`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router.go:161`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/router.go:346`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:106`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:145`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:236`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:347`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/sync.go:588`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:92`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:119`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:572`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:639`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:647`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/mesh/transport.go:720`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/hosted.go:166`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/model/local.go:192`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint_test.go:37`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint_test.go:93`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint_test.go:153`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint_test.go:195`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint_test.go:241`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint_test.go:288`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint_test.go:375`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint_test.go:415`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint.go:124`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint.go:179`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/pack/lint.go:196`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader_test.go:25`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader_test.go:310`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/loader.go:261`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/lockfile.go:186`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/manifest_test.go:327`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/packloader/manifest.go:329`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/packaging.go:50`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:112`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:141`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:150`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:178`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:187`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:230`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:246`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:291`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:307`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:340`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:356`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:385`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/plugins/verify_test.go:398`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/registry/pack.go:62`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/reporting/bundle.go:200`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/storage/storage.go:297`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/logger_test.go:143`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/logger.go:120`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/metrics.go:252`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/runner/internal/telemetry/metrics.go:284`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/session-hub/internal/hub/hub_test.go:70`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/services/session-hub/internal/hub/websocket.go:95`: json.Marshal on maps may produce unstable ordering across Go versions
- `PROCESS_ENV_IMPLICIT` at `c:/Users/scott/Documents/GitHub/Reach/tests/smoke/routes.test.mjs:15`: Implicit environment reads may vary across machines without validation
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/tools/packkit/main.go:89`: json.Marshal on maps may produce unstable ordering across Go versions
- `JSON_MARSHAL_MAP` at `c:/Users/scott/Documents/GitHub/Reach/tools/packkit/main.go:104`: json.Marshal on maps may produce unstable ordering across Go versions

## Remediation Priority

1. **CRITICAL in engine paths** — Fix `DATE_NOW`, `MATH_RANDOM`, `TIME_NOW`, `UUID_V4` in `services/runner/internal/` and `core/`
2. **Unsorted iteration** — Replace `Object.keys()` without `.sort()` in any serialization path
3. **MEDIUM in metadata paths** — Audit `JSON_STRINGIFY_NON_CANONICAL` in report/audit code
4. **LOW** — Document acceptable environment reads with `// determinism:ok` suppression

## Suppression

To suppress a known-acceptable finding, add `// determinism:ok` on the same line:
```typescript
const ts = Date.now(); // determinism:ok — used only for logging
```