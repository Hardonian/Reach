//go:build !enterprise
// +build !enterprise

package remote

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"
)

// ErrRemoteValidationDisabled is returned when remote validation is disabled.
var ErrRemoteValidationDisabled = errors.New("remote replay validation is disabled in OSS build")

// ConfigFlag determines whether remote validation is enabled.
var ConfigFlag = false

// ReplayValidationClientStub is a stub implementation of the ReplayValidationClient interface.
// It is used for testing and development purposes in OSS builds.
type ReplayValidationClientStub struct{}

// NewReplayValidationClientStub returns a new instance of the ReplayValidationClientStub.
func NewReplayValidationClientStub() *ReplayValidationClientStub {
	return &ReplayValidationClientStub{}
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

// ValidateReplay implements the ReplayValidationClient interface.
// In OSS builds, it returns an error indicating remote validation is disabled.
func (c *ReplayValidationClientStub) ValidateReplay(ctx context.Context, replay []byte) error {
	// Check config flag - return error if disabled
	if !ConfigFlag {
		return ErrRemoteValidationDisabled
	}

	// Generate deterministic nonce from replay content
	nonce := generateDeterministicNonce(replay)

	// Create deterministic request envelope
	envelope := ReplayEnvelope{
		Nonce:   nonce,
		Payload: replay,
	}

	// Stub: return nil to indicate successful validation
	// In production, this would send the envelope to the remote service
	_ = envelope // Use envelope to avoid unused variable
	return nil
}

// ValidateReplayWithRetry performs replay validation with exponential backoff retry.
// It retries up to 3 times with delays of 100ms, 200ms, 400ms (capped at 5s max).
func (c *ReplayValidationClientStub) ValidateReplayWithRetry(ctx context.Context, replay []byte) error {
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
