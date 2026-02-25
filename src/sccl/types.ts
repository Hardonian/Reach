export type SyncStrategy = 'rebase' | 'merge';

export interface WorkspaceManifest {
  schema_version: '1.0';
  git: {
    remote: string;
    default_branch: string;
    required_pr_flow: boolean;
    sync_strategy: SyncStrategy;
    stale_base_threshold_commits: number;
    branch_naming: string;
  };
  gates: { required: string[] };
  risk_zones: { high_risk_paths: string[] };
  acknowledgements: { intent_ack_path: string; openapi_ack_path: string };
  identity: { git_host: 'github' | 'gitlab' | 'other'; auth_mode: 'device_code' | 'pat' | 'oidc' };
}

export interface RepoState {
  repo_root: string;
  local_head: string;
  upstream_head: string;
  base_head: string;
  local_branch: string;
  dirty: boolean;
  stale_commits: number;
  stale_base: boolean;
}

export type SyncAction = 'fast-forward' | 'rebase' | 'merge' | 'abort';

export interface SyncPlan {
  action: SyncAction;
  reasons: string[];
  stale_base: boolean;
  stale_commits: number;
}

export type ConflictClass = 'TEXT_OVERLAP' | 'STRUCTURAL_API' | 'TRUST_BOUNDARY' | 'OPENAPI_CONTRACT' | 'SEMANTIC_INTENT';

export interface PatchApplyResult {
  ok: boolean;
  branch: string;
  conflict_classes: ConflictClass[];
  conflicts: string[];
  changed_files: string[];
  report_path?: string;
}

export interface Actor {
  user_id: string;
  device_id: string;
  agent_id: string;
  git_name?: string;
  git_email?: string;
}

export interface Lease {
  lease_id: string;
  repo_id: string;
  branch: string;
  scope: 'repo-wide' | 'branch-level' | 'path-prefix';
  paths: string[];
  owner: Actor;
  acquired_at: string;
  expires_at: string;
  ttl_seconds: number;
}

export interface PatchPack {
  pack_id: string;
  base_sha: string;
  head_sha?: string;
  actor: Actor;
  files: Array<{ path: string; patch: string }>;
  context_hash?: string;
  cpx_arbitration_id?: string;
  dgl_report_paths?: string[];
}

export interface ScclRunRecord {
  run_id: string;
  timestamp: string;
  base_sha: string;
  head_sha: string;
  patch_hash: string;
  context_hash: string;
  actor: Actor;
  dgl_report_paths: string[];
  cpx_arbitration_id?: string;
  determinism_replay_ids: string[];
  conflict_classes: ConflictClass[];
}
