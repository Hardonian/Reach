import { describe, expect, it } from 'vitest';
import { computeSyncPlan } from './engine';

describe('sccl sync plan', () => {
  it('aborts on dirty tree', () => {
    const plan = computeSyncPlan({ repo_root: '.', local_head: 'a', upstream_head: 'b', base_head: 'a', local_branch: 'feature', dirty: true, stale_commits: 1, stale_base: false }, 'rebase');
    expect(plan.action).toBe('abort');
  });

  it('fast-forwards when heads match', () => {
    const plan = computeSyncPlan({ repo_root: '.', local_head: 'a', upstream_head: 'a', base_head: 'a', local_branch: 'feature', dirty: false, stale_commits: 0, stale_base: false }, 'merge');
    expect(plan.action).toBe('fast-forward');
  });
});
