import fs from 'fs';
import path from 'path';

export interface PaginationInput {
  page: number;
  pageSize: number;
}

export function authFailurePayload() {
  return {
    ok: false,
    error: {
      code: 'AUTH_REQUIRED',
      message: 'Authentication required to access source coherence data.',
    },
  };
}

export function paginate<T>(rows: T[], input: PaginationInput): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const page = Math.max(1, input.page);
  const pageSize = Math.max(1, Math.min(100, input.pageSize));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total, page, pageSize, totalPages };
}

export function readScclRuns(root = process.cwd()): Array<Record<string, unknown>> {
  const dir = path.join(root, 'dgl', 'sccl', 'run-records');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Record<string, unknown>);
}

export function readConflictReports(root = process.cwd()): Array<Record<string, unknown>> {
  const dir = path.join(root, 'dgl', 'sccl', 'reports');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Record<string, unknown>);
}

export interface LeasePayload {
  lease_id: string;
  repo_id: string;
  branch: string;
  scope: 'repo-wide' | 'branch-level' | 'path-prefix';
  paths: string[];
  owner: { user_id: string; device_id: string; agent_id: string };
  acquired_at: string;
  expires_at: string;
  ttl_seconds: number;
}

const leaseFile = (root = process.cwd()) => path.join(root, 'dgl', 'sccl', 'leases.json');

export function listLeases(root = process.cwd()): LeasePayload[] {
  const file = leaseFile(root);
  if (!fs.existsSync(file)) return [];
  const payload = JSON.parse(fs.readFileSync(file, 'utf-8')) as { leases?: LeasePayload[] };
  return (payload.leases ?? []).sort((a, b) => a.branch.localeCompare(b.branch));
}

export function writeLeases(leases: LeasePayload[], root = process.cwd()): void {
  const file = leaseFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ schema_version: '1.0', updated_at: new Date().toISOString(), leases }, null, 2));
}
