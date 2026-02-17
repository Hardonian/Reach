export interface SelectionRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface ContextPayload {
  workspace_root: string | null;
  open_files: string[];
  active_file: string | null;
  selection_range: SelectionRange | null;
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
