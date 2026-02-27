import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { hash } from '../lib/hash';
import { Lease } from './types.js';

interface LeaseStoreFile {
  schema_version: '1.0';
  updated_at: string;
  leases: Lease[];
  digest: string;
}

function storePath(root = process.cwd()): string {
  return path.join(root, 'dgl', 'sccl', 'leases.json');
}

function digestOf(leases: Lease[]): string {
  return hash(JSON.stringify([...leases].sort((a, b) => a.lease_id.localeCompare(b.lease_id))));
}

export function listLeases(root = process.cwd(), now = new Date()): Lease[] {
  const p = storePath(root);
  if (!fs.existsSync(p)) return [];
  const payload = JSON.parse(fs.readFileSync(p, 'utf-8')) as LeaseStoreFile;
  return payload.leases.filter((l) => new Date(l.expires_at).getTime() > now.getTime()).sort((a, b) => a.branch.localeCompare(b.branch));
}

function writeStore(leases: Lease[], root = process.cwd()): void {
  const p = storePath(root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const payload: LeaseStoreFile = {
    schema_version: '1.0',
    updated_at: new Date().toISOString(),
    leases,
    digest: digestOf(leases),
  };
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, p);
}

export function acquireLease(input: Omit<Lease, 'lease_id' | 'acquired_at' | 'expires_at'>, root = process.cwd()): Lease {
  const active = listLeases(root);
  const conflict = active.find((l) => l.repo_id === input.repo_id && l.branch === input.branch);
  if (conflict) throw new Error(`lease conflict on ${input.branch} owned by ${conflict.owner.user_id}`);
  const now = new Date();
  const lease: Lease = {
    ...input,
    lease_id: `lease_${randomUUID()}`,
    acquired_at: now.toISOString(),
    expires_at: new Date(now.getTime() + input.ttl_seconds * 1000).toISOString(),
  };
  writeStore([...active, lease], root);
  return lease;
}

export function renewLease(leaseId: string, ttlSeconds: number, root = process.cwd()): Lease {
  const active = listLeases(root);
  const next = active.map((l) => l.lease_id === leaseId
    ? { ...l, ttl_seconds: ttlSeconds, expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString() }
    : l);
  const lease = next.find((l) => l.lease_id === leaseId);
  if (!lease) throw new Error(`lease not found: ${leaseId}`);
  writeStore(next, root);
  return lease;
}

export function releaseLease(leaseId: string, root = process.cwd()): boolean {
  const active = listLeases(root);
  const next = active.filter((l) => l.lease_id !== leaseId);
  writeStore(next, root);
  return next.length !== active.length;
}
