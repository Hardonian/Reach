/**
 * Reach Cloud — SQLite control-plane database
 *
 * Uses better-sqlite3 (synchronous) in Node runtime.
 * Feature-flagged: if REACH_CLOUD_ENABLED is not "true", all operations
 * return safe no-ops or throw CloudDisabledError.
 *
 * Schema: tenants, users, memberships, api_keys, projects,
 *         workflows, workflow_runs, packs, pack_versions,
 *         marketplace_reviews, telemetry_rollups, audit_events,
 *         entitlements, webhook_events
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from './env';

export class CloudDisabledError extends Error {
  constructor() { super('REACH_CLOUD_ENABLED is not set. Cloud features disabled.'); }
}

function isCloudEnabled(): boolean {
  return env.REACH_CLOUD_ENABLED === true;
}

// ── Singleton DB handle ────────────────────────────────────────────────────
const DB_PATH = env.CLOUD_DB_PATH ?? path.join(process.cwd(), 'reach-cloud.db');

let _db: Database.Database | undefined;

function getDB(): Database.Database {
  if (!isCloudEnabled()) throw new CloudDisabledError();
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  applyMigrations(_db);
  return _db;
}

// ── Schema Migrations ─────────────────────────────────────────────────────
const MIGRATIONS: string[] = [
  /* 001 — core multi-tenant schema */
  `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    plan        TEXT NOT NULL DEFAULT 'free',
    created_at  TEXT NOT NULL,
    deleted_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    deleted_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS memberships (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    role        TEXT NOT NULL DEFAULT 'member',
    created_at  TEXT NOT NULL,
    UNIQUE(tenant_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    key_hash    TEXT NOT NULL UNIQUE,
    key_prefix  TEXT NOT NULL,
    name        TEXT NOT NULL,
    scopes      TEXT NOT NULL DEFAULT '[]',
    last_used_at TEXT,
    expires_at  TEXT,
    created_at  TEXT NOT NULL,
    revoked_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    deleted_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS web_sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    tenant_id   TEXT,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_web_sessions_user ON web_sessions(user_id);
  `,

  /* 002 — workflows + runs */
  `
  CREATE TABLE IF NOT EXISTS workflows (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    project_id  TEXT REFERENCES projects(id),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    graph_json  TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    version     INTEGER NOT NULL DEFAULT 1,
    status      TEXT NOT NULL DEFAULT 'draft',
    created_by  TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS workflow_runs (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id),
    workflow_id  TEXT NOT NULL REFERENCES workflows(id),
    status       TEXT NOT NULL DEFAULT 'queued',
    inputs_json  TEXT NOT NULL DEFAULT '{}',
    outputs_json TEXT NOT NULL DEFAULT '{}',
    metrics_json TEXT NOT NULL DEFAULT '{}',
    error        TEXT,
    started_at   TEXT,
    finished_at  TEXT,
    created_at   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON workflow_runs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
  `,

  /* 003 — packs + marketplace */
  `
  CREATE TABLE IF NOT EXISTS packs (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT REFERENCES tenants(id),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT NOT NULL DEFAULT '',
    short_description TEXT NOT NULL DEFAULT '',
    category        TEXT NOT NULL DEFAULT 'general',
    visibility      TEXT NOT NULL DEFAULT 'public',
    latest_version  TEXT NOT NULL DEFAULT '0.0.0',
    author_id       TEXT REFERENCES users(id),
    author_name     TEXT NOT NULL DEFAULT '',
    verified        INTEGER NOT NULL DEFAULT 0,
    security_status TEXT NOT NULL DEFAULT 'pending',
    reputation_score INTEGER NOT NULL DEFAULT 0,
    downloads       INTEGER NOT NULL DEFAULT 0,
    rating_sum      REAL NOT NULL DEFAULT 0,
    rating_count    INTEGER NOT NULL DEFAULT 0,
    tools_json      TEXT NOT NULL DEFAULT '[]',
    tags_json       TEXT NOT NULL DEFAULT '[]',
    permissions_json TEXT NOT NULL DEFAULT '[]',
    data_handling   TEXT NOT NULL DEFAULT 'minimal',
    flagged         INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    deleted_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS pack_versions (
    id          TEXT PRIMARY KEY,
    pack_id     TEXT NOT NULL REFERENCES packs(id),
    version     TEXT NOT NULL,
    manifest_json TEXT NOT NULL DEFAULT '{}',
    readme      TEXT NOT NULL DEFAULT '',
    changelog   TEXT NOT NULL DEFAULT '',
    immutable   INTEGER NOT NULL DEFAULT 1,
    published_at TEXT NOT NULL,
    UNIQUE(pack_id, version)
  );

  CREATE TABLE IF NOT EXISTS marketplace_reviews (
    id          TEXT PRIMARY KEY,
    pack_id     TEXT NOT NULL REFERENCES packs(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    rating      INTEGER NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    UNIQUE(pack_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_packs_tenant ON packs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_packs_category ON packs(category);
  CREATE INDEX IF NOT EXISTS idx_packs_visibility ON packs(visibility);
  CREATE INDEX IF NOT EXISTS idx_pack_versions_pack ON pack_versions(pack_id);
  `,

  /* 004 — billing + entitlements + audit */
  `
  CREATE TABLE IF NOT EXISTS entitlements (
    id                    TEXT PRIMARY KEY,
    tenant_id             TEXT NOT NULL UNIQUE REFERENCES tenants(id),
    plan                  TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id    TEXT,
    stripe_subscription_id TEXT,
    stripe_price_id       TEXT,
    status                TEXT NOT NULL DEFAULT 'active',
    runs_per_month        INTEGER NOT NULL DEFAULT 100,
    runs_used_this_month  INTEGER NOT NULL DEFAULT 0,
    pack_limit            INTEGER NOT NULL DEFAULT 5,
    retention_days        INTEGER NOT NULL DEFAULT 7,
    period_start          TEXT,
    period_end            TEXT,
    updated_at            TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id              TEXT PRIMARY KEY,
    stripe_event_id TEXT NOT NULL UNIQUE,
    type            TEXT NOT NULL,
    payload_json    TEXT NOT NULL,
    processed       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id   TEXT NOT NULL,
    user_id     TEXT,
    action      TEXT NOT NULL,
    resource    TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    ip_address  TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS telemetry_rollups (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    pack_id     TEXT,
    workflow_id TEXT,
    period      TEXT NOT NULL,
    runs_count  INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    avg_duration_ms REAL NOT NULL DEFAULT 0,
    p95_duration_ms REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    UNIQUE(tenant_id, pack_id, workflow_id, period)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(tenant_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_entitlements_stripe ON entitlements(stripe_customer_id);
  CREATE INDEX IF NOT EXISTS idx_telemetry_tenant ON telemetry_rollups(tenant_id, period);
  `,
];

function applyMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = db.prepare('SELECT version FROM schema_version').all() as { version: number }[];
  const appliedSet = new Set(applied.map((r) => r.version));

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    if (!appliedSet.has(version)) {
      const applyMigration = db.transaction(() => {
        db.exec(MIGRATIONS[i]);
        db.prepare('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)').run(
          version,
          new Date().toISOString()
        );
      });
      applyMigration();
    }
  }
}

// ── ID helpers ────────────────────────────────────────────────────────────
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const attempt = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
}

// ── Tenant operations ─────────────────────────────────────────────────────
export interface Tenant {
  id: string; name: string; slug: string; plan: string;
  created_at: string; deleted_at: string | null;
}

export function createTenant(name: string, slug: string): Tenant {
  const db = getDB();
  const id = newId('ten');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO tenants (id, name, slug, plan, created_at) VALUES (?,?,?,'free',?)`).run(id, name, slug, now);
  // Create default entitlement row
  db.prepare(`INSERT INTO entitlements (id, tenant_id, plan, runs_per_month, pack_limit, retention_days, updated_at)
    VALUES (?,?,'free',100,5,7,?)`).run(newId('ent'), id, now);
  return getTenant(id)!;
}

export function getTenant(id: string): Tenant | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM tenants WHERE id=? AND deleted_at IS NULL').get(id) as Tenant | undefined;
}

export function getTenantBySlug(slug: string): Tenant | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM tenants WHERE slug=? AND deleted_at IS NULL').get(slug) as Tenant | undefined;
}

export function listTenantsForUser(userId: string): Tenant[] {
  const db = getDB();
  return db.prepare(`
    SELECT t.* FROM tenants t
    JOIN memberships m ON m.tenant_id = t.id
    WHERE m.user_id = ? AND t.deleted_at IS NULL
  `).all(userId) as Tenant[];
}

// ── User operations ───────────────────────────────────────────────────────
export interface User {
  id: string; email: string; display_name: string;
  created_at: string; deleted_at: string | null;
}

export function createUser(email: string, password: string, displayName: string): User {
  const db = getDB();
  const id = newId('usr');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)`)
    .run(id, email.toLowerCase(), hashPassword(password), displayName, now);
  return getUserById(id)!;
}

export function getUserById(id: string): User | undefined {
  const db = getDB();
  return db.prepare('SELECT id, email, display_name, created_at, deleted_at FROM users WHERE id=? AND deleted_at IS NULL').get(id) as User | undefined;
}

export function getUserByEmail(email: string): (User & { password_hash: string }) | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM users WHERE email=? AND deleted_at IS NULL').get(email.toLowerCase()) as (User & { password_hash: string }) | undefined;
}

// ── Membership operations ─────────────────────────────────────────────────
export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export function addMember(tenantId: string, userId: string, role: Role = 'member'): void {
  const db = getDB();
  db.prepare(`INSERT OR REPLACE INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?,?,?,?,?)`)
    .run(newId('mbr'), tenantId, userId, role, new Date().toISOString());
}

export function getMembership(tenantId: string, userId: string): { role: Role } | undefined {
  const db = getDB();
  return db.prepare('SELECT role FROM memberships WHERE tenant_id=? AND user_id=?').get(tenantId, userId) as { role: Role } | undefined;
}

// ── Session operations ────────────────────────────────────────────────────
export interface WebSession {
  id: string; user_id: string; tenant_id: string | null; expires_at: string; created_at: string;
}

export function createSession(userId: string, tenantId?: string): WebSession {
  const db = getDB();
  const id = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  const ttlHours = env.REACH_SESSION_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString();
  db.prepare(`INSERT INTO web_sessions (id, user_id, tenant_id, expires_at, created_at) VALUES (?,?,?,?,?)`)
    .run(id, userId, tenantId ?? null, expiresAt, now);
  return { id, user_id: userId, tenant_id: tenantId ?? null, expires_at: expiresAt, created_at: now };
}

export function getSession(id: string): WebSession | undefined {
  const db = getDB();
  const sess = db.prepare('SELECT * FROM web_sessions WHERE id=? AND expires_at > ?').get(id, new Date().toISOString()) as WebSession | undefined;
  return sess;
}

export function deleteSession(id: string): void {
  const db = getDB();
  db.prepare('DELETE FROM web_sessions WHERE id=?').run(id);
}

// ── API Key operations ────────────────────────────────────────────────────
export interface ApiKey {
  id: string; tenant_id: string; user_id: string; key_prefix: string;
  name: string; scopes: string[]; created_at: string; last_used_at: string | null;
  expires_at: string | null; revoked_at: string | null;
}

export function createApiKey(tenantId: string, userId: string, name: string, scopes: string[]): { key: ApiKey; rawKey: string } {
  const db = getDB();
  const rawKey = `rk_live_${crypto.randomBytes(24).toString('base64url')}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 12);
  const id = newId('key');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO api_keys (id, tenant_id, user_id, key_hash, key_prefix, name, scopes, created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, tenantId, userId, keyHash, keyPrefix, name, JSON.stringify(scopes), now);
  const key = getApiKey(id)!;
  return { key, rawKey };
}

export function getApiKey(id: string): ApiKey | undefined {
  const db = getDB();
  const row = db.prepare('SELECT * FROM api_keys WHERE id=? AND revoked_at IS NULL').get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return { ...row, scopes: JSON.parse(row.scopes as string) } as ApiKey;
}

export function lookupApiKey(rawKey: string): { key: ApiKey; tenant: Tenant } | undefined {
  const db = getDB();
  const keyHash = hashApiKey(rawKey);
  const row = db.prepare(`SELECT k.*, t.name as tenant_name, t.slug as tenant_slug, t.plan as tenant_plan
    FROM api_keys k JOIN tenants t ON t.id = k.tenant_id
    WHERE k.key_hash=? AND k.revoked_at IS NULL AND t.deleted_at IS NULL`).get(keyHash) as Record<string, unknown> | undefined;
  if (!row) return undefined;

  // Throttled update: only update last_used_at if it's older than 5 minutes
  const now = new Date();
  const lastUsed = row.last_used_at ? new Date(row.last_used_at as string) : new Date(0);
  if (now.getTime() - lastUsed.getTime() > 5 * 60 * 1000) {
    db.prepare('UPDATE api_keys SET last_used_at=? WHERE id=?').run(now.toISOString(), row.id);
  }
  const key: ApiKey = {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    user_id: row.user_id as string,
    key_prefix: row.key_prefix as string,
    name: row.name as string,
    scopes: JSON.parse(row.scopes as string),
    created_at: row.created_at as string,
    last_used_at: row.last_used_at as string | null,
    expires_at: row.expires_at as string | null,
    revoked_at: null,
  };
  const tenant: Tenant = {
    id: row.tenant_id as string,
    name: row.tenant_name as string,
    slug: row.tenant_slug as string,
    plan: row.tenant_plan as string,
    created_at: row.created_at as string,
    deleted_at: null,
  };
  return { key, tenant };
}

export function listApiKeys(tenantId: string): ApiKey[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM api_keys WHERE tenant_id=? AND revoked_at IS NULL ORDER BY created_at DESC').all(tenantId) as Record<string, unknown>[];
  return rows.map((r) => ({ ...r, scopes: JSON.parse(r.scopes as string) }) as ApiKey);
}

export function revokeApiKey(id: string, tenantId: string): boolean {
  const db = getDB();
  const res = db.prepare('UPDATE api_keys SET revoked_at=? WHERE id=? AND tenant_id=?').run(new Date().toISOString(), id, tenantId);
  return res.changes > 0;
}

// ── Project operations ────────────────────────────────────────────────────
export interface Project {
  id: string; tenant_id: string; name: string; description: string;
  created_at: string; deleted_at: string | null;
}

export function createProject(tenantId: string, name: string, description: string): Project {
  const db = getDB();
  const id = newId('prj');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO projects (id, tenant_id, name, description, created_at) VALUES (?,?,?,?,?)`)
    .run(id, tenantId, name, description, now);
  return getProject(id, tenantId)!;
}

export function getProject(id: string, tenantId: string): Project | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM projects WHERE id=? AND tenant_id=? AND deleted_at IS NULL').get(id, tenantId) as Project | undefined;
}

export function listProjects(tenantId: string): Project[] {
  const db = getDB();
  return db.prepare('SELECT * FROM projects WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC').all(tenantId) as Project[];
}

// ── Workflow operations ───────────────────────────────────────────────────
export interface Workflow {
  id: string; tenant_id: string; project_id: string | null;
  name: string; description: string; graph_json: string;
  version: number; status: string; created_by: string;
  created_at: string; updated_at: string; deleted_at: string | null;
}

export function createWorkflow(tenantId: string, projectId: string | null, name: string, description: string, createdBy: string, graphJson: string): Workflow {
  const db = getDB();
  const id = newId('wfl');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO workflows (id, tenant_id, project_id, name, description, graph_json, version, status, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,1,'draft',?,?,?)`)
    .run(id, tenantId, projectId ?? null, name, description, graphJson, createdBy, now, now);
  return getWorkflow(id, tenantId)!;
}

export function getWorkflow(id: string, tenantId: string): Workflow | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM workflows WHERE id=? AND tenant_id=? AND deleted_at IS NULL').get(id, tenantId) as Workflow | undefined;
}

export function updateWorkflow(id: string, tenantId: string, patch: { name?: string; description?: string; graphJson?: string; status?: string }): boolean {
  const db = getDB();
  const wf = getWorkflow(id, tenantId);
  if (!wf) return false;
  const now = new Date().toISOString();
  db.prepare(`UPDATE workflows SET
    name=COALESCE(?,name), description=COALESCE(?,description),
    graph_json=COALESCE(?,graph_json), status=COALESCE(?,status),
    version=version+1, updated_at=?
    WHERE id=? AND tenant_id=?`)
    .run(patch.name ?? null, patch.description ?? null, patch.graphJson ?? null, patch.status ?? null, now, id, tenantId);
  return true;
}

export function listWorkflows(tenantId: string, projectId?: string): Workflow[] {
  const db = getDB();
  if (projectId) {
    return db.prepare('SELECT * FROM workflows WHERE tenant_id=? AND project_id=? AND deleted_at IS NULL ORDER BY updated_at DESC').all(tenantId, projectId) as Workflow[];
  }
  return db.prepare('SELECT * FROM workflows WHERE tenant_id=? AND deleted_at IS NULL ORDER BY updated_at DESC').all(tenantId) as Workflow[];
}

// ── Workflow Run operations ───────────────────────────────────────────────
export interface WorkflowRun {
  id: string; tenant_id: string; workflow_id: string; status: string;
  inputs_json: string; outputs_json: string; metrics_json: string;
  error: string | null; started_at: string | null; finished_at: string | null; created_at: string;
}

export function createWorkflowRun(tenantId: string, workflowId: string, inputs: unknown): WorkflowRun {
  const db = getDB();
  const id = newId('run');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO workflow_runs (id, tenant_id, workflow_id, status, inputs_json, outputs_json, metrics_json, created_at)
    VALUES (?,?,?,'queued',?,'{}','{}',?)`)
    .run(id, tenantId, workflowId, JSON.stringify(inputs), now);
  return getWorkflowRun(id, tenantId)!;
}

export function getWorkflowRun(id: string, tenantId: string): WorkflowRun | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM workflow_runs WHERE id=? AND tenant_id=?').get(id, tenantId) as WorkflowRun | undefined;
}

export function updateWorkflowRun(id: string, tenantId: string, patch: Partial<WorkflowRun>): void {
  const db = getDB();
  db.prepare(`UPDATE workflow_runs SET
    status=COALESCE(?,status), outputs_json=COALESCE(?,outputs_json),
    metrics_json=COALESCE(?,metrics_json), error=COALESCE(?,error),
    started_at=COALESCE(?,started_at), finished_at=COALESCE(?,finished_at)
    WHERE id=? AND tenant_id=?`)
    .run(patch.status ?? null, patch.outputs_json ?? null, patch.metrics_json ?? null,
      patch.error ?? null, patch.started_at ?? null, patch.finished_at ?? null, id, tenantId);
}

export function listWorkflowRuns(tenantId: string, workflowId?: string, limit = 50): WorkflowRun[] {
  const db = getDB();
  if (workflowId) {
    return db.prepare('SELECT * FROM workflow_runs WHERE tenant_id=? AND workflow_id=? ORDER BY created_at DESC LIMIT ?').all(tenantId, workflowId, limit) as WorkflowRun[];
  }
  return db.prepare('SELECT * FROM workflow_runs WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?').all(tenantId, limit) as WorkflowRun[];
}

// ── Pack operations ───────────────────────────────────────────────────────
export interface Pack {
  id: string; tenant_id: string | null; name: string; slug: string;
  description: string; short_description: string; category: string;
  visibility: string; latest_version: string; author_id: string | null;
  author_name: string; verified: number; security_status: string;
  reputation_score: number; downloads: number; rating_sum: number;
  rating_count: number; tools_json: string; tags_json: string;
  permissions_json: string; data_handling: string; flagged: number;
  created_at: string; updated_at: string; deleted_at: string | null;
}

export function createPack(tenantId: string, authorId: string, input: {
  name: string; slug: string; description: string; shortDescription: string;
  category: string; visibility: string; tools: string[]; tags: string[];
  permissions: string[]; dataHandling: string; authorName: string;
}): Pack {
  const db = getDB();
  const id = newId('pck');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO packs (id, tenant_id, name, slug, description, short_description, category,
    visibility, latest_version, author_id, author_name, tools_json, tags_json, permissions_json,
    data_handling, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,'0.0.0',?,?,?,?,?,?,?,?)`)
    .run(id, tenantId, input.name, input.slug, input.description, input.shortDescription,
      input.category, input.visibility, authorId, input.authorName,
      JSON.stringify(input.tools), JSON.stringify(input.tags),
      JSON.stringify(input.permissions), input.dataHandling, now, now);
  return getPack(id)!;
}

export function getPack(id: string): Pack | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM packs WHERE id=? AND deleted_at IS NULL').get(id) as Pack | undefined;
}

export function getPackBySlug(slug: string): Pack | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM packs WHERE slug=? AND deleted_at IS NULL').get(slug) as Pack | undefined;
}

export function browsePacks(opts: {
  search?: string; category?: string; verifiedOnly?: boolean; trending?: boolean;
  sort?: string; page?: number; limit?: number; visibility?: string;
}): { packs: Pack[]; total: number } {
  const db = getDB();
  const { search, category, verifiedOnly, sort, page = 1, limit = 12, visibility = 'public' } = opts;
  const conditions: string[] = ['p.deleted_at IS NULL', 'p.flagged=0'];
  const params: (string | number)[] = [];

  conditions.push('p.visibility=?');
  params.push(visibility);

  if (search) {
    conditions.push(`(p.name LIKE ? OR p.description LIKE ? OR p.tags_json LIKE ?)`);
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (category && category !== 'all') {
    conditions.push('p.category=?');
    params.push(category);
  }
  if (verifiedOnly) {
    conditions.push('p.verified=1');
  }

  const where = conditions.join(' AND ');
  const orderMap: Record<string, string> = {
    newest: 'p.updated_at DESC',
    trending: 'p.downloads DESC',
    rating: '(CASE WHEN p.rating_count>0 THEN p.rating_sum/p.rating_count ELSE 0 END) DESC',
    reputation: 'p.reputation_score DESC',
    relevance: 'p.reputation_score DESC',
  };
  const order = orderMap[sort ?? 'relevance'] ?? 'p.reputation_score DESC';
  const offset = (page - 1) * limit;

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM packs p WHERE ${where}`).get(...params) as { cnt: number }).cnt;
  const packs = db.prepare(`SELECT p.* FROM packs p WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset) as Pack[];
  return { packs, total };
}

export function incrementDownload(id: string): void {
  const db = getDB();
  db.prepare('UPDATE packs SET downloads=downloads+1 WHERE id=?').run(id);
}

// ── Pack Version operations ───────────────────────────────────────────────
export interface PackVersion {
  id: string; pack_id: string; version: string; manifest_json: string;
  readme: string; changelog: string; immutable: number; published_at: string;
}

export function publishPackVersion(packId: string, version: string, manifestJson: string, readme: string, changelog: string): PackVersion {
  const db = getDB();
  const id = newId('pkv');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO pack_versions (id, pack_id, version, manifest_json, readme, changelog, published_at)
    VALUES (?,?,?,?,?,?,?)`)
    .run(id, packId, version, manifestJson, readme, changelog, now);
  db.prepare('UPDATE packs SET latest_version=?, updated_at=? WHERE id=?').run(version, now, packId);
  return getPackVersion(packId, version)!;
}

export function getPackVersion(packId: string, version: string): PackVersion | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM pack_versions WHERE pack_id=? AND version=?').get(packId, version) as PackVersion | undefined;
}

export function listPackVersions(packId: string): PackVersion[] {
  const db = getDB();
  return db.prepare('SELECT * FROM pack_versions WHERE pack_id=? ORDER BY published_at DESC').all(packId) as PackVersion[];
}

// ── Entitlement operations ────────────────────────────────────────────────
export interface Entitlement {
  id: string; tenant_id: string; plan: string;
  stripe_customer_id: string | null; stripe_subscription_id: string | null;
  stripe_price_id: string | null; status: string;
  runs_per_month: number; runs_used_this_month: number;
  pack_limit: number; retention_days: number;
  period_start: string | null; period_end: string | null; updated_at: string;
}

export const PLAN_LIMITS: Record<string, Omit<Partial<Entitlement>, 'id' | 'tenant_id' | 'stripe_customer_id' | 'stripe_subscription_id' | 'stripe_price_id' | 'status' | 'updated_at' | 'period_start' | 'period_end'>> = {
  free:       { plan: 'free',       runs_per_month: 100,   pack_limit: 5,   retention_days: 7  },
  pro:        { plan: 'pro',        runs_per_month: 10000, pack_limit: 100, retention_days: 90 },
  team:       { plan: 'team',       runs_per_month: 50000, pack_limit: 500, retention_days: 180 },
  enterprise: { plan: 'enterprise', runs_per_month: -1,    pack_limit: -1,  retention_days: 365 },
};

export function getEntitlement(tenantId: string): Entitlement | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM entitlements WHERE tenant_id=?').get(tenantId) as Entitlement | undefined;
}

export function upsertEntitlement(tenantId: string, patch: Partial<Entitlement>): void {
  const db = getDB();
  const now = new Date().toISOString();
  const existing = getEntitlement(tenantId);
  if (!existing) {
    const limits = PLAN_LIMITS[patch.plan ?? 'free'] ?? PLAN_LIMITS['free'];
    db.prepare(`INSERT INTO entitlements (id, tenant_id, plan, stripe_customer_id, stripe_subscription_id,
      stripe_price_id, status, runs_per_month, runs_used_this_month, pack_limit, retention_days, updated_at)
      VALUES (?,?,?,?,?,?,?,?,0,?,?,?)`)
      .run(newId('ent'), tenantId, limits.plan ?? 'free', patch.stripe_customer_id ?? null,
        patch.stripe_subscription_id ?? null, patch.stripe_price_id ?? null, patch.status ?? 'active',
        limits.runs_per_month ?? 100, limits.pack_limit ?? 5, limits.retention_days ?? 7, now);
  } else {
    db.prepare(`UPDATE entitlements SET
      plan=COALESCE(?,plan), stripe_customer_id=COALESCE(?,stripe_customer_id),
      stripe_subscription_id=COALESCE(?,stripe_subscription_id), stripe_price_id=COALESCE(?,stripe_price_id),
      status=COALESCE(?,status), runs_per_month=COALESCE(?,runs_per_month),
      pack_limit=COALESCE(?,pack_limit), retention_days=COALESCE(?,retention_days),
      period_start=COALESCE(?,period_start), period_end=COALESCE(?,period_end), updated_at=?
      WHERE tenant_id=?`)
      .run(patch.plan ?? null, patch.stripe_customer_id ?? null, patch.stripe_subscription_id ?? null,
        patch.stripe_price_id ?? null, patch.status ?? null, patch.runs_per_month ?? null,
        patch.pack_limit ?? null, patch.retention_days ?? null,
        patch.period_start ?? null, patch.period_end ?? null, now, tenantId);
  }
}

export function checkRunLimit(tenantId: string): { allowed: boolean; used: number; limit: number; plan: string } {
  const ent = getEntitlement(tenantId);
  if (!ent) return { allowed: true, used: 0, limit: 100, plan: 'free' };
  if (ent.runs_per_month === -1) return { allowed: true, used: ent.runs_used_this_month, limit: -1, plan: ent.plan };
  return {
    allowed: ent.runs_used_this_month < ent.runs_per_month,
    used: ent.runs_used_this_month,
    limit: ent.runs_per_month,
    plan: ent.plan,
  };
}

export function incrementRunUsage(tenantId: string): void {
  const db = getDB();
  db.prepare('UPDATE entitlements SET runs_used_this_month=runs_used_this_month+1 WHERE tenant_id=?').run(tenantId);
}

export function resetMonthlyUsage(tenantId: string): void {
  const db = getDB();
  db.prepare('UPDATE entitlements SET runs_used_this_month=0 WHERE tenant_id=?').run(tenantId);
}

// ── Audit operations ──────────────────────────────────────────────────────
export interface AuditEvent {
  id: number; tenant_id: string; user_id: string | null;
  action: string; resource: string; resource_id: string;
  metadata_json: string; ip_address: string | null; created_at: string;
}

export function appendAudit(tenantId: string, userId: string | null, action: string, resource: string, resourceId: string, metadata: unknown, ip?: string): void {
  const db = getDB();
  db.prepare(`INSERT INTO audit_events (tenant_id, user_id, action, resource, resource_id, metadata_json, ip_address, created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(tenantId, userId ?? null, action, resource, resourceId, JSON.stringify(metadata), ip ?? null, new Date().toISOString());
}

export function listAuditEvents(tenantId: string, limit = 100, offset = 0): AuditEvent[] {
  const db = getDB();
  return db.prepare('SELECT * FROM audit_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(tenantId, limit, offset) as AuditEvent[];
}

// ── Webhook event deduplication ───────────────────────────────────────────
export function upsertWebhookEvent(stripeEventId: string, type: string, payloadJson: string): boolean {
  const db = getDB();
  const existing = db.prepare('SELECT id FROM webhook_events WHERE stripe_event_id=?').get(stripeEventId);
  if (existing) return false; // already processed
  db.prepare(`INSERT INTO webhook_events (id, stripe_event_id, type, payload_json, processed, created_at)
    VALUES (?,?,?,?,0,?)`)
    .run(newId('whe'), stripeEventId, type, payloadJson, new Date().toISOString());
  return true;
}

export function markWebhookProcessed(stripeEventId: string): void {
  const db = getDB();
  db.prepare('UPDATE webhook_events SET processed=1 WHERE stripe_event_id=?').run(stripeEventId);
}

// ── Pack review operations ────────────────────────────────────────────────
export function addReview(packId: string, userId: string, rating: number, body: string): void {
  const db = getDB();
  db.prepare(`INSERT OR REPLACE INTO marketplace_reviews (id, pack_id, user_id, rating, body, created_at)
    VALUES (?,?,?,?,?,?)`)
    .run(newId('rev'), packId, userId, rating, body, new Date().toISOString());
  // Recompute rating on pack
  const agg = db.prepare('SELECT SUM(rating) as s, COUNT(*) as c FROM marketplace_reviews WHERE pack_id=?').get(packId) as { s: number; c: number };
  db.prepare('UPDATE packs SET rating_sum=?, rating_count=? WHERE id=?').run(agg.s, agg.c, packId);
}

export function flagPack(id: string): void {
  const db = getDB();
  db.prepare('UPDATE packs SET flagged=1, security_status=? WHERE id=?').run('concern', id);
}

// ── Cloud seed (dev only) ─────────────────────────────────────────────────
export function seedDevData(): { tenant: Tenant; user: User; rawApiKey: string } {
  const db = getDB();
  // Idempotent: skip if already seeded
  const existing = db.prepare("SELECT id FROM tenants WHERE slug='reach-dev'").get();
  if (existing) {
    const tenant = getTenantBySlug('reach-dev')!;
    const user = db.prepare("SELECT id FROM users WHERE email='admin@reach.dev'").get() as { id: string };
    return { tenant, user: getUserById(user.id)!, rawApiKey: 'ALREADY_SEEDED' };
  }
  const tenant = createTenant('Reach Dev', 'reach-dev');
  const user = createUser('admin@reach.dev', 'dev-password-local', 'Admin');
  addMember(tenant.id, user.id, 'owner');
  const project = createProject(tenant.id, 'Default Project', 'Auto-created dev project');
  const { rawKey } = createApiKey(tenant.id, user.id, 'dev-key', ['*']);
  createWorkflow(tenant.id, project.id, 'Hello World Workflow', 'Sample workflow', user.id,
    JSON.stringify({
      nodes: [
        { id: 'n1', type: 'trigger', name: 'Start', inputs: {}, config: {}, outputs: {} },
        { id: 'n2', type: 'agent', name: 'Process', inputs: {}, config: { model: 'kimi-coding-2.5' }, outputs: {} },
        { id: 'n3', type: 'output', name: 'Result', inputs: {}, config: {}, outputs: {} },
      ],
      edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }],
      triggers: [{ type: 'manual' }],
      policies: [],
      version: 1,
    }));
  return { tenant, user, rawApiKey: rawKey };
}
