#!/usr/bin/env npx tsx
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { applyPatchPack, computeSyncPlan, emitRunRecord, getRepoState, loadWorkspaceManifest, validateScclGate, acquireLease, listLeases, releaseLease, renewLease, type PatchPack, type Lease } from '../src/sccl/index.js';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'status';
const sub = args[1] ?? '';
const flag = (name: string, fallback = ''): string => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

function redact(value: string): string {
  return value.replace(/(token|authorization|bearer|pat)\s+[\w.-]+/gi, '$1 [REDACTED]');
}

function git(c: string): string {
  return execSync(`git ${c}`, { encoding: 'utf-8' }).trim();
}

function print(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function requireLease(branch: string): Lease {
  const lease = listLeases().find((l) => l.branch === branch);
  if (!lease) throw new Error(`lease required for branch ${branch}. Run: reach sync lease acquire --branch ${branch}`);
  return lease;
}

if (cmd === 'workspace') {
  if (sub === 'validate') {
    const m = loadWorkspaceManifest();
    print({ ok: true, schema_version: m.schema_version, required_gates: m.gates.required });
    process.exit(0);
  }
  if (sub === 'show') {
    print(loadWorkspaceManifest());
    process.exit(0);
  }
}

if (cmd === 'sync' && sub === 'status') {
  const manifest = loadWorkspaceManifest();
  const state = getRepoState(manifest);
  const plan = computeSyncPlan(state, manifest.git.sync_strategy);
  print({ ok: true, state, plan, required_gates: manifest.gates.required });
  process.exit(0);
}

if (cmd === 'sync' && sub === 'up') {
  const manifest = loadWorkspaceManifest();
  const state = getRepoState(manifest);
  const plan = computeSyncPlan(state, manifest.git.sync_strategy);
  if (plan.action === 'abort') {
    print({ ok: false, code: 'DIRTY_TREE', message: 'Working tree is dirty.', plan });
    process.exit(1);
  }
  if (plan.action === 'rebase') git(`rebase ${manifest.git.remote}/${manifest.git.default_branch}`);
  if (plan.action === 'merge') git(`merge --no-ff ${manifest.git.remote}/${manifest.git.default_branch}`);
  print({ ok: true, action: plan.action, plan });
  process.exit(0);
}

if (cmd === 'sync' && sub === 'branch') {
  const manifest = loadWorkspaceManifest();
  const task = flag('--task', 'task').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const branch = manifest.git.branch_naming.replace('<task>', task).replace('<timestamp>', stamp);
  git(`checkout -b ${branch} ${manifest.git.remote}/${manifest.git.default_branch}`);
  print({ ok: true, branch });
  process.exit(0);
}

if (cmd === 'sync' && sub === 'apply') {
  const packFile = flag('--pack', '');
  if (!packFile) throw new Error('missing --pack <patchpack.json>');
  const pack = JSON.parse(fs.readFileSync(path.resolve(packFile), 'utf-8')) as PatchPack;
  const branch = git('rev-parse --abbrev-ref HEAD');
  requireLease(branch);
  const result = applyPatchPack(pack, branch);
  const head = git('rev-parse HEAD');
  const run = emitRunRecord(pack, result, head);
  print({ ok: result.ok, result, run });
  process.exit(result.ok ? 0 : 1);
}

if (cmd === 'sync' && sub === 'pr') {
  if (flag('--ensure', 'false') !== 'false' || args.includes('--ensure')) {
    const branch = git('rev-parse --abbrev-ref HEAD');
    const metadataPath = path.join(process.cwd(), 'dgl', 'sccl', 'pr-metadata.json');
    fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
    const payload = { branch, base: loadWorkspaceManifest().git.default_branch, ensured_at: new Date().toISOString(), instructions: `Open PR from ${branch} to ${loadWorkspaceManifest().git.default_branch}` };
    fs.writeFileSync(metadataPath, JSON.stringify(payload, null, 2));
    print({ ok: true, metadata_path: metadataPath, ...payload });
    process.exit(0);
  }
}

if (cmd === 'sync' && sub === 'export') {
  const outDir = path.join(process.cwd(), 'dgl', 'examples', 'sccl');
  fs.mkdirSync(outDir, { recursive: true });
  const status = { generated_at: new Date().toISOString(), leases: listLeases(), gate: validateScclGate() };
  const statusPath = path.join(outDir, 'status.json');
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
  print({ ok: true, status_path: statusPath, bundle_hint: 'zip dgl/examples/sccl status + reports + run-records' });
  process.exit(0);
}

if (cmd === 'sync' && sub === 'lease') {
  const action = args[2] ?? '';
  if (action === 'acquire') {
    const branch = flag('--branch', git('rev-parse --abbrev-ref HEAD'));
    const ttl = Number(flag('--ttl', '900'));
    const paths = flag('--paths', '').split(',').map((x) => x.trim()).filter(Boolean);
    const lease = acquireLease({ repo_id: git('rev-parse --show-toplevel'), branch, scope: paths.length ? 'path-prefix' : 'branch-level', paths, ttl_seconds: ttl, owner: { user_id: process.env.USER || 'unknown', device_id: process.env.HOSTNAME || 'device', agent_id: 'reach-cli' } });
    print({ ok: true, lease });
    process.exit(0);
  }
  if (action === 'renew') {
    const lease = renewLease(flag('--id', ''), Number(flag('--ttl', '900')));
    print({ ok: true, lease });
    process.exit(0);
  }
  if (action === 'release') {
    const released = releaseLease(flag('--id', ''));
    print({ ok: released });
    process.exit(released ? 0 : 1);
  }
  if (action === 'list') {
    print({ ok: true, leases: listLeases() });
    process.exit(0);
  }
}

if (cmd === 'gate') {
  const result = validateScclGate();
  print(result);
  process.exit(result.ok ? 0 : 1);
}

if (cmd === 'smoke') {
  const fixtureDir = path.join(process.cwd(), 'dgl', 'sccl', 'fixtures');
  const stale = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'patchpack.stale-base.json'), 'utf-8')) as PatchPack;
  const missingActor = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'patchpack.missing-actor.json'), 'utf-8')) as Record<string, unknown>;
  const outDir = path.join(process.cwd(), 'dgl', 'examples', 'sccl');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'status.json'), JSON.stringify({ stale_base_pack: stale.base_sha, actor_present: Boolean((missingActor as { actor?: unknown }).actor) }, null, 2));
  fs.writeFileSync(path.join(outDir, 'conflict-report.json'), JSON.stringify(applyPatchPack(stale, 'reach/fixture/smoke'), null, 2));
  print({ ok: true, output_dir: outDir, redaction_example: redact('Authorization Bearer abc123') });
  process.exit(0);
}

console.error('Unsupported SCCL command.');
process.exit(1);
