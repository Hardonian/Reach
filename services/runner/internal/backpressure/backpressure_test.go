package backpressure

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestSemaphore(t *testing.T) {
	s := NewSemaphore(2)

	if s.Max() != 2 {
		t.Errorf("expected max=2, got: %d", s.Max())
	}

	// Acquire two permits
	ctx := context.Background()
	if err := s.Acquire(ctx); err != nil {
		t.Fatalf("first acquire failed: %v", err)
	}
	if err := s.Acquire(ctx); err != nil {
		t.Fatalf("second acquire failed: %v", err)
	}

	if s.Count() != 2 {
		t.Errorf("expected count=2, got: %d", s.Count())
	}

	// Third acquire should block (test with TryAcquire)
	if s.TryAcquire() {
		t.Error("third acquire should fail")
	}

	// Release one
	s.Release()
	if s.Count() != 1 {
		t.Errorf("expected count=1 after release, got: %d", s.Count())
	}

	// Now TryAcquire should succeed
	if !s.TryAcquire() {
		t.Error("acquire should succeed after release")
	}
}

func TestSemaphoreUnlimited(t *testing.T) {
	s := NewSemaphore(0)

	if s.Max() != 0 {
		t.Errorf("expected max=0, got: %d", s.Max())
	}

	ctx := context.Background()
	// Should always succeed
	for i := 0; i < 100; i++ {
		if err := s.Acquire(ctx); err != nil {
			t.Fatalf("unlimited acquire failed: %v", err)
		}
	}
}

func TestSemaphoreContextCancellation(t *testing.T) {
	s := NewSemaphore(1)

	ctx, cancel := context.WithCancel(context.Background())
	if err := s.Acquire(ctx); err != nil {
		t.Fatalf("acquire failed: %v", err)
	}

	// Cancel context
	cancel()

	// Next acquire should fail with context error
	if err := s.Acquire(ctx); err == nil {
		t.Error("expected error for cancelled context")
	}
}

func TestWaitGroup(t *testing.T) {
	wg := NewWaitGroup(2)

	var count int32
	for i := 0; i < 5; i++ {
		err := wg.Go(func() {
			time.Sleep(10 * time.Millisecond)
			count++
		})
		if err != nil {
			t.Fatalf("Go failed: %v", err)
		}
	}

	wg.Wait()

	if count != 5 {
		t.Errorf("expected count=5, got: %d", count)
	}
}

func TestRateLimiter(t *testing.T) {
	rl := NewRateLimiter(10, 2) // 10 per second, burst of 2
	defer rl.Stop()

	ctx := context.Background()

	// First two should succeed immediately (burst)
	if err := rl.Wait(ctx); err != nil {
		t.Fatalf("first wait failed: %v", err)
	}
	if err := rl.Wait(ctx); err != nil {
		t.Fatalf("second wait failed: %v", err)
	}

	// Third should require waiting
	start := time.Now()
	if err := rl.Wait(ctx); err != nil {
		t.Fatalf("third wait failed: %v", err)
	}
	elapsed := time.Since(start)

	// Should have waited at least 100ms (1/10 second)
	if elapsed < 50*time.Millisecond {
		t.Error("expected some delay for rate limit")
	}
}

func TestRateLimiterStop(t *testing.T) {
	rl := NewRateLimiter(1, 1)

	// First wait to consume the token
	ctx := context.Background()
	rl.Wait(ctx)

	rl.Stop()

	// Next wait should fail or return quickly
	ctx2, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
	defer cancel()
	
	err := rl.Wait(ctx2)
	// Either stopped error or context timeout is acceptable
	if err == nil {
		t.Error("expected error after stop or timeout")
	}
}

func TestCircuitBreaker(t *testing.T) {
	opts := CircuitBreakerOptions{
		Threshold:   3,
		Timeout:     100 * time.Millisecond,
		HalfOpenMax: 1,
	}
	cb := NewCircuitBreaker(opts)

	// Initially closed
	if cb.State() != CircuitClosed {
		t.Errorf("expected closed, got: %s", cb.State())
	}

	// Record failures to open circuit
	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	if cb.State() != CircuitOpen {
		t.Errorf("expected open, got: %s", cb.State())
	}

	// Allow should fail
	if err := cb.Allow(); err == nil {
		t.Error("expected error for open circuit")
	}

	// Wait for timeout
	time.Sleep(150 * time.Millisecond)

	// Should transition to half-open on next allow
	if err := cb.Allow(); err != nil {
		t.Errorf("expected allow in half-open: %v", err)
	}

	if cb.State() != CircuitHalfOpen {
		t.Errorf("expected half-open, got: %s", cb.State())
	}

	// Record success to close circuit
	cb.RecordSuccess()

	if cb.State() != CircuitClosed {
		t.Errorf("expected closed after success, got: %s", cb.State())
	}
}

func TestCircuitBreakerForceOpenClose(t *testing.T) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerOptions())

	cb.ForceOpen()
	if cb.State() != CircuitOpen {
		t.Errorf("expected open, got: %s", cb.State())
	}

	cb.ForceClose()
	if cb.State() != CircuitClosed {
		t.Errorf("expected closed, got: %s", cb.State())
	}
}

func TestCircuitBreakerStats(t *testing.T) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerOptions())

	cb.RecordFailure()
	cb.RecordFailure()

	stats := cb.Stats()
	if stats.Failures != 2 {
		t.Errorf("expected 2 failures, got: %d", stats.Failures)
	}
	if stats.Threshold != 5 {
		t.Errorf("expected threshold=5, got: %d", stats.Threshold)
	}
}

func TestCircuitBreakerGroup(t *testing.T) {
	g := NewCircuitBreakerGroup(DefaultCircuitBreakerOptions())

	cb1 := g.Get("target1")
	cb2 := g.Get("target2")

	if cb1 == cb2 {
		t.Error("different targets should have different circuit breakers")
	}

	// Same target should return same breaker
	cb1Again := g.Get("target1")
	if cb1 != cb1Again {
		t.Error("same target should return same circuit breaker")
	}

	// Record failure on target1
	cb1.RecordFailure()
	cb1.RecordFailure()
	cb1.RecordFailure()
	cb1.RecordFailure()
	cb1.RecordFailure()

	// target1 should be open, target2 should be closed
	if cb1.State() != CircuitOpen {
		t.Errorf("expected target1 open, got: %s", cb1.State())
	}
	if cb2.State() != CircuitClosed {
		t.Errorf("expected target2 closed, got: %s", cb2.State())
	}

	// Stats
	stats := g.Stats()
	if len(stats) != 2 {
		t.Errorf("expected 2 stats, got: %d", len(stats))
	}
}

func TestRetry(t *testing.T) {
	opts := RetryOptions{
		MaxRetries: 3,
		BaseDelay:  10 * time.Millisecond,
		MaxDelay:   100 * time.Millisecond,
		Multiplier: 2.0,
		Jitter:     0,
	}

	ctx := context.Background()

	// Success on first try
	callCount := 0
	err := Retry(ctx, opts, func() error {
		callCount++
		return nil
	})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if callCount != 1 {
		t.Errorf("expected 1 call, got: %d", callCount)
	}

	// Success after retries
	callCount = 0
	err = Retry(ctx, opts, func() error {
		callCount++
		if callCount < 3 {
			return errors.New("temporary error")
		}
		return nil
	})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if callCount != 3 {
		t.Errorf("expected 3 calls, got: %d", callCount)
	}

	// Failure after max retries
	callCount = 0
	err = Retry(ctx, opts, func() error {
		callCount++
		return errors.New("persistent error")
	})
	if err == nil {
		t.Error("expected error after max retries")
	}
	if callCount != opts.MaxRetries+1 {
		t.Errorf("expected %d calls, got: %d", opts.MaxRetries+1, callCount)
	}
}

func TestRetryContextCancellation(t *testing.T) {
	opts := RetryOptions{
		MaxRetries: 10,
		BaseDelay:  1 * time.Second,
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel immediately
	cancel()

	callCount := 0
	err := Retry(ctx, opts, func() error {
		callCount++
		return errors.New("error")
	})

	if err == nil {
		t.Error("expected error for cancelled context")
	}
	// Call count could be 0 or 1 depending on timing
	if callCount > 1 {
		t.Errorf("expected at most 1 call, got: %d", callCount)
	}
}

func TestRetryWithCircuitBreaker(t *testing.T) {
	cb := NewCircuitBreaker(CircuitBreakerOptions{
		Threshold:   2,
		Timeout:     1 * time.Hour, // Don't auto-transition to half-open
		HalfOpenMax: 1,
	})

	opts := RetryOptions{
		MaxRetries: 3,
		BaseDelay:  10 * time.Millisecond,
	}

	ctx := context.Background()

	// Success
	callCount := 0
	err := RetryWithCircuitBreaker(ctx, cb, opts, func() error {
		callCount++
		return nil
	})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Failures that open circuit
	callCount = 0
	err = RetryWithCircuitBreaker(ctx, cb, opts, func() error {
		callCount++
		return errors.New("error")
	})
	if err == nil {
		t.Error("expected error")
	}

	// Circuit should be open
	if cb.State() != CircuitOpen {
		t.Errorf("expected circuit open, got: %s", cb.State())
	}

	// Next call should fail immediately due to open circuit
	callCount = 0
	err = RetryWithCircuitBreaker(ctx, cb, opts, func() error {
		callCount++
		return nil
	})
	if err == nil {
		t.Error("expected error for open circuit")
	}
	if callCount != 0 {
		t.Errorf("expected 0 calls (circuit open), got: %d", callCount)
	}
}
