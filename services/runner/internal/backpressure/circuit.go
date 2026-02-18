package backpressure

import (
	"sync"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/errors"
)

// CircuitState represents the state of a circuit breaker.
type CircuitState int32

const (
	// CircuitClosed allows requests through.
	CircuitClosed CircuitState = iota
	// CircuitOpen blocks all requests.
	CircuitOpen
	// CircuitHalfOpen allows a test request through.
	CircuitHalfOpen
)

func (s CircuitState) String() string {
	switch s {
	case CircuitClosed:
		return "closed"
	case CircuitOpen:
		return "open"
	case CircuitHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreaker provides circuit breaker pattern for fault tolerance.
type CircuitBreaker struct {
	state        int32
	failures     int32
	successes    int32
	lastFailure  int64 // Unix timestamp
	openedAt     time.Time

	threshold    int
	timeout      time.Duration
	halfOpenMax  int

	mu sync.RWMutex
}

// CircuitBreakerOptions configures the circuit breaker.
type CircuitBreakerOptions struct {
	// Threshold is the number of failures before opening the circuit.
	Threshold int
	// Timeout is how long the circuit stays open before trying half-open.
	Timeout time.Duration
	// HalfOpenMax is the number of test requests allowed in half-open state.
	HalfOpenMax int
}

// DefaultCircuitBreakerOptions returns sensible defaults.
func DefaultCircuitBreakerOptions() CircuitBreakerOptions {
	return CircuitBreakerOptions{
		Threshold:   5,
		Timeout:     30 * time.Second,
		HalfOpenMax: 1,
	}
}

// NewCircuitBreaker creates a new circuit breaker.
func NewCircuitBreaker(opts CircuitBreakerOptions) *CircuitBreaker {
	if opts.Threshold <= 0 {
		opts.Threshold = 5
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 30 * time.Second
	}
	if opts.HalfOpenMax <= 0 {
		opts.HalfOpenMax = 1
	}

	return &CircuitBreaker{
		threshold:   opts.Threshold,
		timeout:     opts.Timeout,
		halfOpenMax: opts.HalfOpenMax,
	}
}

// State returns the current circuit state.
func (cb *CircuitBreaker) State() CircuitState {
	return CircuitState(atomic.LoadInt32(&cb.state))
}

// Allow checks if a request should be allowed through.
func (cb *CircuitBreaker) Allow() error {
	state := cb.State()

	switch state {
	case CircuitClosed:
		return nil

	case CircuitOpen:
		// Check if timeout has elapsed
		cb.mu.RLock()
		openedAt := cb.openedAt
		cb.mu.RUnlock()

		if time.Since(openedAt) > cb.timeout {
			// Try to transition to half-open
			if atomic.CompareAndSwapInt32(&cb.state, int32(CircuitOpen), int32(CircuitHalfOpen)) {
				atomic.StoreInt32(&cb.successes, 0)
				atomic.StoreInt32(&cb.failures, 0)
			}
			return nil
		}
		return errors.New(errors.CodeFederationCircuitOpen, "circuit breaker is open").
			WithContext("timeout_remaining", time.Until(openedAt.Add(cb.timeout)).String())

	case CircuitHalfOpen:
		// Allow limited test requests
		if atomic.LoadInt32(&cb.successes)+atomic.LoadInt32(&cb.failures) >= int32(cb.halfOpenMax) {
			return errors.New(errors.CodeFederationCircuitOpen, "circuit breaker is half-open, test in progress")
		}
		return nil

	default:
		return errors.New(errors.CodeInternal, "unknown circuit state")
	}
}

// RecordSuccess records a successful request.
func (cb *CircuitBreaker) RecordSuccess() {
	state := cb.State()

	switch state {
	case CircuitHalfOpen:
		successes := atomic.AddInt32(&cb.successes, 1)
		if successes >= int32(cb.halfOpenMax) {
			// Close the circuit
			cb.close()
		}

	case CircuitClosed:
		// Reset failure count on success
		atomic.StoreInt32(&cb.failures, 0)
	}
}

// RecordFailure records a failed request.
func (cb *CircuitBreaker) RecordFailure() {
	state := cb.State()

	switch state {
	case CircuitHalfOpen:
		failures := atomic.AddInt32(&cb.failures, 1)
		if failures >= int32(cb.halfOpenMax) {
			// Re-open the circuit
			cb.open()
		}

	case CircuitClosed:
		failures := atomic.AddInt32(&cb.failures, 1)
		atomic.StoreInt64(&cb.lastFailure, time.Now().Unix())
		if int(failures) >= cb.threshold {
			cb.open()
		}
	}
}

// open opens the circuit.
func (cb *CircuitBreaker) open() {
	if atomic.CompareAndSwapInt32(&cb.state, int32(CircuitClosed), int32(CircuitOpen)) ||
		atomic.CompareAndSwapInt32(&cb.state, int32(CircuitHalfOpen), int32(CircuitOpen)) {
		cb.mu.Lock()
		cb.openedAt = time.Now()
		cb.mu.Unlock()
		atomic.StoreInt32(&cb.failures, 0)
		atomic.StoreInt32(&cb.successes, 0)
	}
}

// close closes the circuit.
func (cb *CircuitBreaker) close() {
	if atomic.CompareAndSwapInt32(&cb.state, int32(CircuitHalfOpen), int32(CircuitClosed)) {
		atomic.StoreInt32(&cb.failures, 0)
		atomic.StoreInt32(&cb.successes, 0)
	}
}

// ForceOpen forces the circuit open (for testing or manual intervention).
func (cb *CircuitBreaker) ForceOpen() {
	cb.open()
}

// ForceClose forces the circuit closed (for testing or recovery).
func (cb *CircuitBreaker) ForceClose() {
	atomic.StoreInt32(&cb.state, int32(CircuitClosed))
	atomic.StoreInt32(&cb.failures, 0)
	atomic.StoreInt32(&cb.successes, 0)
}

// Stats returns circuit breaker statistics.
func (cb *CircuitBreaker) Stats() CircuitStats {
	cb.mu.RLock()
	openedAt := cb.openedAt
	cb.mu.RUnlock()

	return CircuitStats{
		State:       cb.State(),
		Failures:    int(atomic.LoadInt32(&cb.failures)),
		Successes:   int(atomic.LoadInt32(&cb.successes)),
		Threshold:   cb.threshold,
		OpenedAt:    openedAt,
		Timeout:     cb.timeout,
	}
}

// CircuitStats contains circuit breaker statistics.
type CircuitStats struct {
	State     CircuitState  `json:"state"`
	Failures  int           `json:"failures"`
	Successes int           `json:"successes"`
	Threshold int           `json:"threshold"`
	OpenedAt  time.Time     `json:"opened_at,omitempty"`
	Timeout   time.Duration `json:"timeout"`
}

// CircuitBreakerGroup manages circuit breakers for multiple targets.
type CircuitBreakerGroup struct {
	breakers map[string]*CircuitBreaker
	opts     CircuitBreakerOptions
	mu       sync.RWMutex
}

// NewCircuitBreakerGroup creates a new circuit breaker group.
func NewCircuitBreakerGroup(opts CircuitBreakerOptions) *CircuitBreakerGroup {
	return &CircuitBreakerGroup{
		breakers: make(map[string]*CircuitBreaker),
		opts:     opts,
	}
}

// Get gets or creates a circuit breaker for a target.
func (g *CircuitBreakerGroup) Get(target string) *CircuitBreaker {
	g.mu.RLock()
	cb, ok := g.breakers[target]
	g.mu.RUnlock()

	if ok {
		return cb
	}

	g.mu.Lock()
	defer g.mu.Unlock()

	// Double-check
	if cb, ok := g.breakers[target]; ok {
		return cb
	}

	cb = NewCircuitBreaker(g.opts)
	g.breakers[target] = cb
	return cb
}

// Remove removes a circuit breaker.
func (g *CircuitBreakerGroup) Remove(target string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	delete(g.breakers, target)
}

// Stats returns stats for all circuit breakers.
func (g *CircuitBreakerGroup) Stats() map[string]CircuitStats {
	g.mu.RLock()
	defer g.mu.RUnlock()

	stats := make(map[string]CircuitStats, len(g.breakers))
	for target, cb := range g.breakers {
		stats[target] = cb.Stats()
	}
	return stats
}
