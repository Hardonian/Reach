// Package backpressure provides rate limiting and backpressure mechanisms.
package backpressure

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/errors"
)

// Semaphore provides a counting semaphore for limiting concurrent operations.
type Semaphore struct {
	ch    chan struct{}
	count int32
	max   int
}

// NewSemaphore creates a new semaphore with the given capacity.
// If max <= 0, the semaphore is unlimited (always succeeds).
func NewSemaphore(max int) *Semaphore {
	if max <= 0 {
		return &Semaphore{max: 0}
	}
	return &Semaphore{
		ch:  make(chan struct{}, max),
		max: max,
	}
}

// Acquire acquires a permit, blocking until one is available or context is cancelled.
func (s *Semaphore) Acquire(ctx context.Context) error {
	if s.max <= 0 {
		return nil // Unlimited
	}

	select {
	case s.ch <- struct{}{}:
		atomic.AddInt32(&s.count, 1)
		return nil
	case <-ctx.Done():
		return errors.Classify(ctx.Err())
	}
}

// TryAcquire attempts to acquire a permit without blocking.
func (s *Semaphore) TryAcquire() bool {
	if s.max <= 0 {
		return true // Unlimited
	}

	select {
	case s.ch <- struct{}{}:
		atomic.AddInt32(&s.count, 1)
		return true
	default:
		return false
	}
}

// Release releases a permit.
func (s *Semaphore) Release() {
	if s.max <= 0 {
		return // Unlimited
	}

	select {
	case <-s.ch:
		atomic.AddInt32(&s.count, -1)
	default:
		// Don't panic on release without acquire
	}
}

// Count returns the current number of acquired permits.
func (s *Semaphore) Count() int {
	return int(atomic.LoadInt32(&s.count))
}

// Max returns the maximum number of permits.
func (s *Semaphore) Max() int {
	return s.max
}

// Available returns the number of available permits.
func (s *Semaphore) Available() int {
	if s.max <= 0 {
		return -1 // Unlimited
	}
	return s.max - s.Count()
}

// WaitGroup provides a semaphore-based wait group with timeout.
type WaitGroup struct {
	wg     sync.WaitGroup
	sem    *Semaphore
	ctx    context.Context
	cancel context.CancelFunc
}

// NewWaitGroup creates a new WaitGroup with the given concurrency limit.
func NewWaitGroup(maxConcurrent int) *WaitGroup {
	ctx, cancel := context.WithCancel(context.Background())
	return &WaitGroup{
		sem:    NewSemaphore(maxConcurrent),
		ctx:    ctx,
		cancel: cancel,
	}
}

// Go runs a function in a goroutine, respecting the concurrency limit.
func (wg *WaitGroup) Go(fn func()) error {
	if err := wg.sem.Acquire(wg.ctx); err != nil {
		return err
	}

	wg.wg.Add(1)
	go func() {
		defer wg.wg.Done()
		defer wg.sem.Release()
		fn()
	}()

	return nil
}

// Wait waits for all goroutines to complete.
func (wg *WaitGroup) Wait() {
	wg.wg.Wait()
}

// Stop cancels the context, preventing new goroutines from starting.
func (wg *WaitGroup) Stop() {
	wg.cancel()
}

// RateLimiter provides a token bucket rate limiter.
type RateLimiter struct {
	tokens    chan struct{}
	interval  time.Duration
	burst     int
	stopCh    chan struct{}
	stopOnce  sync.Once
}

// NewRateLimiter creates a new rate limiter.
// rate: tokens per second
// burst: maximum burst size
func NewRateLimiter(rate float64, burst int) *RateLimiter {
	if rate <= 0 || burst <= 0 {
		return &RateLimiter{tokens: make(chan struct{}, 1), interval: time.Second, burst: 1}
	}

	interval := time.Duration(float64(time.Second) / rate)
	rl := &RateLimiter{
		tokens:   make(chan struct{}, burst),
		interval: interval,
		burst:    burst,
		stopCh:   make(chan struct{}),
	}

	// Fill bucket initially
	for i := 0; i < burst; i++ {
		rl.tokens <- struct{}{}
	}

	// Start refill goroutine
	go rl.refill()

	return rl
}

// refill periodically adds tokens to the bucket.
func (rl *RateLimiter) refill() {
	ticker := time.NewTicker(rl.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			select {
			case rl.tokens <- struct{}{}:
			default:
				// Bucket is full
			}
		case <-rl.stopCh:
			return
		}
	}
}

// Wait blocks until a token is available or context is cancelled.
func (rl *RateLimiter) Wait(ctx context.Context) error {
	select {
	case <-rl.tokens:
		return nil
	case <-ctx.Done():
		return errors.Classify(ctx.Err())
	case <-rl.stopCh:
		return errors.New(errors.CodeCancelled, "rate limiter stopped")
	}
}

// TryWait attempts to acquire a token without blocking.
func (rl *RateLimiter) TryWait() bool {
	select {
	case <-rl.tokens:
		return true
	default:
		return false
	}
}

// Stop stops the rate limiter.
func (rl *RateLimiter) Stop() {
	rl.stopOnce.Do(func() {
		close(rl.stopCh)
	})
}
