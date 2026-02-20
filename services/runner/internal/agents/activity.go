package agents

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
	"time"
)

// ActivityType classifies activity log entries.
type ActivityType string

const (
	ActivityRequestReceived  ActivityType = "request.received"
	ActivityValidationPassed ActivityType = "validation.passed"
	ActivityValidationFailed ActivityType = "validation.failed"
	ActivityExecStarted      ActivityType = "execution.started"
	ActivityExecCompleted    ActivityType = "execution.completed"
	ActivityExecFailed       ActivityType = "execution.failed"
	ActivityExecTimeout      ActivityType = "execution.timeout"
	ActivityExecRetry        ActivityType = "execution.retry"
	ActivityGuardTriggered   ActivityType = "guard.triggered"
	ActivitySpawnBlocked     ActivityType = "spawn.blocked"
	ActivitySpawnCreated     ActivityType = "spawn.created"
)

// ActivityEntry is a single structured log entry for agent execution.
// Every field is typed — no unstructured console noise.
type ActivityEntry struct {
	// ID is a deterministic identifier derived from the entry content.
	ID string `json:"id"`

	// Timestamp is the UTC time the entry was created.
	Timestamp time.Time `json:"ts"`

	// Type classifies this entry.
	Type ActivityType `json:"type"`

	// RunID is the top-level run.
	RunID RunID `json:"run_id"`

	// TaskID is the specific task.
	TaskID TaskID `json:"task_id"`

	// AgentID is the agent that produced this entry.
	AgentID AgentID `json:"agent_id"`

	// TenantID is the owning tenant.
	TenantID string `json:"tenant_id,omitempty"`

	// Status is the current execution status (if applicable).
	Status Status `json:"status,omitempty"`

	// Duration is the elapsed time (if applicable).
	Duration time.Duration `json:"duration_ms,omitempty"`

	// Message is a short human-readable description.
	Message string `json:"msg,omitempty"`

	// ErrorCode is the machine-readable error code (if applicable).
	ErrorCode string `json:"error_code,omitempty"`

	// Fields carries additional structured data.
	Fields map[string]string `json:"fields,omitempty"`
}

// deterministicID computes a deterministic ID from the entry's content.
// The ID is a truncated SHA-256 of (timestamp + type + run_id + task_id + agent_id).
func deterministicID(ts time.Time, typ ActivityType, runID RunID, taskID TaskID, agentID AgentID) string {
	h := sha256.New()
	fmt.Fprintf(h, "%d|%s|%s|%s|%s", ts.UnixNano(), typ, runID, taskID, agentID)
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// ActivityLog provides structured, append-only activity logging.
// It is safe for concurrent use.
type ActivityLog struct {
	mu      sync.Mutex
	writer  io.Writer
	entries []ActivityEntry
	maxSize int // Maximum entries kept in memory (ring buffer)
}

// ActivityLogOption configures the activity log.
type ActivityLogOption func(*ActivityLog)

// WithWriter sets the output writer for the activity log.
func WithWriter(w io.Writer) ActivityLogOption {
	return func(al *ActivityLog) {
		al.writer = w
	}
}

// WithMaxEntries sets the maximum number of entries kept in memory.
func WithMaxEntries(n int) ActivityLogOption {
	return func(al *ActivityLog) {
		if n > 0 {
			al.maxSize = n
		}
	}
}

// NewActivityLog creates a new activity log.
func NewActivityLog(opts ...ActivityLogOption) *ActivityLog {
	al := &ActivityLog{
		writer:  os.Stderr,
		maxSize: 10000,
	}
	for _, opt := range opts {
		opt(al)
	}
	return al
}

// Record appends an activity entry to the log.
func (al *ActivityLog) Record(entry ActivityEntry) {
	// Assign deterministic ID and timestamp if not set
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now().UTC()
	}
	entry.ID = deterministicID(entry.Timestamp, entry.Type, entry.RunID, entry.TaskID, entry.AgentID)

	al.mu.Lock()
	defer al.mu.Unlock()

	// Ring buffer eviction
	if len(al.entries) >= al.maxSize {
		al.entries = al.entries[1:]
	}
	al.entries = append(al.entries, entry)

	// Write JSON line to output
	data, err := json.Marshal(entry)
	if err == nil {
		fmt.Fprintln(al.writer, string(data))
	}
}

// Entries returns a copy of all entries in the log.
func (al *ActivityLog) Entries() []ActivityEntry {
	al.mu.Lock()
	defer al.mu.Unlock()
	out := make([]ActivityEntry, len(al.entries))
	copy(out, al.entries)
	return out
}

// EntriesForRun returns entries filtered by RunID.
func (al *ActivityLog) EntriesForRun(runID RunID) []ActivityEntry {
	al.mu.Lock()
	defer al.mu.Unlock()
	var out []ActivityEntry
	for _, e := range al.entries {
		if e.RunID == runID {
			out = append(out, e)
		}
	}
	return out
}

// EntriesForTask returns entries filtered by TaskID.
func (al *ActivityLog) EntriesForTask(taskID TaskID) []ActivityEntry {
	al.mu.Lock()
	defer al.mu.Unlock()
	var out []ActivityEntry
	for _, e := range al.entries {
		if e.TaskID == taskID {
			out = append(out, e)
		}
	}
	return out
}

// Len returns the number of entries in the log.
func (al *ActivityLog) Len() int {
	al.mu.Lock()
	defer al.mu.Unlock()
	return len(al.entries)
}
