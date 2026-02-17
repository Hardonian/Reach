package jobs

import "time"

type AuditEntry struct {
	RunID     string         `json:"run_id"`
	RequestID string         `json:"request_id"`
	Timestamp time.Time      `json:"timestamp"`
	Type      string         `json:"type"`
	Payload   map[string]any `json:"payload"`
}
