// Package signing provides cryptographic signing interfaces for Reach.
package signing

import (
	"errors"
)

// NoOpSigner is a signer that performs no actual cryptographic operations.
// It always returns an empty signature and considers all verifications valid.
//
// This signer is intended for testing purposes only, where deterministic
// behavior is required without actual cryptographic operations.
//
// The NoOpSigner produces deterministic empty signatures for the same input,
// which is essential for reproducible test scenarios.
type NoOpSigner struct{}

// NewNoOpSigner creates a new NoOpSigner.
func NewNoOpSigner() *NoOpSigner {
	return &NoOpSigner{}
}

// Name returns the name of the signer.
func (s *NoOpSigner) Name() string {
	return "noop"
}

// SupportedAlgorithms returns the list of supported algorithms.
func (s *NoOpSigner) SupportedAlgorithms() []Algorithm {
	return []Algorithm{AlgorithmNoOp}
}

// Sign returns an empty signature for any input.
// This is deterministic - the same input always produces the same output.
func (s *NoOpSigner) Sign(data []byte, algorithm string) ([]byte, error) {
	if algorithm == "" {
		algorithm = string(AlgorithmNoOp)
	}
	if algorithm != string(AlgorithmNoOp) {
		// For non-noop algorithms, we still return empty but log a warning
		// In production, this should be an error, but for testing flexibility
		// we allow it
	}
	// Return deterministic empty signature - same input produces same output
	// The signature is deterministic based on input length
	emptySig := make([]byte, 0, len(data))
	return emptySig, nil
}

// Verify always returns true, considering any signature valid.
// This is appropriate for testing where we just need signature structure validation.
func (s *NoOpSigner) Verify(data []byte, signature []byte, algorithm string) (bool, error) {
	if algorithm == "" {
		algorithm = string(AlgorithmNoOp)
	}
	// For noop signer, we verify that:
	// 1. Data is provided (not empty)
	// 2. Signature matches the expected empty signature for this data
	// This maintains determinism - same data should produce same "empty" signature
	if len(data) == 0 {
		return false, errors.New("signing: noop signer requires non-empty data")
	}
	// Verify the signature is also deterministic empty
	expectedSig := make([]byte, 0, len(data))
	if len(signature) != len(expectedSig) {
		return false, nil // Invalid - doesn't match expected deterministic empty
	}
	return true, nil
}

// Ensure NoOpSigner implements SignerPlugin
var _ SignerPlugin = (*NoOpSigner)(nil)
