import fs from 'fs';
import path from 'path';
import { WorkspaceManifest } from './types.js';

const REQUIRED_GATES = ['determinism', 'dgl', 'openapi', 'routes', 'security', 'performance', 'cpx', 'sccl'];

export function loadWorkspaceManifest(root = process.cwd()): WorkspaceManifest {
  const file = path.join(root, 'reach.workspace.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as WorkspaceManifest;
  validateWorkspaceManifest(raw);
  return raw;
}

export function validateWorkspaceManifest(manifest: WorkspaceManifest): void {
  if (manifest.schema_version !== '1.0') throw new Error('schema_version must be 1.0');
  for (const gate of REQUIRED_GATES) {
    if (!manifest.gates.required.includes(gate)) throw new Error(`missing required gate: ${gate}`);
  }
  if (!manifest.git.remote || !manifest.git.default_branch) throw new Error('git.remote and git.default_branch are required');
  if (!['rebase', 'merge'].includes(manifest.git.sync_strategy)) throw new Error('git.sync_strategy must be rebase or merge');
  if (manifest.git.stale_base_threshold_commits < 0) throw new Error('git.stale_base_threshold_commits must be >= 0');
}
