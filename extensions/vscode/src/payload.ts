import { ContextPayload, RepoSyncProfile, SelectionRange, WorkspaceConfig } from "./types";

export interface ContextInput {
  workspaceRoot: string | null;
  openFiles: string[];
  activeFile: string | null;
  selectionRange: SelectionRange | null;
  workspace_config?: WorkspaceConfig;
  repo_sync_profile?: RepoSyncProfile;
  tier?: "free" | "pro" | "enterprise";
}

export function createContextPayload(input: ContextInput): ContextPayload {
  return {
    workspace_root: input.workspaceRoot,
    open_files: input.openFiles,
    active_file: input.activeFile,
    selection_range: input.selectionRange,
    workspace_config: input.workspace_config,
    repo_sync_profile: input.repo_sync_profile,
    tier: input.tier,
  };
}
