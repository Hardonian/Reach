import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { validateScclGate } from './gate';

const root = process.cwd();
const runsDir = path.join(root, 'dgl', 'sccl', 'run-records');
const leaseFile = path.join(root, 'dgl', 'sccl', 'leases.json');

describe('sccl gate', () => {
  it('fails when run record is missing', () => {
    fs.rmSync(runsDir, { recursive: true, force: true });
    const result = validateScclGate(root);
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('missing run record');
  });

  it('flags duplicate branch leases', () => {
    const now = Date.now();
    fs.mkdirSync(path.dirname(leaseFile), { recursive: true });
    fs.writeFileSync(leaseFile, JSON.stringify({ schema_version: '1.0', updated_at: new Date().toISOString(), leases: [
      { lease_id: 'lease_a', repo_id: 'reach', branch: 'reach/sccl/demo', scope: 'branch-level', paths: [], owner: { user_id: 'alice', device_id: 'mac', agent_id: 'reach-cli' }, acquired_at: new Date(now).toISOString(), expires_at: new Date(now + 600000).toISOString(), ttl_seconds: 900 },
      { lease_id: 'lease_b', repo_id: 'reach', branch: 'reach/sccl/demo', scope: 'branch-level', paths: [], owner: { user_id: 'bob', device_id: 'linux', agent_id: 'web-agent' }, acquired_at: new Date(now).toISOString(), expires_at: new Date(now + 600000).toISOString(), ttl_seconds: 900 },
    ] }, null, 2));
    fs.mkdirSync(runsDir, { recursive: true });
    fs.writeFileSync(path.join(runsDir, 'gate_test.json'), JSON.stringify({ run_id: 'gate_test' }, null, 2));
    const result = validateScclGate(root);
    expect(result.failures.join(' ')).toContain('lease conflict');
  });
});
