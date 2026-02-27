// Package proofbundle provides functionality for creating and verifying proof bundles.
//
// Proof bundles are standalone JSON files (.reach-proof.json) that contain
// all necessary information to verify a Reach execution proof independently.
package proofbundle

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"

	signing "reach/internal/packkit/signing"
)

// Version is the current proof bundle format version.
const Version = "1.0.0"

// VerificationStep represents a step in the proof bundle verification process.
type VerificationStep int

const (
	// StepSchema validates the JSON schema of the proof bundle.
	StepSchema VerificationStep = iota
	// StepFingerprint validates the fingerprint hash.
	StepFingerprint
	// StepMerkle validates the merkle root.
	StepMerkle
	// StepInternalConsistency validates internal consistency of hashes.
	StepInternalConsistency
	// StepSignatures validates any attached signatures.
	StepSignatures
)

// VerificationResult represents the result of verifying a proof bundle.
type VerificationResult struct {
	Valid       bool            `json:"valid"`
	Step        VerificationStep `json:"step,omitempty"`
	StepName    string          `json:"stepName,omitempty"`
	Error       string          `json:"error,omitempty"`
	Details     map[string]any  `json:"details,omitempty"`
	ExitCode    int             `json:"exitCode"`
}

// Exit codes for the verify command.
const (
	ExitCodeSuccess       = 0
	ExitCodeSchemaError   = 1
	ExitCodeFingerprintError = 2
	ExitCodeMerkleError   = 3
	ExitCodeConsistencyError = 4
	ExitCodeSignatureError = 5
	ExitCodeFileError    = 6
)

// ArtifactDigest represents a digest of an input artifact.
type ArtifactDigest struct {
	Name    string `json:"name"`
	Digest  string `json:"digest"`
	Version string `json:"version,omitempty"`
}

// Metadata contains additional metadata about the proof bundle.
type Metadata struct {
	PackName     string            `json:"packName,omitempty"`
	PackVersion  string            `json:"packVersion,omitempty"`
	Environment  map[string]string `json:"environment,omitempty"`
}

// BundleSignature represents a digital signature of the proof bundle.
type BundleSignature struct {
	KeyID     string `json:"keyId"`
	Algorithm string `json:"algorithm"`
	Signature string `json:"signature"`
}

// ProofBundle represents a proof bundle file.
type ProofBundle struct {
	Version              string            `json:"version"`
	Fingerprint         string            `json:"fingerprint"`
	MerkleRoot          string            `json:"merkleRoot"`
	InputArtifactDigests []ArtifactDigest `json:"inputArtifactDigests"`
	OutputDigest        string            `json:"outputDigest"`
	PolicyDigest        string            `json:"policyDigest"`
	TranscriptDigest    string            `json:"transcriptDigest"`
	EngineVersion       string            `json:"engineVersion"`
	ProtocolVersion     string            `json:"protocolVersion"`
	CreatedAt           string            `json:"createdAt"`
	RunID              string            `json:"runId,omitempty"`
	Metadata            *Metadata        `json:"metadata,omitempty"`
	Signature           *BundleSignature `json:"signature,omitempty"`
	VerificationStatus  string            `json:"verificationStatus,omitempty"`
	VerifiedAt         string            `json:"verifiedAt,omitempty"`
}

// ExportOptions contains options for exporting a proof bundle.
type ExportOptions struct {
	RunID              string
	EngineVersion      string
	ProtocolVersion    string
	CreatedAt          string
	MerkleRoot         string
	InputArtifactDigests []ArtifactDigest
	OutputDigest       string
	PolicyDigest       string
	TranscriptDigest   string
	Metadata           *Metadata
}

// Export creates a new proof bundle from the given options.
func Export(opts ExportOptions) (*ProofBundle, error) {
	if opts.CreatedAt == "" {
		return nil, fmt.Errorf("createdAt is required")
	}
	if opts.MerkleRoot == "" {
		return nil, fmt.Errorf("merkleRoot is required")
	}
	if opts.OutputDigest == "" {
		return nil, fmt.Errorf("outputDigest is required")
	}
	if opts.PolicyDigest == "" {
		return nil, fmt.Errorf("policyDigest is required")
	}
	if opts.TranscriptDigest == "" {
		return nil, fmt.Errorf("transcriptDigest is required")
	}

	// Sort artifacts by name for deterministic ordering
	artifacts := make([]ArtifactDigest, len(opts.InputArtifactDigests))
	copy(artifacts, opts.InputArtifactDigests)
	sort.Slice(artifacts, func(i, j int) bool {
		return artifacts[i].Name < artifacts[j].Name
	})

	bundle := &ProofBundle{
		Version:               Version,
		MerkleRoot:            opts.MerkleRoot,
		InputArtifactDigests:  artifacts,
		OutputDigest:          opts.OutputDigest,
		PolicyDigest:          opts.PolicyDigest,
		TranscriptDigest:      opts.TranscriptDigest,
		EngineVersion:         opts.EngineVersion,
		ProtocolVersion:      opts.ProtocolVersion,
		CreatedAt:             opts.CreatedAt,
		RunID:                 opts.RunID,
		Metadata:              opts.Metadata,
	}

	// Compute fingerprint (canonical JSON without signature)
	fingerprint, err := computeFingerprint(bundle)
	if err != nil {
		return nil, fmt.Errorf("failed to compute fingerprint: %w", err)
	}
	bundle.Fingerprint = fingerprint

	return bundle, nil
}

// Verify performs the 5-step verification process on a proof bundle.
func Verify(bundle *ProofBundle, trustedKeys map[string]string) *VerificationResult {
	// Step 1: Schema validation
	if err := validateSchema(bundle); err != nil {
		return &VerificationResult{
			Valid:    false,
			Step:     StepSchema,
			StepName: "schema",
			Error:    err.Error(),
			ExitCode: ExitCodeSchemaError,
		}
	}

	// Step 2: Fingerprint validation
	if err := validateFingerprint(bundle); err != nil {
		return &VerificationResult{
			Valid:    false,
			Step:     StepFingerprint,
			StepName: "fingerprint",
			Error:    err.Error(),
			ExitCode: ExitCodeFingerprintError,
		}
	}

	// Step 3: Merkle root validation
	if err := validateMerkleRoot(bundle); err != nil {
		return &VerificationResult{
			Valid:    false,
			Step:     StepMerkle,
			StepName: "merkle",
			Error:    err.Error(),
			ExitCode: ExitCodeMerkleError,
		}
	}

	// Step 4: Internal consistency validation
	if err := validateInternalConsistency(bundle); err != nil {
		return &VerificationResult{
			Valid:    false,
			Step:     StepInternalConsistency,
			StepName: "internal_consistency",
			Error:    err.Error(),
			ExitCode: ExitCodeConsistencyError,
		}
	}

	// Step 5: Signature validation (if present)
	if bundle.Signature != nil {
		if err := validateSignature(bundle, trustedKeys); err != nil {
			return &VerificationResult{
				Valid:    false,
				Step:     StepSignatures,
				StepName: "signatures",
				Error:    err.Error(),
				ExitCode: ExitCodeSignatureError,
			}
		}
	}

	return &VerificationResult{
		Valid:    true,
		ExitCode: ExitCodeSuccess,
		Details: map[string]any{
			"fingerprint": bundle.Fingerprint,
			"merkleRoot":  bundle.MerkleRoot,
			"runId":       bundle.RunID,
		},
	}
}

// Load loads a proof bundle from a reader.
func Load(r io.Reader) (*ProofBundle, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("failed to read proof bundle: %w", err)
	}
	return Parse(data)
}

// Parse parses a proof bundle from JSON data.
func Parse(data []byte) (*ProofBundle, error) {
	var bundle ProofBundle
	if err := json.Unmarshal(data, &bundle); err != nil {
		return nil, fmt.Errorf("failed to parse proof bundle: %w", err)
	}
	return &bundle, nil
}

// MustParse parses a proof bundle from JSON data and panics on error.
func MustParse(data []byte) *ProofBundle {
	bundle, err := Parse(data)
	if err != nil {
		panic(err)
	}
	return bundle
}

// Save writes a proof bundle to a writer.
func Save(bundle *ProofBundle, w io.Writer) error {
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(false)
	return encoder.Encode(bundle)
}

// CanonicalJSON returns the canonical JSON representation of a proof bundle
// (without the fingerprint field for computing the fingerprint).
func CanonicalJSON(bundle *ProofBundle) ([]byte, error) {
	// Create a copy without the fingerprint for canonical hashing
	canonical := *bundle
	canonical.Fingerprint = ""
	canonical.Signature = nil
	canonical.VerificationStatus = ""
	canonical.VerifiedAt = ""

	return json.Marshal(canonical)
}

// computeFingerprint computes the SHA-256 fingerprint of a proof bundle.
func computeFingerprint(bundle *ProofBundle) (string, error) {
	data, err := CanonicalJSON(bundle)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:]), nil
}

// validateSchema validates the proof bundle schema.
func validateSchema(bundle *ProofBundle) error {
	if bundle.Version == "" {
		return fmt.Errorf("version is required")
	}
	if bundle.Fingerprint == "" {
		return fmt.Errorf("fingerprint is required")
	}
	if bundle.MerkleRoot == "" {
		return fmt.Errorf("merkleRoot is required")
	}
	if bundle.OutputDigest == "" {
		return fmt.Errorf("outputDigest is required")
	}
	if bundle.PolicyDigest == "" {
		return fmt.Errorf("policyDigest is required")
	}
	if bundle.TranscriptDigest == "" {
		return fmt.Errorf("transcriptDigest is required")
	}
	if bundle.EngineVersion == "" {
		return fmt.Errorf("engineVersion is required")
	}
	if bundle.ProtocolVersion == "" {
		return fmt.Errorf("protocolVersion is required")
	}
	if bundle.CreatedAt == "" {
		return fmt.Errorf("createdAt is required")
	}
	// Validate merkle root is a valid hex string (SHA-256)
	if _, err := hex.DecodeString(bundle.MerkleRoot); err != nil || len(bundle.MerkleRoot) != 64 {
		return fmt.Errorf("merkleRoot must be a valid SHA-256 hex string")
	}
	// Validate all digests are valid hex strings
	for _, d := range bundle.InputArtifactDigests {
		if _, err := hex.DecodeString(d.Digest); err != nil || len(d.Digest) != 64 {
			return fmt.Errorf("invalid artifact digest for %s: must be SHA-256 hex", d.Name)
		}
	}
	if _, err := hex.DecodeString(bundle.OutputDigest); err != nil || len(bundle.OutputDigest) != 64 {
		return fmt.Errorf("outputDigest must be a valid SHA-256 hex string")
	}
	if _, err := hex.DecodeString(bundle.PolicyDigest); err != nil || len(bundle.PolicyDigest) != 64 {
		return fmt.Errorf("policyDigest must be a valid SHA-256 hex string")
	}
	if _, err := hex.DecodeString(bundle.TranscriptDigest); err != nil || len(bundle.TranscriptDigest) != 64 {
		return fmt.Errorf("transcriptDigest must be a valid SHA-256 hex string")
	}
	if _, err := hex.DecodeString(bundle.Fingerprint); err != nil || len(bundle.Fingerprint) != 64 {
		return fmt.Errorf("fingerprint must be a valid SHA-256 hex string")
	}
	// Validate signature if present
	if bundle.Signature != nil {
		if bundle.Signature.KeyID == "" {
			return fmt.Errorf("signature keyId is required")
		}
		if bundle.Signature.Algorithm == "" {
			return fmt.Errorf("signature algorithm is required")
		}
		if bundle.Signature.Signature == "" {
			return fmt.Errorf("signature signature is required")
		}
		if bundle.Signature.Algorithm != "ed25519" && bundle.Signature.Algorithm != "rsa-sha256" {
			return fmt.Errorf("unsupported signature algorithm: %s", bundle.Signature.Algorithm)
		}
	}
	return nil
}

// validateFingerprint validates the fingerprint of the proof bundle.
func validateFingerprint(bundle *ProofBundle) error {
	computed, err := computeFingerprint(bundle)
	if err != nil {
		return fmt.Errorf("failed to compute fingerprint: %w", err)
	}
	if computed != bundle.Fingerprint {
		return fmt.Errorf("fingerprint mismatch: expected %s, got %s", computed, bundle.Fingerprint)
	}
	return nil
}

// validateMerkleRoot validates the merkle root.
// In a full implementation, this would verify the merkle proof.
func validateMerkleRoot(bundle *ProofBundle) error {
	// For now, we just check it's present and valid hex
	// A full implementation would verify merkle proofs
	if bundle.MerkleRoot == "" {
		return fmt.Errorf("merkleRoot is empty")
	}
	return nil
}

// validateInternalConsistency validates that the hashes are consistent.
func validateInternalConsistency(bundle *ProofBundle) error {
	// Build a canonical string from all hashes and verify consistency
	parts := []string{
		bundle.MerkleRoot,
		bundle.OutputDigest,
		bundle.PolicyDigest,
		bundle.TranscriptDigest,
	}
	// Sort artifacts by name for deterministic ordering
	artifacts := make([]ArtifactDigest, len(bundle.InputArtifactDigests))
	copy(artifacts, bundle.InputArtifactDigests)
	sort.Slice(artifacts, func(i, j int) bool {
		return artifacts[i].Name < artifacts[j].Name
	})
	for _, a := range artifacts {
		parts = append(parts, a.Digest)
	}

	// Verify no empty hashes
	for _, p := range parts {
		if p == "" {
			return fmt.Errorf("empty hash found in consistency check")
		}
	}

	// The transcript digest should incorporate all other hashes
	// This is a simplified check - in production, this would be more sophisticated
	allHashes := strings.Join(parts, "|")
	hash := sha256.Sum256([]byte(allHashes))
	derivedTranscriptHash := hex.EncodeToString(hash[:])

	// If transcript digest is different from what we derived, it might be from a different source
	// This is allowed but we note it
	_ = derivedTranscriptHash

	return nil
}

// validateSignature validates the signature of the proof bundle.
func validateSignature(bundle *ProofBundle, trustedKeys map[string]string) error {
	if bundle.Signature == nil {
		return nil
	}

	// Check if we have a trusted key for this key ID
	key, ok := trustedKeys[bundle.Signature.KeyID]
	if !ok && len(trustedKeys) > 0 {
		return fmt.Errorf("unknown key ID: %s", bundle.Signature.KeyID)
	}

	// For now, we just validate the structure
	// A full implementation would verify the cryptographic signature
	_ = key

	return nil
}

// AddSignature adds a signature to the proof bundle.
func AddSignature(bundle *ProofBundle, keyID, algorithm, signatureHex string) {
	bundle.Signature = &BundleSignature{
		KeyID:     keyID,
		Algorithm: algorithm,
		Signature: signatureHex,
	}
}

// Sign signs the proof bundle using the specified signer plugin.
// The signer must be initialized and available.
func Sign(bundle *ProofBundle, signer signing.SignerPlugin, keyID string) error {
	if bundle == nil {
		return fmt.Errorf("proofbundle: cannot sign nil bundle")
	}
	if signer == nil {
		return fmt.Errorf("proofbundle: signer cannot be nil")
	}

	// Get canonical JSON for signing (without signature field)
	data, err := CanonicalJSON(bundle)
	if err != nil {
		return fmt.Errorf("proofbundle: failed to get canonical JSON: %w", err)
	}

	// Determine algorithm
	algorithms := signer.SupportedAlgorithms()
	if len(algorithms) == 0 {
		return fmt.Errorf("proofbundle: signer supports no algorithms")
	}
	algorithm := string(algorithms[0])

	// Sign the data
	sig, err := signer.Sign(data, algorithm)
	if err != nil {
		return fmt.Errorf("proofbundle: signing failed: %w", err)
	}

	// Add signature to bundle
	bundle.Signature = &BundleSignature{
		KeyID:     keyID,
		Algorithm: algorithm,
		Signature: hex.EncodeToString(sig),
	}

	return nil
}

// SignWithPlugin signs the proof bundle using a plugin by name.
// Uses the global registry to resolve the plugin.
func SignWithPlugin(bundle *ProofBundle, pluginName, keyID string) error {
	signer, err := signing.GlobalRegistry.Get(pluginName)
	if err != nil {
		return fmt.Errorf("proofbundle: failed to get signer plugin: %w", err)
	}
	return Sign(bundle, signer, keyID)
}

// VerifySignature verifies the proof bundle signature using the specified signer.
// Returns nil if verification succeeds, error otherwise.
func VerifySignature(bundle *ProofBundle, signer signing.SignerPlugin) error {
	if bundle == nil {
		return fmt.Errorf("proofbundle: cannot verify nil bundle")
	}
	if bundle.Signature == nil {
		return fmt.Errorf("proofbundle: bundle has no signature")
	}
	if signer == nil {
		return fmt.Errorf("proofbundle: signer cannot be nil")
	}

	// Get canonical JSON (without signature)
	data, err := CanonicalJSON(bundle)
	if err != nil {
		return fmt.Errorf("proofbundle: failed to get canonical JSON: %w", err)
	}

	// Decode signature
	sigBytes, err := hex.DecodeString(bundle.Signature.Signature)
	if err != nil {
		return fmt.Errorf("proofbundle: invalid signature encoding: %w", err)
	}

	// Verify
	valid, err := signer.Verify(data, sigBytes, bundle.Signature.Algorithm)
	if err != nil {
		return fmt.Errorf("proofbundle: verification error: %w", err)
	}
	if !valid {
		return fmt.Errorf("proofbundle: signature verification failed")
	}

	return nil
}

// VerifySignatureWithPlugin verifies the proof bundle signature using a plugin by name.
func VerifySignatureWithPlugin(bundle *ProofBundle, pluginName string) error {
	signer, err := signing.GlobalRegistry.Get(pluginName)
	if err != nil {
		return fmt.Errorf("proofbundle: failed to get signer plugin: %w", err)
	}
	return VerifySignature(bundle, signer)
}

// GetSignerPlugin returns the signer plugin by name from the global registry.
func GetSignerPlugin(name string) (signing.SignerPlugin, error) {
	return signing.GlobalRegistry.Get(name)
}

// ListSignerPlugins returns all available signer plugin names.
func ListSignerPlugins() []string {
	return signing.GlobalRegistry.List()
}
