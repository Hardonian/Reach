import { ContextPayload, SelectionRange } from './types';

export interface ContextInput {
  workspaceRoot: string | null;
  openFiles: string[];
  activeFile: string | null;
  selectionRange: SelectionRange | null;
}

export function createContextPayload(input: ContextInput): ContextPayload {
  return {
    workspace_root: input.workspaceRoot,
    open_files: input.openFiles,
    active_file: input.activeFile,
    selection_range: input.selectionRange
  };
}
