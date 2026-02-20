package packloader

import (
	"fmt"
	"sync"
	"time"
)

// PackStatus tracks the health state of a loaded pack.
type PackStatus string

const (
	PackStatusActive   PackStatus = "active"
	PackStatusDisabled PackStatus = "disabled"
	PackStatusFailed   PackStatus = "failed"
	PackStatusDegraded PackStatus = "degraded"
)

// PackHealth records the runtime health of a pack.
type PackHealth struct {
	PackID        string     `json:"pack_id"`
	Status        PackStatus `json:"status"`
	FailureCount  int        `json:"failure_count"`
	LastFailure   *time.Time `json:"last_failure,omitempty"`
	LastError     string     `json:"last_error,omitempty"`
	DisabledAt    *time.Time `json:"disabled_at,omitempty"`
	DisableReason string     `json:"disable_reason,omitempty"`
}

// ContainmentPolicy defines when a pack should be disabled.
type ContainmentPolicy struct {
	// MaxFailures before the pack is automatically disabled.
	MaxFailures int `json:"max_failures"`

	// FailureWindow is the time window for counting failures.
	FailureWindow time.Duration `json:"failure_window"`

	// AutoRecover controls whether disabled packs can be re-enabled after cooldown.
	AutoRecover bool `json:"auto_recover"`

	// RecoverAfter is how long before a disabled pack can be re-enabled.
	RecoverAfter time.Duration `json:"recover_after"`
}

// DefaultContainmentPolicy returns a sensible default policy.
func DefaultContainmentPolicy() ContainmentPolicy {
	return ContainmentPolicy{
		MaxFailures:   5,
		FailureWindow: 5 * time.Minute,
		AutoRecover:   true,
		RecoverAfter:  10 * time.Minute,
	}
}

// FailureContainment monitors pack health and automatically disables packs
// that exceed failure thresholds to prevent platform-wide crashes.
type FailureContainment struct {
	mu       sync.RWMutex
	health   map[string]*PackHealth
	failures map[string][]time.Time // pack ID -> failure timestamps
	policy   ContainmentPolicy
	onDisable func(packID string, reason string)
}

// NewFailureContainment creates a new containment system with the given policy.
func NewFailureContainment(policy ContainmentPolicy) *FailureContainment {
	return &FailureContainment{
		health:   make(map[string]*PackHealth),
		failures: make(map[string][]time.Time),
		policy:   policy,
	}
}

// OnDisable registers a callback for when a pack gets disabled.
func (fc *FailureContainment) OnDisable(fn func(packID string, reason string)) {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	fc.onDisable = fn
}

// Register initializes health tracking for a pack.
func (fc *FailureContainment) Register(packID string) {
	fc.mu.Lock()
	defer fc.mu.Unlock()

	fc.health[packID] = &PackHealth{
		PackID: packID,
		Status: PackStatusActive,
	}
	fc.failures[packID] = nil
}

// RecordSuccess records a successful pack operation.
func (fc *FailureContainment) RecordSuccess(packID string) {
	fc.mu.Lock()
	defer fc.mu.Unlock()

	h, ok := fc.health[packID]
	if !ok {
		return
	}

	// If degraded, return to active on success
	if h.Status == PackStatusDegraded {
		h.Status = PackStatusActive
	}
}

// RecordFailure records a pack failure and checks whether the pack
// should be disabled.
func (fc *FailureContainment) RecordFailure(packID string, err error) PackStatus {
	fc.mu.Lock()
	defer fc.mu.Unlock()

	h, ok := fc.health[packID]
	if !ok {
		return PackStatusActive
	}

	now := time.Now()
	h.FailureCount++
	h.LastFailure = &now
	h.LastError = err.Error()

	// Record failure timestamp
	fc.failures[packID] = append(fc.failures[packID], now)

	// Count failures within the window
	windowStart := now.Add(-fc.policy.FailureWindow)
	recentFailures := 0
	for _, t := range fc.failures[packID] {
		if t.After(windowStart) {
			recentFailures++
		}
	}

	// Prune old failures
	fc.pruneFailures(packID, windowStart)

	if recentFailures >= fc.policy.MaxFailures {
		reason := fmt.Sprintf("exceeded %d failures in %s (last: %s)", fc.policy.MaxFailures, fc.policy.FailureWindow, err.Error())
		h.Status = PackStatusDisabled
		h.DisabledAt = &now
		h.DisableReason = reason

		if fc.onDisable != nil {
			go fc.onDisable(packID, reason)
		}

		return PackStatusDisabled
	}

	if recentFailures > fc.policy.MaxFailures/2 {
		h.Status = PackStatusDegraded
		return PackStatusDegraded
	}

	return h.Status
}

// GetHealth returns the health status of a pack.
func (fc *FailureContainment) GetHealth(packID string) (PackHealth, bool) {
	fc.mu.RLock()
	defer fc.mu.RUnlock()

	h, ok := fc.health[packID]
	if !ok {
		return PackHealth{}, false
	}
	return *h, true
}

// GetAllHealth returns health for all packs.
func (fc *FailureContainment) GetAllHealth() map[string]PackHealth {
	fc.mu.RLock()
	defer fc.mu.RUnlock()

	out := make(map[string]PackHealth, len(fc.health))
	for id, h := range fc.health {
		out[id] = *h
	}
	return out
}

// IsActive returns true if the pack is active or degraded (still usable).
func (fc *FailureContainment) IsActive(packID string) bool {
	fc.mu.RLock()
	defer fc.mu.RUnlock()

	h, ok := fc.health[packID]
	if !ok {
		return false
	}
	return h.Status == PackStatusActive || h.Status == PackStatusDegraded
}

// DisablePack manually disables a pack with a reason.
func (fc *FailureContainment) DisablePack(packID, reason string) {
	fc.mu.Lock()
	defer fc.mu.Unlock()

	h, ok := fc.health[packID]
	if !ok {
		return
	}

	now := time.Now()
	h.Status = PackStatusDisabled
	h.DisabledAt = &now
	h.DisableReason = reason
}

// EnablePack re-enables a disabled pack.
func (fc *FailureContainment) EnablePack(packID string) {
	fc.mu.Lock()
	defer fc.mu.Unlock()

	h, ok := fc.health[packID]
	if !ok {
		return
	}

	h.Status = PackStatusActive
	h.DisabledAt = nil
	h.DisableReason = ""
	h.FailureCount = 0
	fc.failures[packID] = nil
}

// CheckAutoRecover checks for packs that have been disabled long enough
// to be automatically re-enabled.
func (fc *FailureContainment) CheckAutoRecover() []string {
	if !fc.policy.AutoRecover {
		return nil
	}

	fc.mu.Lock()
	defer fc.mu.Unlock()

	var recovered []string
	now := time.Now()

	for id, h := range fc.health {
		if h.Status != PackStatusDisabled || h.DisabledAt == nil {
			continue
		}

		if now.Sub(*h.DisabledAt) >= fc.policy.RecoverAfter {
			h.Status = PackStatusActive
			h.DisabledAt = nil
			h.DisableReason = ""
			h.FailureCount = 0
			fc.failures[id] = nil
			recovered = append(recovered, id)
		}
	}

	return recovered
}

// pruneFailures removes failure timestamps outside the window.
func (fc *FailureContainment) pruneFailures(packID string, cutoff time.Time) {
	failures := fc.failures[packID]
	pruned := make([]time.Time, 0, len(failures))
	for _, t := range failures {
		if t.After(cutoff) {
			pruned = append(pruned, t)
		}
	}
	fc.failures[packID] = pruned
}
