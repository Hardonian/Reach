package mesh

import (
	"fmt"
	"sync"
	"time"
)

// MeshRateLimitConfig configures per-node rate limiting for the mesh layer.
type MeshRateLimitConfig struct {
	// RequestsPerMinutePerNode is the max inbound requests from any single node per minute
	RequestsPerMinutePerNode int `json:"requests_per_minute_per_node"`
	// GlobalRequestsPerMinute is the total inbound mesh request budget across all nodes
	GlobalRequestsPerMinute int `json:"global_requests_per_minute"`
	// MaxConcurrentTasks limits how many tasks can execute simultaneously
	MaxConcurrentTasks int `json:"max_concurrent_tasks"`
	// LoopCascadeWindow is the time window for detecting cascade loops
	LoopCascadeWindow time.Duration `json:"loop_cascade_window"`
	// LoopCascadeThreshold is the number of requests from the same origin in the window
	// that triggers cascade protection
	LoopCascadeThreshold int `json:"loop_cascade_threshold"`
	// CooldownDuration is how long a node is throttled after triggering cascade protection
	CooldownDuration time.Duration `json:"cooldown_duration"`
}

// DefaultMeshRateLimitConfig returns safe defaults.
func DefaultMeshRateLimitConfig() MeshRateLimitConfig {
	return MeshRateLimitConfig{
		RequestsPerMinutePerNode: 60,
		GlobalRequestsPerMinute:  300,
		MaxConcurrentTasks:       10,
		LoopCascadeWindow:        30 * time.Second,
		LoopCascadeThreshold:     15,
		CooldownDuration:         60 * time.Second,
	}
}

// nodeWindow tracks request timestamps for a single node.
type nodeWindow struct {
	// timestamps tracks request times in the current window
	timestamps []time.Time
	// cooldownUntil is set when cascade protection triggers
	cooldownUntil time.Time
}

// MeshRateLimiter enforces per-node and global rate limits for mesh operations.
// It also detects and mitigates loop cascade attacks where a chain of nodes
// keep forwarding tasks back and forth.
type MeshRateLimiter struct {
	mu     sync.Mutex
	config MeshRateLimitConfig

	// Per-node tracking
	nodes map[string]*nodeWindow

	// Global tracking
	globalTimestamps []time.Time

	// Concurrent task count
	activeTasks int

	// Audit callback
	audit func(event string, nodeID string, detail string)
}

// NewMeshRateLimiter creates a mesh rate limiter.
func NewMeshRateLimiter(config MeshRateLimitConfig) *MeshRateLimiter {
	if config.RequestsPerMinutePerNode <= 0 {
		config.RequestsPerMinutePerNode = 60
	}
	if config.GlobalRequestsPerMinute <= 0 {
		config.GlobalRequestsPerMinute = 300
	}
	if config.MaxConcurrentTasks <= 0 {
		config.MaxConcurrentTasks = 10
	}
	if config.LoopCascadeWindow <= 0 {
		config.LoopCascadeWindow = 30 * time.Second
	}
	if config.LoopCascadeThreshold <= 0 {
		config.LoopCascadeThreshold = 15
	}
	if config.CooldownDuration <= 0 {
		config.CooldownDuration = 60 * time.Second
	}

	return &MeshRateLimiter{
		config:           config,
		nodes:            make(map[string]*nodeWindow),
		globalTimestamps: make([]time.Time, 0, config.GlobalRequestsPerMinute),
	}
}

// WithAuditSink sets the audit callback.
func (rl *MeshRateLimiter) WithAuditSink(fn func(event string, nodeID string, detail string)) *MeshRateLimiter {
	rl.audit = fn
	return rl
}

// Allow checks if a request from the given node should be permitted.
// Returns nil if allowed, an error describing the rejection reason otherwise.
func (rl *MeshRateLimiter) Allow(nodeID string) error {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now().UTC()

	// 1. Check if node is in cooldown (cascade protection)
	window := rl.getOrCreateWindow(nodeID)
	if now.Before(window.cooldownUntil) {
		err := fmt.Errorf("node %s in cooldown until %s (cascade protection)", nodeID, window.cooldownUntil.Format(time.RFC3339))
		rl.emit("ratelimit.cooldown", nodeID, err.Error())
		return err
	}

	// 2. Check per-node rate limit
	window.timestamps = pruneOld(window.timestamps, now, time.Minute)
	if len(window.timestamps) >= rl.config.RequestsPerMinutePerNode {
		err := fmt.Errorf("node %s exceeded per-node rate limit (%d/min)", nodeID, rl.config.RequestsPerMinutePerNode)
		rl.emit("ratelimit.per_node", nodeID, err.Error())
		return err
	}

	// 3. Check global rate limit
	rl.globalTimestamps = pruneOld(rl.globalTimestamps, now, time.Minute)
	if len(rl.globalTimestamps) >= rl.config.GlobalRequestsPerMinute {
		err := fmt.Errorf("global mesh rate limit exceeded (%d/min)", rl.config.GlobalRequestsPerMinute)
		rl.emit("ratelimit.global", nodeID, err.Error())
		return err
	}

	// 4. Check concurrent task limit
	if rl.activeTasks >= rl.config.MaxConcurrentTasks {
		err := fmt.Errorf("max concurrent tasks reached (%d)", rl.config.MaxConcurrentTasks)
		rl.emit("ratelimit.concurrent", nodeID, err.Error())
		return err
	}

	// 5. Cascade loop detection: check burst rate within the cascade window
	cascadeWindow := pruneOld(window.timestamps, now, rl.config.LoopCascadeWindow)
	if len(cascadeWindow) >= rl.config.LoopCascadeThreshold {
		window.cooldownUntil = now.Add(rl.config.CooldownDuration)
		err := fmt.Errorf("cascade loop detected from node %s (%d requests in %s), cooldown engaged",
			nodeID, len(cascadeWindow), rl.config.LoopCascadeWindow)
		rl.emit("ratelimit.cascade", nodeID, err.Error())
		return err
	}

	// Record this request
	window.timestamps = append(window.timestamps, now)
	rl.globalTimestamps = append(rl.globalTimestamps, now)

	return nil
}

// AcquireTask increments the active task counter. Returns error if at capacity.
func (rl *MeshRateLimiter) AcquireTask() error {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if rl.activeTasks >= rl.config.MaxConcurrentTasks {
		return fmt.Errorf("max concurrent tasks reached (%d)", rl.config.MaxConcurrentTasks)
	}
	rl.activeTasks++
	return nil
}

// ReleaseTask decrements the active task counter.
func (rl *MeshRateLimiter) ReleaseTask() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	if rl.activeTasks > 0 {
		rl.activeTasks--
	}
}

// ActiveTasks returns the current number of active tasks.
func (rl *MeshRateLimiter) ActiveTasks() int {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	return rl.activeTasks
}

// IsNodeCoolingDown checks if a node is under cascade cooldown.
func (rl *MeshRateLimiter) IsNodeCoolingDown(nodeID string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	window, ok := rl.nodes[nodeID]
	if !ok {
		return false
	}
	return time.Now().UTC().Before(window.cooldownUntil)
}

// Stats returns current rate limiter statistics.
func (rl *MeshRateLimiter) Stats() MeshRateLimitStats {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now().UTC()
	coolingDown := 0
	for _, w := range rl.nodes {
		if now.Before(w.cooldownUntil) {
			coolingDown++
		}
	}

	return MeshRateLimitStats{
		TrackedNodes:    len(rl.nodes),
		ActiveTasks:     rl.activeTasks,
		GlobalRequests:  len(pruneOld(rl.globalTimestamps, now, time.Minute)),
		NodesCoolingDown: coolingDown,
	}
}

// MeshRateLimitStats holds rate limiter metrics.
type MeshRateLimitStats struct {
	TrackedNodes     int `json:"tracked_nodes"`
	ActiveTasks      int `json:"active_tasks"`
	GlobalRequests   int `json:"global_requests_last_minute"`
	NodesCoolingDown int `json:"nodes_cooling_down"`
}

func (rl *MeshRateLimiter) getOrCreateWindow(nodeID string) *nodeWindow {
	w, ok := rl.nodes[nodeID]
	if !ok {
		w = &nodeWindow{
			timestamps: make([]time.Time, 0, rl.config.RequestsPerMinutePerNode),
		}
		rl.nodes[nodeID] = w
	}
	return w
}

// pruneOld removes timestamps older than the given duration from the window.
func pruneOld(timestamps []time.Time, now time.Time, window time.Duration) []time.Time {
	cutoff := now.Add(-window)
	i := 0
	for i < len(timestamps) && timestamps[i].Before(cutoff) {
		i++
	}
	if i > 0 {
		return timestamps[i:]
	}
	return timestamps
}

func (rl *MeshRateLimiter) emit(event, nodeID, detail string) {
	if rl.audit != nil {
		rl.audit(event, nodeID, detail)
	}
}
