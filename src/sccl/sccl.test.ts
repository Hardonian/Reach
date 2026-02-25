import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { classifyConflicts } from './engine';
import { validateWorkspaceManifest } from './manifest';
import { acquireLease, listLeases, releaseLease } from './lease-store';

const root = process.cwd();
const leasePath = path.join(root, 'dgl', 'sccl', 'leases.json');

describe('sccl manifest + conflict + leases', () => {
  beforeEach(() => {
    if (fs.existsSync(leasePath)) fs.unlinkSync(leasePath);
  });

  it('validates workspace manifest shape', () => {
    const m = JSON.parse(fs.readFileSync(path.join(root, 'reach.workspace.json'), 'utf-8')) as Parameters<typeof validateWorkspaceManifest>[0];
    expect(() => validateWorkspaceManifest(m)).not.toThrow();
  });

  it('classifies deterministic conflict classes', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(root, 'dgl/sccl/fixtures/conflict-classification.sample.json'), 'utf-8')) as { files: string[]; expected_classes: string[] };
    expect(classifyConflicts(fixture.files)).toEqual(fixture.expected_classes);
  });

  it('acquires and releases leases', () => {
    const lease = acquireLease({ repo_id: 'reach', branch: 'reach/test/lease', scope: 'branch-level', paths: [], ttl_seconds: 30, owner: { user_id: 'tester', device_id: 'ci', agent_id: 'vitest' } }, root);
    expect(listLeases(root)).toHaveLength(1);
    expect(releaseLease(lease.lease_id, root)).toBe(true);
    expect(listLeases(root)).toHaveLength(0);
  });
});
