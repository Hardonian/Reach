package core

import "time"

type RepoSyncMode string

const (
	RepoSyncMetadata RepoSyncMode = "metadata"
	RepoSyncDiffOnly RepoSyncMode = "diff-only"
	RepoSyncFull     RepoSyncMode = "full"
)

type RepoSyncProfile struct {
	Mode        RepoSyncMode `json:"mode"`
	BranchScope []string     `json:"branch_scope,omitempty"`
	FileScope   []string     `json:"file_scope,omitempty"`
	MaxSize     int64        `json:"max_size,omitempty"`
}

type WorkspaceConfig struct {
	SpawnDefaults        map[string]any `json:"spawn_defaults,omitempty"`
	BudgetDefaults       map[string]any `json:"budget_defaults,omitempty"`
	ModelProviderDefault string         `json:"model_provider_default,omitempty"`
	ConnectorDefaults    map[string]any `json:"connector_defaults,omitempty"`
}

type RepoMetadata struct {
	RepoID      string          `json:"repo_id,omitempty"`
	CommitSHA   string          `json:"commit_sha,omitempty"`
	Branch      string          `json:"branch,omitempty"`
	Profile     RepoSyncProfile `json:"profile"`
	DiffSummary string          `json:"diff_summary,omitempty"`
	RawContent  string          `json:"raw_content,omitempty"`
}

type CapsuleMetadata struct {
	SessionID       string          `json:"session_id"`
	SpawnTree       map[string]any  `json:"spawn_tree,omitempty"`
	IterationCount  int             `json:"iteration_count,omitempty"`
	BudgetState     map[string]any  `json:"budget_state,omitempty"`
	CheckpointRefs  []string        `json:"checkpoint_refs,omitempty"`
	RepoMetadata    RepoMetadata    `json:"repo_metadata"`
	WorkspaceConfig WorkspaceConfig `json:"workspace_config,omitempty"`
	DeviceVersion   int64           `json:"device_version"`
	ServerVersion   int64           `json:"server_version"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type Device struct {
	ID         string `json:"id"`
	TenantID   string `json:"tenant_id"`
	DeviceType string `json:"device_type"`
	TrustLevel string `json:"trust_level"`
	Signature  string `json:"signature"`
}

type SyncRequest struct {
	TenantID       string          `json:"tenant_id"`
	Plan           string          `json:"plan"`
	Device         Device          `json:"device"`
	Metadata       CapsuleMetadata `json:"metadata"`
	IdempotencyKey string          `json:"idempotency_key"`
}

type SyncResponse struct {
	Metadata       CapsuleMetadata `json:"metadata"`
	Conflict       bool            `json:"conflict"`
	ConflictReason string          `json:"conflict_reason,omitempty"`
	ResolvedUsing  string          `json:"resolved_using,omitempty"`
}
