import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

export function loadManifest(root = process.cwd()): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(root, 'reach.workspace.json'), 'utf-8')) as Record<string, unknown>;
}

const git = (cmd: string, root = process.cwd()) => execSync(`git ${cmd}`, { cwd: root, encoding: 'utf-8' }).trim();

export function getStatus(root = process.cwd()) {
  const manifest = loadManifest(root) as { git: { remote: string; default_branch: string; stale_base_threshold_commits: number; sync_strategy: string }; gates: { required: string[] } };
  const upstream = `${manifest.git.remote}/${manifest.git.default_branch}`;
  try { git(`fetch ${manifest.git.remote}`, root); } catch { /* offline */ }
  const local_head = git('rev-parse HEAD', root);
  const upstream_head = git(`rev-parse ${upstream}`, root);
  const base_head = git(`merge-base HEAD ${upstream}`, root);
  const stale_commits = Number(git(`rev-list --count ${base_head}..${upstream}`, root));
  const state = {
    repo_root: git('rev-parse --show-toplevel', root),
    local_head,
    upstream_head,
    base_head,
    local_branch: git('rev-parse --abbrev-ref HEAD', root),
    dirty: git('status --porcelain', root).length > 0,
    stale_commits,
    stale_base: stale_commits > manifest.git.stale_base_threshold_commits,
  };
  const plan = state.dirty ? { action: 'abort', reasons: ['working tree is dirty'] } : state.local_head === state.upstream_head ? { action: 'fast-forward', reasons: ['already up to date'] } : { action: manifest.git.sync_strategy, reasons: ['sync needed'] };
  return { state, plan, required_gates: manifest.gates.required };
}

export function applyPack(pack: { pack_id: string; base_sha: string; files: Array<{ path: string; patch: string }>; actor: Record<string, unknown>; context_hash?: string }, branch: string, root = process.cwd()) {
  const changed = pack.files.map((f) => f.path).sort();
  const conflict_classes = changed.filter((f) => f.includes('openapi')).length ? ['OPENAPI_CONTRACT'] : [];
  const reportDir = path.join(root, 'dgl', 'sccl', 'reports');
  const runsDir = path.join(root, 'dgl', 'sccl', 'run-records');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.mkdirSync(runsDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, `${pack.pack_id}.conflicts.json`), JSON.stringify({ pack_id: pack.pack_id, branch, conflict_classes, files: changed }, null, 2));
  const patch_hash = createHash('sha256').update(JSON.stringify(pack.files)).digest('hex');
  const run = {
    run_id: `sccl_${createHash('sha256').update(`${pack.base_sha}:${patch_hash}`).digest('hex').slice(0, 12)}`,
    timestamp: new Date().toISOString(),
    base_sha: pack.base_sha,
    head_sha: pack.base_sha,
    patch_hash,
    context_hash: pack.context_hash ?? createHash('sha256').update(pack.base_sha).digest('hex'),
    actor: pack.actor,
    conflict_classes,
    dgl_report_paths: [],
    determinism_replay_ids: [],
  };
  fs.writeFileSync(path.join(runsDir, `${run.run_id}.json`), JSON.stringify(run, null, 2));
  return { result: { ok: conflict_classes.length === 0, branch, conflict_classes, changed_files: changed }, run };
}
