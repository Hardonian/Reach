package backpressure

import (
	"context"
	"crypto/sha256"
	"math"
	"math/rand"
	"time"

	"reach/services/runner/internal/errors"
)

// RetryOptions configures retry behavior.
type RetryOptions struct {
	// MaxRetries is the maximum number of retry attempts.
	MaxRetries int
	// BaseDelay is the initial delay between retries.
	BaseDelay time.Duration
	// MaxDelay is the maximum delay between retries.
	MaxDelay time.Duration
	// Multiplier is the exponential backoff multiplier.
	Multiplier float64
	// Jitter is the amount of random jitter to add (0.0 to 1.0).
	Jitter float64
}

// DefaultRetryOptions returns sensible defaults.
func DefaultRetryOptions() RetryOptions {
	return RetryOptions{
		MaxRetries: 3,
		BaseDelay:  100 * time.Millisecond,
		MaxDelay:   30 * time.Second,
		Multiplier: 2.0,
		Jitter:     0.1,
	}
}

// Retry executes a function with exponential backoff retry.
func Retry(ctx context.Context, opts RetryOptions, fn func() error) error {
	if opts.MaxRetries < 0 {
		opts.MaxRetries = 0
	}
	if opts.BaseDelay <= 0 {
		opts.BaseDelay = 100 * time.Millisecond
	}
	if opts.MaxDelay <= 0 {
		opts.MaxDelay = 30 * time.Second
	}
	if opts.Multiplier <= 1.0 {
		opts.Multiplier = 2.0
	}
	if opts.Jitter < 0 {
		opts.Jitter = 0
	}
	if opts.Jitter > 1 {
		opts.Jitter = 1
	}

	var lastErr error
	for attempt := 0; attempt <= opts.MaxRetries; attempt++ {
		// Check context
		if err := ctx.Err(); err != nil {
			return errors.Classify(err)
		}

		err := fn()
		if err == nil {
			return nil
		}

		lastErr = err

		// Don't retry if context is cancelled
		if err := ctx.Err(); err != nil {
			return errors.Classify(err)
		}

		// Don't retry non-retryable errors
		if re, ok := err.(*errors.ReachError); ok && !re.Retryable {
			return err
		}

		// Don't sleep after last attempt
		if attempt < opts.MaxRetries {
			delay := calculateDelay(attempt, opts)
			select {
			case <-time.After(delay):
				// Continue to next attempt
			case <-ctx.Done():
				return errors.Classify(ctx.Err())
			}
		}
	}

	return errors.Wrap(lastErr, errors.CodeFederationMaxRetriesExceeded, "max retries exceeded")
}

// calculateDelay calculates the delay for a given attempt.
// Uses deterministic jitter derived from the attempt number for reproducibility.
func calculateDelay(attempt int, opts RetryOptions) time.Duration {
	// Exponential backoff: base * multiplier^attempt
	delay := float64(opts.BaseDelay) * math.Pow(opts.Multiplier, float64(attempt))

	// Cap at max delay
	if delay > float64(opts.MaxDelay) {
		delay = float64(opts.MaxDelay)
	}

	// Add deterministic jitter derived from attempt number
	if opts.Jitter > 0 {
		// Use deterministic jitter based on attempt number
		jitterValue := deterministicJitter(attempt)
		jitter := delay * opts.Jitter * (jitterValue*2 - 1) // +/- jitter
		delay += jitter
	}

	return time.Duration(delay)
}

// deterministicJitter generates a deterministic jitter value (0.0 to 1.0) from an attempt number.
func deterministicJitter(attempt int) float64 {
	// Hash the attempt number to get deterministic bytes
	h := sha256.Sum256([]byte{byte(attempt), byte(attempt >> 8), byte(attempt >> 16), byte(attempt >> 24)})
	// Use first 8 bytes to create a deterministic float in [0, 1)
	seed := int64(0)
	for i := 0; i < 8; i++ {
		seed = seed*256 + int64(h[i])
	}
	rng := rand.New(rand.NewSource(seed))
	return rng.Float64()
}

// RetryWithCircuitBreaker combines retry with circuit breaker.
func RetryWithCircuitBreaker(
	ctx context.Context,
	cb *CircuitBreaker,
	retryOpts RetryOptions,
	fn func() error,
) error {
	// Check circuit breaker first
	if err := cb.Allow(); err != nil {
		return err
	}

	var lastErr error
	for attempt := 0; attempt <= retryOpts.MaxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return errors.Classify(err)
		}

		err := fn()
		if err == nil {
			cb.RecordSuccess()
			return nil
		}

		lastErr = err
		cb.RecordFailure()

		// Check if circuit is now open
		if cb.State() == CircuitOpen {
			return errors.Wrap(err, errors.CodeFederationCircuitOpen, "circuit opened during retry")
		}

		if err := ctx.Err(); err != nil {
			return errors.Classify(err)
		}

		// Don't retry non-retryable errors
		if re, ok := err.(*errors.ReachError); ok && !re.Retryable {
			return err
		}

		if attempt < retryOpts.MaxRetries {
			delay := calculateDelay(attempt, retryOpts)
			select {
			case <-time.After(delay):
				// Check circuit again before next attempt
				if err := cb.Allow(); err != nil {
					return err
				}
			case <-ctx.Done():
				return errors.Classify(ctx.Err())
			}
		}
	}

	return errors.Wrap(lastErr, errors.CodeFederationMaxRetriesExceeded, "max retries exceeded")
}

// IsRetryable returns true if the error is retryable.
func IsRetryable(err error) bool {
	if err == nil {
		return false
	}
	if re, ok := err.(*errors.ReachError); ok {
		return re.Retryable
	}
	return false
}
