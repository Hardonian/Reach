# Versioning Strategy

Last Updated: 2026-02-23

## Purpose

This document defines the versioning strategy for the Reach system — how
schema versions, hash versions, and backward compatibility are managed
across releases.

---

## 1. Current Version State

```text
VERSION file:   0.3.1
package.json:   0.3.1
```

### Versioned Components

| Component        | Current Version | Versioning Mechanism            |
| :--------------- | :-------------- | :------------------------------ |
| Monorepo         | 0.3.1           | `VERSION` file + `package.json` |
| Schema (zeo.v1)  | v1              | `schemaVersion` field in output |
| Rust Engine      | 0.3.1           | `Cargo.toml` in crates          |
| Go Runner        | 0.3.1           | `go.mod` + embedded version     |
| SQLite Schema    | Migration 005   | Sequential migration files      |
| Protocol Schemas | v1              | `protocol/v1/` directory        |
| Hash Algorithm   | sha256-cjson-v1 | `HASH_VERSION` in `shim.ts`     |

---

## 2. Schema Versioning

### Protocol Schema Versioning

Protocol schemas live in `protocol/schemas/` and `protocol/v1/`. The version
is embedded in the directory structure and in the output:

```json
{
  "schemaVersion": "zeo.v1",
  ...
}
```

### Migration Strategy for Schema Changes

1. **Additive changes** (new optional fields): Do NOT bump schema version.
   Consumers must tolerate unknown fields.

2. **Breaking changes** (renamed fields, removed fields, semantic changes):
   Bump the schema version (e.g., `zeo.v2`). Both versions must be supported
   during a transition period.

3. **Migration path**: The `migrateTranscript()` and `migrateEnvelope()`
   functions in `shim.ts` handle version upgrades:

   ```typescript
   export function migrateTranscript(
     content: unknown,
     _version: string,
   ): unknown {
     return content; // Currently a passthrough — no migrations yet
   }
   ```

### Database Schema Versioning

SQLite schema is versioned by sequential migration files:

```text
migrations/001_init.sql
migrations/002_orchestration.sql
migrations/003_hardware_attestation.sql
migrations/004_replay_integrity.sql
migrations/005_snapshots.sql
```

**Migration execution**: All migrations use `CREATE TABLE IF NOT EXISTS` or
`ALTER TABLE ... ADD COLUMN`, making them idempotent and safe to re-run.

**Version tracking**: Currently, there is no `schema_version` table tracking
which migrations have been applied. The `IF NOT EXISTS` guards provide
idempotency but not explicit version tracking.

**Recommendation**: Add a `schema_migrations` table recording applied
migration numbers and timestamps. This enables:

- Detecting skipped migrations.
- Preventing forward-incompatible schema states.
- Audit trail for schema changes.

---

## 3. Hash Version Bump Policy

### When to Bump Hash Version

A hash version bump is required when:

1. **Hash algorithm changes** — switching from SHA-256 to SHA-3, or from
   FNV-1a to a different algorithm.

2. **Hash input set changes** — adding or removing fields from the
   deterministic input set (e.g., adding a new field to `DecisionSpec` that
   is included in `hashInput()`).

3. **Serialization format changes** — changing how values are serialized
   before hashing (e.g., switching from `JSON.stringify()` to CBOR).

4. **Canonical ordering changes** — modifying the key sort algorithm in
   `canonicalJson()`.

### When NOT to Bump

- Adding optional fields that are excluded from the hash.
- Changing human-readable output format (JSON pretty-printing, CLI text).
- Adding new CLI commands that don't affect hash computation.
- Performance optimizations that don't change output.

### Hash Version Identifier

Currently, the hash algorithm is versioned in transcripts via the `hashVersion`
field and the `HASH_VERSION` constant exported from `src/core/shim.ts`:

```json
{
  "hashVersion": "sha256-cjson-v1",
  "transcript_hash": "abc123..."
}
```

This would encode:

- Hash algorithm: `sha256`
- Serialization: `cjson` (canonical JSON with sorted keys)
- Version: `v1`

---

## 4. Backward Compatibility Strategy

### Replay Compatibility Matrix

The Rust engine encodes compatibility rules in `invariants/mod.rs`:

```rust
// Same major, forward-compatible minor
pub fn minor_version_forward_compatible(current: &str, candidate: &str) -> bool {
    current_major == candidate_major && candidate_minor >= current_minor
}

// Same major + minor — only patch differs
pub fn patch_upgrade_replay_compatible(source: &str, target: &str) -> bool {
    source_major == target_major && source_minor == target_minor
}
```

### Compatibility Rules

| Change Type         | Version Bump  | Replay Compatible | Migration Required |
| :------------------ | :------------ | :---------------- | :----------------- |
| Bug fix             | Patch (0.3.x) | YES               | NO                 |
| New optional field  | Minor (0.x.0) | YES               | Maybe              |
| Hash input change   | Major (x.0.0) | NO                | YES                |
| Algorithm change    | Major (x.0.0) | NO                | YES                |
| New SQL migration   | Minor (0.x.0) | YES               | Automatic          |
| Schema version bump | Major (x.0.0) | NO                | YES                |

### Upgrade Path

```text
1. User upgrades binary from 0.3.1 to 0.4.0
2. On first run, runner detects new migrations
3. Migrations are applied automatically (IF NOT EXISTS guards)
4. Existing transcripts remain valid (replay-compatible within minor)
5. If major bump: migration function converts old transcripts to new format
```

### Downgrade Safety

Currently, there is no downgrade mechanism. If a user upgrades and then
needs to revert:

- Transcripts created with the new version may not be readable by the old.
- Database schema changes are not reversible (no `DOWN` migrations).

**Recommendation for v1.0**: Add `DOWN` migration scripts for each migration.
For pre-v1.0 (current), this is acceptable — schema changes are rare and the
user base is small.

---

## 5. Version Invariants

| ID     | Invariant                                          | Status |
| :----- | :------------------------------------------------- | :----- |
| VER-01 | `VERSION` file and `package.json` are synchronized | HOLDS  |
| VER-02 | Patch upgrades are replay-compatible               | HOLDS  |
| VER-03 | Minor upgrades are forward-compatible              | HOLDS  |
| VER-04 | Hash algorithm is versioned in transcripts         | HOLDS  |
| VER-05 | Database migrations are idempotent                 | HOLDS  |
| VER-06 | Schema migration tracking table exists             | **NO** |
| VER-07 | Transcript migration functions exist               | HOLDS  |
| VER-08 | Downgrade migrations exist                         | **NO** |

---

## 6. Release Checklist

Before any version bump:

1. Update `VERSION` file.
2. Update `package.json` version.
3. Update `Cargo.toml` versions (if Rust changes).
4. If hash input set changed: bump major version.
5. If new SQL migration: ensure `IF NOT EXISTS` guards.
6. Run full verify suite: `npm run verify:full`.
7. Tag the release: `git tag v{version}`.
