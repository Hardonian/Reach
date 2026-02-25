import fs from 'fs';
import path from 'path';
import { Lease } from './types.js';
import { loadWorkspaceManifest } from './manifest.js';
import { getRepoState } from './engine.js';
import { listLeases } from './lease-store.js';

interface ScclGateResult {
  ok: boolean;
  failures: string[];
  fix_steps: string[];
}

function hasRunRecords(root: string): boolean {
  const dir = path.join(root, 'dgl', 'sccl', 'run-records');
  return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.json'));
}

function hasDuplicateBranchLeases(leases: Lease[]): boolean {
  const seen = new Set<string>();
  for (const lease of leases) {
    const key = `${lease.repo_id}:${lease.branch}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

export function validateScclGate(root = process.cwd()): ScclGateResult {
  const manifest = loadWorkspaceManifest(root);
  const state = getRepoState(manifest, root);
  const leases = listLeases(root);
  const failures: string[] = [];
  if (state.stale_base) failures.push(`stale base: local branch is ${state.stale_commits} commits behind ${manifest.git.remote}/${manifest.git.default_branch}`);
  if (!hasRunRecords(root)) failures.push('missing run record linking base/head/patch hash');
  if (hasDuplicateBranchLeases(leases)) failures.push('lease conflict: multiple active leases detected for the same branch');
  if (manifest.git.required_pr_flow && state.local_branch === manifest.git.default_branch) failures.push('direct-to-main change detected; PR flow required');

  return {
    ok: failures.length === 0,
    failures,
    fix_steps: [
      'Run: reach sync status',
      'Run: reach sync up',
      'Run: reach sync lease acquire --branch <branch>',
      'Run: reach sync apply --pack <patchpack.json>',
      'Run: reach sync pr --ensure',
    ],
  };
}
