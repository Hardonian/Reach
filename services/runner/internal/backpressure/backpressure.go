// Package backpressure provides rate limiting, circuit breakers, and flow control.
package backpressure

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/errors"
)

// FlowController provides unified flow control with backpressure, circuit breaking, and rate limiting.
type FlowController struct {
	semaphore     *Semaphore
	circuitBreaker *CircuitBreaker
	rateLimiter   *RateLimiter
	
	// Metrics
	requestsTotal   atomic.Uint64
	requestsAllowed atomic.Uint64
	requestsDenied  atomic.Uint64
	
	// Configuration
	name string
}

// FlowControllerOptions configures the flow controller.
type FlowControllerOptions struct {
	Name              string
	MaxConcurrency    int
	CircuitThreshold  int
	CircuitTimeout    time.Duration
	RateLimitPerSec   float64
	RateLimitBurst    int
}

// DefaultFlowControllerOptions returns sensible defaults.
func DefaultFlowControllerOptions() FlowControllerOptions {
	return FlowControllerOptions{
		Name:             "default",
		MaxConcurrency:   100,
		CircuitThreshold: 5,
		CircuitTimeout:   30 * time.Second,
		RateLimitPerSec:  100,
		RateLimitBurst:   10,
	}
}

// NewFlowController creates a unified flow controller.
func NewFlowController(opts FlowControllerOptions) *FlowController {
	if opts.Name == "" {
		opts.Name = "default"
	}
	if opts.MaxConcurrency <= 0 {
		opts.MaxConcurrency = 100
	}
	if opts.CircuitThreshold <= 0 {
		opts.CircuitThreshold = 5
	}
	if opts.CircuitTimeout <= 0 {
		opts.CircuitTimeout = 30 * time.Second
	}
	if opts.RateLimitPerSec <= 0 {
		opts.RateLimitPerSec = 100
	}
	if opts.RateLimitBurst <= 0 {
		opts.RateLimitBurst = 10
	}

	return &FlowController{
		semaphore:      NewSemaphore(opts.MaxConcurrency),
		circuitBreaker: NewCircuitBreaker(CircuitBreakerOptions{
			Threshold:   opts.CircuitThreshold,
			Timeout:     opts.CircuitTimeout,
			HalfOpenMax: 1,
		}),
		rateLimiter: NewRateLimiter(opts.RateLimitPerSec, opts.RateLimitBurst),
		name:        opts.Name,
	}
}

// Allow checks if a request should be allowed through all controls.
func (fc *FlowController) Allow(ctx context.Context) error {
	fc.requestsTotal.Add(1)

	// Check circuit breaker first (fastest)
	if err := fc.circuitBreaker.Allow(); err != nil {
		fc.requestsDenied.Add(1)
		return errors.Wrap(err, errors.CodeFederationCircuitOpen, "circuit breaker open")
	}

	// Check rate limiter
	if err := fc.rateLimiter.Wait(ctx); err != nil {
		fc.circuitBreaker.RecordFailure()
		fc.requestsDenied.Add(1)
		return errors.Wrap(err, errors.CodeRateLimitExceeded, "rate limit exceeded")
	}

	// Acquire semaphore
	if err := fc.semaphore.Acquire(ctx); err != nil {
		fc.circuitBreaker.RecordFailure()
		fc.requestsDenied.Add(1)
		return errors.Wrap(err, errors.CodeResourceExhausted, "concurrency limit reached")
	}

	fc.requestsAllowed.Add(1)
	return nil
}

// Release releases resources after request completion.
func (fc *FlowController) Release() {
	fc.semaphore.Release()
}

// RecordSuccess records a successful request.
func (fc *FlowController) RecordSuccess() {
	fc.circuitBreaker.RecordSuccess()
}

// RecordFailure records a failed request.
func (fc *FlowController) RecordFailure() {
	fc.circuitBreaker.RecordFailure()
}

// Stats returns flow controller statistics.
func (fc *FlowController) Stats() FlowStats {
	cbStats := fc.circuitBreaker.Stats()
	return FlowStats{
		Name:            fc.name,
		RequestsTotal:   fc.requestsTotal.Load(),
		RequestsAllowed: fc.requestsAllowed.Load(),
		RequestsDenied:  fc.requestsDenied.Load(),
		CircuitState:    cbStats.State.String(),
		CircuitFailures: cbStats.Failures,
		AvailableSlots:  fc.semaphore.Available(),
		MaxConcurrency:  fc.semaphore.Max(),
	}
}

// FlowStats contains flow controller statistics.
type FlowStats struct {
	Name            string `json:"name"`
	RequestsTotal   uint64 `json:"requests_total"`
	RequestsAllowed uint64 `json:"requests_allowed"`
	RequestsDenied  uint64 `json:"requests_denied"`
	CircuitState    string `json:"circuit_state"`
	CircuitFailures int    `json:"circuit_failures"`
	AvailableSlots  int    `json:"available_slots"`
	MaxConcurrency  int    `json:"max_concurrency"`
}

// Stop stops the flow controller and its rate limiter.
func (fc *FlowController) Stop() {
	fc.rateLimiter.Stop()
}

// FlowControllerManager manages multiple named flow controllers.
type FlowControllerManager struct {
	controllers map[string]*FlowController
	mu          sync.RWMutex
}

// NewFlowControllerManager creates a new manager.
func NewFlowControllerManager() *FlowControllerManager {
	return &FlowControllerManager{
		controllers: make(map[string]*FlowController),
	}
}

// GetOrCreate gets or creates a flow controller.
func (m *FlowControllerManager) GetOrCreate(name string, opts FlowControllerOptions) *FlowController {
	m.mu.RLock()
	if fc, ok := m.controllers[name]; ok {
		m.mu.RUnlock()
		return fc
	}
	m.mu.RUnlock()

	m.mu.Lock()
	defer m.mu.Unlock()

	if fc, ok := m.controllers[name]; ok {
		return fc
	}

	opts.Name = name
	fc := NewFlowController(opts)
	m.controllers[name] = fc
	return fc
}

// Get gets an existing flow controller.
func (m *FlowControllerManager) Get(name string) (*FlowController, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	fc, ok := m.controllers[name]
	return fc, ok
}

// Remove removes a flow controller.
func (m *FlowControllerManager) Remove(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if fc, ok := m.controllers[name]; ok {
		fc.Stop()
		delete(m.controllers, name)
	}
}

// AllStats returns stats for all controllers.
func (m *FlowControllerManager) AllStats() map[string]FlowStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := make(map[string]FlowStats, len(m.controllers))
	for name, fc := range m.controllers {
		stats[name] = fc.Stats()
	}
	return stats
}

// AdaptiveBackpressure provides dynamic load shedding based on system health.
type AdaptiveBackpressure struct {
	controller      *FlowController
	healthChecker   HealthChecker
	loadThreshold   float64
	lastAdjustment  time.Time
	adjustmentMu    sync.Mutex
}

// HealthChecker interface for system health checks.
type HealthChecker interface {
	GetLoad() float64
	IsHealthy() bool
}

// NewAdaptiveBackpressure creates adaptive backpressure controller.
func NewAdaptiveBackpressure(controller *FlowController, checker HealthChecker) *AdaptiveBackpressure {
	return &AdaptiveBackpressure{
		controller:     controller,
		healthChecker:  checker,
		loadThreshold:  0.8,
		lastAdjustment: time.Now(),
	}
}

// Allow checks if request should proceed based on adaptive thresholds.
func (ab *AdaptiveBackpressure) Allow(ctx context.Context) error {
	// Check base controls
	if err := ab.controller.Allow(ctx); err != nil {
		return err
	}

	// Additional health-based checks
	if ab.healthChecker != nil && !ab.healthChecker.IsHealthy() {
		ab.controller.Release()
		return errors.New(errors.CodeResourceExhausted, "system unhealthy")
	}

	return nil
}

// Release releases resources.
func (ab *AdaptiveBackpressure) Release() {
	ab.controller.Release()
}

// RecordOutcome records request outcome and potentially adjusts thresholds.
func (ab *AdaptiveBackpressure) RecordOutcome(success bool) {
	if success {
		ab.controller.RecordSuccess()
	} else {
		ab.controller.RecordFailure()
	}

	// Periodic adjustment
	ab.adjustmentMu.Lock()
	if time.Since(ab.lastAdjustment) > 10*time.Second {
		ab.adjustThresholds()
		ab.lastAdjustment = time.Now()
	}
	ab.adjustmentMu.Unlock()
}

func (ab *AdaptiveBackpressure) adjustThresholds() {
	if ab.healthChecker == nil {
		return
	}

	load := ab.healthChecker.GetLoad()
	if load > ab.loadThreshold {
		// System under stress - tighten controls
		// This would dynamically adjust rate limits in a real implementation
		fmt.Printf("[AdaptiveBackpressure] High load detected: %.2f\n", load)
	}
}

// Priority levels for request classification.
type Priority int

const (
	PriorityLow Priority = iota
	PriorityNormal
	PriorityHigh
	PriorityCritical
)

// PriorityFlowController provides priority-based flow control.
type PriorityFlowController struct {
	controllers map[Priority]*FlowController
	mu          sync.RWMutex
}

// NewPriorityFlowController creates a priority-aware flow controller.
func NewPriorityFlowController() *PriorityFlowController {
	pfc := &PriorityFlowController{
		controllers: make(map[Priority]*FlowController),
	}

	// Create controllers for each priority level
	pfc.controllers[PriorityCritical] = NewFlowController(FlowControllerOptions{
		Name:           "critical",
		MaxConcurrency: 50,
		RateLimitPerSec: 1000, // High limit
	})
	pfc.controllers[PriorityHigh] = NewFlowController(FlowControllerOptions{
		Name:           "high",
		MaxConcurrency: 75,
		RateLimitPerSec: 500,
	})
	pfc.controllers[PriorityNormal] = NewFlowController(FlowControllerOptions{
		Name:           "normal",
		MaxConcurrency: 100,
		RateLimitPerSec: 200,
	})
	pfc.controllers[PriorityLow] = NewFlowController(FlowControllerOptions{
		Name:           "low",
		MaxConcurrency: 25,
		RateLimitPerSec: 50,
	})

	return pfc
}

// Allow checks if a request with given priority should proceed.
func (pfc *PriorityFlowController) Allow(ctx context.Context, priority Priority) error {
	pfc.mu.RLock()
	controller, ok := pfc.controllers[priority]
	pfc.mu.RUnlock()

	if !ok {
		controller = pfc.controllers[PriorityNormal]
	}

	return controller.Allow(ctx)
}

// Release releases resources for a priority level.
func (pfc *PriorityFlowController) Release(priority Priority) {
	pfc.mu.RLock()
	controller, ok := pfc.controllers[priority]
	pfc.mu.RUnlock()

	if !ok {
		controller = pfc.controllers[PriorityNormal]
	}

	controller.Release()
}

// RecordOutcome records outcome for a priority level.
func (pfc *PriorityFlowController) RecordOutcome(priority Priority, success bool) {
	pfc.mu.RLock()
	controller, ok := pfc.controllers[priority]
	pfc.mu.RUnlock()

	if !ok {
		controller = pfc.controllers[PriorityNormal]
	}

	if success {
		controller.RecordSuccess()
	} else {
		controller.RecordFailure()
	}
}

// AllStats returns stats for all priority levels.
func (pfc *PriorityFlowController) AllStats() map[string]FlowStats {
	pfc.mu.RLock()
	defer pfc.mu.RUnlock()

	stats := make(map[string]FlowStats)
	for _, controller := range pfc.controllers {
		s := controller.Stats()
		stats[s.Name] = s
	}
	return stats
}

// Stop stops all priority controllers.
func (pfc *PriorityFlowController) Stop() {
	pfc.mu.Lock()
	defer pfc.mu.Unlock()

	for _, controller := range pfc.controllers {
		controller.Stop()
	}
}
