export interface SelectionRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface WorkspaceConfig {
  spawn_defaults?: Record<string, unknown>;
  budget_defaults?: Record<string, unknown>;
  model_provider_default?: string;
  connector_defaults?: Record<string, unknown>;
}

export interface RepoSyncProfile {
  mode: 'metadata' | 'diff-only' | 'full';
  branch_scope?: string[];
  file_scope?: string[];
  max_size?: number;
}

export interface ContextPayload {
  workspace_root: string | null;
  open_files: string[];
  active_file: string | null;
  selection_range: SelectionRange | null;
  workspace_config?: WorkspaceConfig;
  repo_sync_profile?: RepoSyncProfile;
  tier?: 'free' | 'pro' | 'enterprise';
}

export interface BridgeEvent {
  type: string;
  [key: string]: unknown;
}

export interface Artifact {
  name: string;
  description?: string;
  uri?: string;
}

export interface ApprovalPrompt {
  id: string;
  title: string;
  detail?: string;
}
