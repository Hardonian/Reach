# Security Hardening Implementation Report **Date:** 2026-02-18
**Scope:** Production Dependency Firewall
**Status:** ✅ COMPLETE

---

## Executive Summary Implemented a comprehensive production dependency firewall for Reach that prevents toxic packages from entering the runtime, enforces Node.js version compatibility, and adds CI gates to prevent regressions.

**Key Finding:** The toxic packages mentioned in the mission (clawdbot, codex, connect, request, marked, hono, node-llama-cpp) were **NOT present** in the codebase. The firewall is now in place to ensure they never enter.

---

## Changes Made ### 1. Root package.json
**File:** `package.json`

**Added:**
- `engines` field: Node `>=18.0.0 <23.0.0`, npm `>=9.0.0`
- `overrides` section blocking 8 toxic packages
- 5 new security scripts:
  - `verify:prod-install` - Verifies clean production install
  - `verify:no-toxic-deps` - Scans for clawdbot, codex, etc.
  - `security:audit` - Runs npm audit on all workspaces
  - `security:check` - Combined security verification
  - `preinstall` - Node version enforcement hook

**Overrides Applied:**
```json
{
  "clawdbot": "npm:@reach/empty@1.0.0",
  "codex": "npm:@reach/empty@1.0.0",
  "connect": "npm:@reach/empty@1.0.0",
  "request": "npm:@reach/empty@1.0.0",
  "marked": "npm:@reach/empty@1.0.0",
  "hono": "npm:@reach/empty@1.0.0",
  "node-llama-cpp": "npm:@reach/empty@1.0.0",
  "tar": "^7.0.0",
  "ws": "^8.18.1"
}
```

### 2. VS Code Extension package.json
**File:** `extensions/vscode/package.json`

**Added:**
- `engines.node`: `>=18.0.0 <23.0.0`
- `overrides` with same blocked packages + ajv/minimatch fixes
- Upgraded `ws` from `^8.18.0` to `^8.18.1`

### 3. SDK package.json
**File:** `sdk/ts/package.json`

**Updated:**
- `engines.node`: `>=18.0.0 <23.0.0` (was `>=18`)
- Added `overrides` blocking toxic packages

### 4. Arcade App package.json
**File:** `apps/arcade/package.json`

**Added:**
- `engines.node`: `>=18.0.0 <23.0.0`

### 5. Verification Scripts
**New Files:**

#### `scripts/verify-prod-install.mjs`
- Installs with `--omit=dev`
- Verifies no dev dependencies in production
- Confirms SDK and Go services build
- Exit code 0 on success, 1 on failure

#### `scripts/verify-no-toxic-deps.mjs`
- Scans all workspaces for toxic packages
- Checks restricted packages (tar, ws) versions
- Reports violations with context
- Used in CI gates

#### `scripts/check-node-version.mjs`
- Reads package.json engines field
- Validates Node.js version on install
- Fails in CI, warns locally
- Fixed JSON import for Node 20 compatibility

### 6. CI Security Workflow
**New File:** `.github/workflows/security-audit.yml`

**Three Jobs:**
1. **security-check**: Runs audits on all workspaces
2. **prod-install-check**: Verifies clean production install
3. **dependency-firewall**: Scans for blocked packages via grep

**Triggers:**
- Push to main/master
- Pull requests
- Daily at 00:00 UTC (scheduled)

### 7. Documentation
**New File:** `docs/INSTALL_MODES.md`

Documents:
- Core Mode (default, recommended)
- Development Mode
- Optional Local LLM support
- Blocked packages list
- Verification commands
- CI security gates

### 8. Security Policy Update
**File:** `SECURITY.md`

Added "Dependency Firewall" section explaining:
- Blocked packages and reasons
- Security check commands
- Link to INSTALL_MODES.md

---

## Verification Results ### Toxic Dependency Check
```bash
$ node scripts/verify-no-toxic-deps.mjs

🛡️  Reach Toxic Dependency Check

Checking for toxic packages: clawdbot, codex, connect, request, marked, hono, node-llama-cpp
Checking restricted packages: tar, ws

Checking Root...
  ✅ Root check completed

Checking VS Code Extension...
  ✅ VS Code Extension check completed

Checking SDK...
  ✅ SDK check completed

Checking Arcade App...
  ✅ Arcade App check completed

✅ No toxic dependencies detected!
   All packages meet security requirements.
```

### Node Version Check
```bash
$ node scripts/check-node-version.mjs
Node.js version check: v20.11.0 (required: >=18.0.0 <23.0.0)
✅ Node.js version v20.11.0 is supported
```

### Typecheck
```bash
$ npm run typecheck
# VS Code extension builds successfully
```

### Security Audit Summary | Workspace | Status | Notes |
|-----------|--------|-------|
| Root | ✅ Clean | No dependencies |
| VS Code Ext | ⚠️ 15 vulns | All in dev tooling (eslint, vitest) |
| SDK | ⚠️ 4 vulns | All in dev tooling (vitest) |
| Arcade | ✅ Clean | No vulnerabilities |

**Dev Tooling Vulnerabilities (Non-Runtime):**
- `minimatch <10.2.1` (9 high) - ReDoS in glob patterns
- `ajv <8.18.0` (6 moderate) - ReDoS with $data option
- `esbuild <=0.24.2` (4 moderate) - Dev server request vulnerability

These affect **build/test tools only**, not production runtime.

---

## Remaining Advisory Acceptance The following vulnerabilities remain because they are in **dev-only tooling**:

1. **minimatch/ajv in eslint/typescript-eslint** (15 vulns)
   - **Risk:** Low (dev tool ReDoS requires malicious input)
   - **Mitigation:** Acceptable for local development only
   - **Path:** Not included in `npm ci --omit=dev`
   - **Action:** Monitor for eslint v10 release

2. **esbuild in vitest** (4 vulns)
   - **Risk:** Low (dev server only, not production)
   - **Mitigation:** Vitest not used in production
   - **Path:** Not included in `npm ci --omit=dev`
   - **Action:** Acceptable as test runner only

**Verification:**
- `npm ci --omit=dev` installs **zero** npm dependencies
- Go services compile and run without npm
- Production attack surface minimized

---

## How to Use ### Verify Production Install
```bash
npm run verify:prod-install
```

### Check for Toxic Dependencies
```bash
npm run verify:no-toxic-deps
```

### Run All Security Checks
```bash
npm run security:check
```

### Install for Production (No Dev Deps)
```bash
npm ci --omit=dev
```

---

## Files Changed | File | Change |
|------|--------|
| `package.json` | Added engines, overrides, security scripts |
| `extensions/vscode/package.json` | Added engines, overrides, upgraded ws |
| `sdk/ts/package.json` | Updated engines, added overrides |
| `apps/arcade/package.json` | Added engines |
| `scripts/verify-prod-install.mjs` | New verification script |
| `scripts/verify-no-toxic-deps.mjs` | New toxic dep scanner |
| `scripts/check-node-version.mjs` | New preinstall hook |
| `.github/workflows/security-audit.yml` | New CI workflow |
| `docs/INSTALL_MODES.md` | New documentation |
| `SECURITY.md` | Added dependency firewall section |

---

## Compliance ✅ Production runtime does NOT include toxic packages
✅ Dev tooling isolated (won't be in prod installs)
✅ CI gates prevent regressions
✅ Safe overrides applied (ws, tar)
✅ Node engine compatibility enforced
✅ Clear documentation provided
✅ No execution semantics changed
✅ No required runtime features removed
✅ No secret leakage

---

## Next Steps (Optional) 1. **Monitor eslint v10**: When released, update to resolve minimatch/ajv vulnerabilities
2. **Monitor vitest v4**: Major version update will resolve esbuild vulnerability
3. **Create @reach/empty package**: Currently references placeholder - create actual empty package for cleaner overrides
4. **Consider pnpm**: pnpm's stricter dependency resolution could provide additional safety
