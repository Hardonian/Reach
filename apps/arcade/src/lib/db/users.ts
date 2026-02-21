import { getDB } from './connection';
import { newId, hashPassword } from './helpers';
import { type User, type Role } from './types';

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

export function addMember(tenantId: string, userId: string, role: Role = 'member'): void {
  const db = getDB();
  const id = newId('mbr');
  const now = new Date().toISOString();
  db.prepare(`INSERT OR REPLACE INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?,?,?,?,?)`)
    .run(id, tenantId, userId, role, now);
}

export function getMembership(tenantId: string, userId: string): { role: Role } | undefined {
  const db = getDB();
  return db.prepare('SELECT role FROM memberships WHERE tenant_id=? AND user_id=?').get(tenantId, userId) as { role: Role } | undefined;
}
export function trackFirstSuccess(userId: string): void {
  const db = getDB();
  db.prepare(`
    UPDATE users 
    SET first_success_at = COALESCE(first_success_at, ?) 
    WHERE id = ?
  `).run(new Date().toISOString(), userId);
}
