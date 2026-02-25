import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { ConflictClass, PatchApplyResult, PatchPack, RepoState, ScclRunRecord, SyncPlan, WorkspaceManifest } from './types.js';

function git(cmd: string, root = process.cwd()): string {
  return execSync(`git ${cmd}`, { cwd: root, encoding: 'utf-8' }).trim();
}

export function discoverRepo(root = process.cwd()): string {
  return git('rev-parse --show-toplevel', root);
}

export function getRepoState(manifest: WorkspaceManifest, root = process.cwd()): RepoState {
  const repoRoot = discoverRepo(root);
  const remote = manifest.git.remote;
  const upstreamRef = `${remote}/${manifest.git.default_branch}`;
  try { git(`fetch ${remote}`, repoRoot); } catch { /* offline-safe */ }
  const localHead = git('rev-parse HEAD', repoRoot);
  let upstreamHead = localHead;
  let baseHead = localHead;
  let staleCommits = 0;
  try {
    upstreamHead = git(`rev-parse ${upstreamRef}`, repoRoot);
    baseHead = git(`merge-base HEAD ${upstreamRef}`, repoRoot);
    staleCommits = Number(git(`rev-list --count ${baseHead}..${upstreamRef}`, repoRoot));
  } catch {
    upstreamHead = localHead;
    baseHead = localHead;
    staleCommits = 0;
  }
  return {
    repo_root: repoRoot,
    local_head: localHead,
    upstream_head: upstreamHead,
    base_head: baseHead,
    local_branch: git('rev-parse --abbrev-ref HEAD', repoRoot),
    dirty: git('status --porcelain', repoRoot).length > 0,
    stale_commits: staleCommits,
    stale_base: staleCommits > manifest.git.stale_base_threshold_commits,
  };
}

export function computeSyncPlan(state: RepoState, strategy: WorkspaceManifest['git']['sync_strategy']): SyncPlan {
  if (state.dirty) return { action: 'abort', reasons: ['working tree is dirty'], stale_base: state.stale_base, stale_commits: state.stale_commits };
  if (state.local_head === state.upstream_head) return { action: 'fast-forward', reasons: ['already up to date'], stale_base: state.stale_base, stale_commits: state.stale_commits };
  return { action: strategy, reasons: [strategy === 'rebase' ? 'rebase required to converge with remote' : 'merge required to converge with remote'], stale_base: state.stale_base, stale_commits: state.stale_commits };
}

export function classifyConflicts(files: string[]): ConflictClass[] {
  const classes = new Set<ConflictClass>();
  for (const file of [...files].sort()) {
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.go') || file.endsWith('.rs')) classes.add('TEXT_OVERLAP');
    if (file.includes('openapi') || file.includes('schema')) classes.add('OPENAPI_CONTRACT');
    if (file.includes('auth') || file.includes('billing') || file.includes('webhook')) classes.add('TRUST_BOUNDARY');
    if (file.includes('dgl/intent') || file.includes('intent-manifest')) classes.add('SEMANTIC_INTENT');
    if (file.includes('src/lib') || file.includes('packages/core')) classes.add('STRUCTURAL_API');
  }
  return [...classes].sort();
}

export function emitRunRecord(pack: PatchPack, result: PatchApplyResult, headSha: string, root = process.cwd()): ScclRunRecord {
  const dir = path.join(root, 'dgl', 'sccl', 'run-records');
  fs.mkdirSync(dir, { recursive: true });
  const patchHash = createHash('sha256').update(JSON.stringify(pack.files.sort((a, b) => a.path.localeCompare(b.path)))).digest('hex');
  const run: ScclRunRecord = {
    run_id: `sccl_${createHash('sha256').update(`${pack.base_sha}:${headSha}:${patchHash}`).digest('hex').slice(0, 16)}`,
    timestamp: new Date().toISOString(),
    base_sha: pack.base_sha,
    head_sha: headSha,
    patch_hash: patchHash,
    context_hash: pack.context_hash ?? createHash('sha256').update(`${pack.base_sha}:${headSha}`).digest('hex'),
    actor: pack.actor,
    dgl_report_paths: pack.dgl_report_paths ?? [],
    cpx_arbitration_id: pack.cpx_arbitration_id,
    determinism_replay_ids: [`replay:${pack.base_sha.slice(0, 12)}`, `replay:${headSha.slice(0, 12)}`],
    conflict_classes: result.conflict_classes,
  };
  fs.writeFileSync(path.join(dir, `${run.run_id}.json`), JSON.stringify(run, null, 2));
  return run;
}

export function applyPatchPack(pack: PatchPack, branch: string, root = process.cwd()): PatchApplyResult {
  const changedFiles = pack.files.map((f) => f.path).sort();
  const conflictClasses = classifyConflicts(changedFiles);
  const reportPath = path.join(root, 'dgl', 'sccl', 'reports', `${pack.pack_id}.conflicts.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const result: PatchApplyResult = {
    ok: conflictClasses.length === 0,
    branch,
    conflict_classes: conflictClasses,
    conflicts: conflictClasses.length ? changedFiles : [],
    changed_files: changedFiles,
    report_path: reportPath,
  };
  fs.writeFileSync(reportPath, JSON.stringify({ pack_id: pack.pack_id, branch, conflict_classes: result.conflict_classes, files: changedFiles }, null, 2));
  return result;
}
