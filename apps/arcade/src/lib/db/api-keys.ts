import crypto from 'crypto';
import { getDB } from './connection';
import { newId, hashApiKey } from './helpers';
import { type WebSession, type ApiKey, type Tenant } from './types';
import { env } from '../env';

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
  return db.prepare('SELECT * FROM web_sessions WHERE id=? AND expires_at > ?').get(id, new Date().toISOString()) as WebSession | undefined;
}

export function deleteSession(id: string): void {
  const db = getDB();
  db.prepare('DELETE FROM web_sessions WHERE id=?').run(id);
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
