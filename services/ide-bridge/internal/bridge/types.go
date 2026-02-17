package bridge

import "time"

type Position struct {
	Line      int `json:"line"`
	Character int `json:"character"`
}

type SelectionRange struct {
	Start Position `json:"start"`
	End   Position `json:"end"`
}

type EditorContext struct {
	WorkspaceRoot  string         `json:"workspace_root"`
	OpenFiles      []string       `json:"open_files"`
	ActiveFile     string         `json:"active_file"`
	SelectionRange SelectionRange `json:"selection_range"`
}

type RegisterEditorResponse struct {
	EditorID string `json:"editor_id"`
}

type CommandEnvelope struct {
	Type      string         `json:"type"`
	CommandID string         `json:"command_id,omitempty"`
	Payload   map[string]any `json:"payload"`
}

type ApprovalDecision struct {
	RunID    string `json:"run_id"`
	Approved bool   `json:"approved"`
	Reason   string `json:"reason,omitempty"`
}

type ApprovalForwardRequest struct {
	EditorID string           `json:"editor_id"`
	Decision ApprovalDecision `json:"decision"`
}

type editorState struct {
	id            string
	context       EditorContext
	contextSet    bool
	conn          *websocketConn
	registeredAt  time.Time
	lastHeartbeat time.Time
}
