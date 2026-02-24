package trust

import (
	"encoding/json"
	"fmt"

	"reach/services/runner/internal/determinism"
)

type MemoryItem struct {
	MemoryID    string            `json:"memory_id"`
	Type        string            `json:"type"`
	Role        string            `json:"role,omitempty"`
	Content     string            `json:"content,omitempty"`
	ContentRef  string            `json:"content_ref,omitempty"`
	ToolCall    map[string]any    `json:"tool_call,omitempty"`
	Attachments []string          `json:"attachments,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

type MemoryEnvelope struct {
	Version string       `json:"version"`
	Items   []MemoryItem `json:"items"`
}

func CanonicalMemoryHash(in []byte) ([]byte, string, error) {
	var env MemoryEnvelope
	if err := json.Unmarshal(in, &env); err != nil {
		return nil, "", fmt.Errorf("decode memory input: %w", err)
	}
	if env.Version == "" {
		env.Version = MemoryAnchorFormatVersion
	}
	if env.Version != MemoryAnchorFormatVersion {
		return nil, "", fmt.Errorf("unsupported memory version %q", env.Version)
	}
	for i, item := range env.Items {
		if item.MemoryID == "" || item.Type == "" {
			return nil, "", fmt.Errorf("item %d missing required memory_id/type", i)
		}
	}
	canonical := determinism.CanonicalJSON(env)
	hash := determinism.Hash(env)
	return []byte(canonical), hash, nil
}
