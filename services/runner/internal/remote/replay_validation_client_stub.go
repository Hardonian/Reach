package remote

import (
	"context"
)

// ReplayValidationClientStub is a stub implementation of the ReplayValidationClient interface.
// It is used for testing and development purposes.
type ReplayValidationClientStub struct{}

// NewReplayValidationClientStub returns a new instance of the ReplayValidationClientStub.
func NewReplayValidationClientStub() *ReplayValidationClientStub {
	return &ReplayValidationClientStub{}
}

// ValidateReplay implements the ReplayValidationClient interface.
// It always returns a successful validation result.
func (c *ReplayValidationClientStub) ValidateReplay(ctx context.Context, replay []byte) error {
	// TODO: implement me
	return nil
}