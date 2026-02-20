package mesh

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// CorrelationID uniquely identifies a cross-node execution chain.
type CorrelationID string

// GenerateCorrelationID creates a new random correlation ID.
// Format: "cid-<32 hex chars>" (128 bits of entropy).
func GenerateCorrelationID() CorrelationID {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based if crypto/rand fails
		return CorrelationID(fmt.Sprintf("cid-%d", time.Now().UnixNano()))
	}
	return CorrelationID("cid-" + hex.EncodeToString(b))
}

// String returns the string representation.
func (c CorrelationID) String() string {
	return string(c)
}

// IsValid checks if the correlation ID is non-empty and has the correct prefix.
func (c CorrelationID) IsValid() bool {
	return len(c) > 4 && c[:4] == "cid-"
}

// correlationContextKey is the context key for correlation IDs.
type correlationContextKey struct{}

// ContextWithCorrelation adds a correlation ID to a context.
func ContextWithCorrelation(ctx context.Context, cid CorrelationID) context.Context {
	return context.WithValue(ctx, correlationContextKey{}, cid)
}

// CorrelationFromContext extracts a correlation ID from a context.
// Returns empty string if not present.
func CorrelationFromContext(ctx context.Context) CorrelationID {
	if cid, ok := ctx.Value(correlationContextKey{}).(CorrelationID); ok {
		return cid
	}
	return ""
}

// MeshLogEntry is a structured log entry with cross-node tracing fields.
type MeshLogEntry struct {
	// Timestamp is when the event occurred
	Timestamp time.Time `json:"ts"`
	// Level is the log severity
	Level string `json:"level"`
	// CorrelationID links entries across nodes
	CorrelationID CorrelationID `json:"correlation_id"`
	// NodeID is the node that produced this entry
	NodeID string `json:"node_id"`
	// ParentNodeID is the node that initiated the chain (if applicable)
	ParentNodeID string `json:"parent_node_id,omitempty"`
	// Component identifies the subsystem
	Component string `json:"component"`
	// Event is a machine-readable event name
	Event string `json:"event"`
	// Message is a human-readable description
	Message string `json:"message"`
	// TaskID links to a specific task (if applicable)
	TaskID string `json:"task_id,omitempty"`
	// HopIndex is this node's position in the routing chain
	HopIndex int `json:"hop_index,omitempty"`
	// DurationMs is the operation duration in milliseconds
	DurationMs int64 `json:"duration_ms,omitempty"`
	// Fields holds arbitrary structured data
	Fields map[string]string `json:"fields,omitempty"`
	// Error holds an error message if applicable
	Error string `json:"error,omitempty"`
}

// MeshLogger provides cross-node correlated logging for the mesh layer.
// It attaches correlation IDs to all log entries and maintains an execution
// lineage graph that can be traversed for debugging.
type MeshLogger struct {
	mu     sync.RWMutex
	nodeID string

	// Execution lineage: correlation_id -> ordered list of entries
	lineage map[CorrelationID][]MeshLogEntry

	// Sink for emitting entries
	sink func(MeshLogEntry)

	// Max entries per correlation ID before pruning
	maxEntriesPerChain int
}

// NewMeshLogger creates a mesh logger for the given node.
func NewMeshLogger(nodeID string) *MeshLogger {
	return &MeshLogger{
		nodeID:             nodeID,
		lineage:            make(map[CorrelationID][]MeshLogEntry),
		maxEntriesPerChain: 1000,
	}
}

// WithSink sets the log sink callback for external consumption.
func (ml *MeshLogger) WithSink(sink func(MeshLogEntry)) *MeshLogger {
	ml.sink = sink
	return ml
}

// WithMaxEntries sets the max entries per correlation chain.
func (ml *MeshLogger) WithMaxEntries(n int) *MeshLogger {
	if n > 0 {
		ml.maxEntriesPerChain = n
	}
	return ml
}

// Log records a mesh log entry and appends it to the execution lineage.
func (ml *MeshLogger) Log(entry MeshLogEntry) {
	// Ensure required fields
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now().UTC()
	}
	if entry.NodeID == "" {
		entry.NodeID = ml.nodeID
	}
	if !entry.CorrelationID.IsValid() {
		entry.CorrelationID = GenerateCorrelationID()
	}

	// Append to lineage
	ml.mu.Lock()
	chain := ml.lineage[entry.CorrelationID]
	if len(chain) < ml.maxEntriesPerChain {
		ml.lineage[entry.CorrelationID] = append(chain, entry)
	}
	ml.mu.Unlock()

	// Emit to sink
	if ml.sink != nil {
		ml.sink(entry)
	}
}

// LogEvent is a convenience method for logging a simple event.
func (ml *MeshLogger) LogEvent(cid CorrelationID, level, component, event, message string) {
	ml.Log(MeshLogEntry{
		CorrelationID: cid,
		Level:         level,
		Component:     component,
		Event:         event,
		Message:       message,
	})
}

// LogTaskEvent logs an event associated with a specific task.
func (ml *MeshLogger) LogTaskEvent(cid CorrelationID, taskID, event, message string, err error) {
	entry := MeshLogEntry{
		CorrelationID: cid,
		Level:         "info",
		Component:     "mesh.router",
		Event:         event,
		Message:       message,
		TaskID:        taskID,
	}
	if err != nil {
		entry.Level = "error"
		entry.Error = err.Error()
	}
	ml.Log(entry)
}

// GetLineage returns the full execution lineage for a correlation ID.
func (ml *MeshLogger) GetLineage(cid CorrelationID) []MeshLogEntry {
	ml.mu.RLock()
	defer ml.mu.RUnlock()

	chain, ok := ml.lineage[cid]
	if !ok {
		return nil
	}

	// Return a copy
	result := make([]MeshLogEntry, len(chain))
	copy(result, chain)
	return result
}

// GetLineageForTask returns entries matching a specific task ID.
func (ml *MeshLogger) GetLineageForTask(taskID string) []MeshLogEntry {
	ml.mu.RLock()
	defer ml.mu.RUnlock()

	var result []MeshLogEntry
	for _, chain := range ml.lineage {
		for _, entry := range chain {
			if entry.TaskID == taskID {
				result = append(result, entry)
			}
		}
	}
	return result
}

// ActiveCorrelations returns the number of active correlation chains.
func (ml *MeshLogger) ActiveCorrelations() int {
	ml.mu.RLock()
	defer ml.mu.RUnlock()
	return len(ml.lineage)
}

// Prune removes lineage entries older than the given duration.
func (ml *MeshLogger) Prune(maxAge time.Duration) int {
	ml.mu.Lock()
	defer ml.mu.Unlock()

	cutoff := time.Now().UTC().Add(-maxAge)
	pruned := 0

	for cid, chain := range ml.lineage {
		if len(chain) == 0 {
			delete(ml.lineage, cid)
			pruned++
			continue
		}
		// Check if the last entry is older than cutoff
		if chain[len(chain)-1].Timestamp.Before(cutoff) {
			delete(ml.lineage, cid)
			pruned++
		}
	}

	return pruned
}

// Stats returns mesh logger statistics.
func (ml *MeshLogger) Stats() MeshLogStats {
	ml.mu.RLock()
	defer ml.mu.RUnlock()

	totalEntries := 0
	for _, chain := range ml.lineage {
		totalEntries += len(chain)
	}

	return MeshLogStats{
		ActiveChains: len(ml.lineage),
		TotalEntries: totalEntries,
	}
}

// MeshLogStats holds mesh logger metrics.
type MeshLogStats struct {
	ActiveChains int `json:"active_chains"`
	TotalEntries int `json:"total_entries"`
}
