// Package poee implements Proof-of-Execution Exchange (PoEE) for Reach.
// PoEE enables delegation of execution to trusted peers with cryptographically
// verifiable proof bundles.
package poee

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"reach/services/runner/internal/determinism"
)

// ReachDelegationEnvelope represents an execution delegation request.
// Must be signed by the delegator before transmission.
type ReachDelegationEnvelope struct {
	DelegationID  string `json:"delegationId"`
	PackHash      string `json:"packHash"`
	InputHash     string `json:"inputHash"`
	SchedulerHash string `json:"schedulerHash,omitempty"`
	RequestedBy   string `json:"requestedBy"`
	Timestamp     string `json:"timestamp"`
	Signature     string `json:"signature,omitempty"`
	EnvelopeHash  string `json:"envelopeHash"`
}

// ReachExecutionProof represents a signed proof of execution completion.
// Returned by the executor peer to the delegator.
type ReachExecutionProof struct {
	DelegationID          string `json:"delegationId"`
	OutputHash            string `json:"outputHash"`
	ExecutionEnvelopeHash string `json:"executionEnvelopeHash"`
	SchedulerHash         string `json:"schedulerHash,omitempty"`
	JournalHash           string `json:"journalHash,omitempty"`
	Signature             string `json:"signature"`
}

// SignedDelegationEnvelope is a delegation envelope with its signature detached
type SignedDelegationEnvelope struct {
	Envelope  *ReachDelegationEnvelope `json:"envelope"`
	Signature []byte                   `json:"signature"`
}

// SignedExecutionProof is an execution proof with its signature detached
type SignedExecutionProof struct {
	Proof     *ReachExecutionProof `json:"proof"`
	Signature []byte               `json:"signature"`
}

// KeyPair manages Ed25519 keypairs for PoEE signing
type KeyPair struct {
	PublicKey  ed25519.PublicKey  `json:"public_key"`
	PrivateKey ed25519.PrivateKey `json:"private_key"`
	NodeID     string             `json:"node_id"`
}

// NewKeyPair generates a new Ed25519 keypair for PoEE
func NewKeyPair() (*KeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to generate keypair: %w", err)
	}

	// Derive node ID from public key
	nodeID := deriveNodeID(pub)

	return &KeyPair{
		PublicKey:  pub,
		PrivateKey: priv,
		NodeID:     nodeID,
	}, nil
}

// deriveNodeID creates a deterministic node ID from public key
func deriveNodeID(pub ed25519.PublicKey) string {
	hash := determinism.Hash(map[string]any{"pub": pub})
	return hash[:16] // First 16 chars of hash
}

// SignEnvelope signs a delegation envelope and updates its signature field
func (kp *KeyPair) SignEnvelope(envelope *ReachDelegationEnvelope) error {
	// Save original values to compute canonical hash
	origHash := envelope.EnvelopeHash
	origSig := envelope.Signature

	// Compute hash without signature fields for deterministic hashing
	envelope.EnvelopeHash = ""
	envelope.Signature = ""
	envelope.EnvelopeHash = determinism.Hash(envelope)

	// Restore original values
	envelope.Signature = origSig

	// Sign the envelope hash
	data := []byte(envelope.EnvelopeHash)
	sig := ed25519.Sign(kp.PrivateKey, data)

	envelope.Signature = base64.StdEncoding.EncodeToString(sig)
	_ = origHash // Preserve for reference
	return nil
}

// SignProof signs an execution proof
func (kp *KeyPair) SignProof(proof *ReachExecutionProof) ([]byte, error) {
	// Compute canonical hash of proof (without signature)
	proofCopy := *proof
	proofCopy.Signature = ""
	hash := determinism.Hash(proofCopy)

	// Sign the hash
	sig := ed25519.Sign(kp.PrivateKey, []byte(hash))
	return sig, nil
}

// VerifyEnvelope verifies a signed delegation envelope
func (kp *KeyPair) VerifyEnvelope(envelope *ReachDelegationEnvelope, pubKey ed25519.PublicKey) error {
	if envelope.Signature == "" {
		return fmt.Errorf("envelope has no signature")
	}

	// Decode signature
	sig, err := base64.StdEncoding.DecodeString(envelope.Signature)
	if err != nil {
		return fmt.Errorf("invalid signature encoding: %w", err)
	}

	// Compute canonical hash (without signature field)
	origSig := envelope.Signature
	envelope.Signature = ""
	expectedHash := determinism.Hash(envelope)
	envelope.Signature = origSig

	// Verify envelope hash matches
	if envelope.EnvelopeHash != expectedHash {
		return fmt.Errorf("envelope hash mismatch: computed %s, expected %s", expectedHash, envelope.EnvelopeHash)
	}

	// Verify signature
	data := []byte(envelope.EnvelopeHash)
	if !ed25519.Verify(pubKey, data, sig) {
		return fmt.Errorf("invalid envelope signature")
	}

	return nil
}

// VerifyProof verifies an execution proof
func (kp *KeyPair) VerifyProof(proof *ReachExecutionProof, pubKey ed25519.PublicKey) error {
	if proof.Signature == "" {
		return fmt.Errorf("proof has no signature")
	}

	// Decode signature
	sig, err := base64.StdEncoding.DecodeString(proof.Signature)
	if err != nil {
		return fmt.Errorf("invalid proof signature encoding: %w", err)
	}

	// Compute hash (without signature)
	proofCopy := *proof
	proofCopy.Signature = ""
	hash := determinism.Hash(proofCopy)

	// Verify signature
	if !ed25519.Verify(pubKey, []byte(hash), sig) {
		return fmt.Errorf("invalid proof signature")
	}

	return nil
}

// KeyStore manages PoEE keypairs on disk
const KeyStorePath = ".reach/keys"

// KeyStore handles loading and saving keypairs
type KeyStore struct {
	BasePath string
}

// NewKeyStore creates a key store at the specified path
func NewKeyStore(basePath string) *KeyStore {
	return &KeyStore{BasePath: basePath}
}

// LoadOrCreate loads an existing keypair or creates a new one
func (ks *KeyStore) LoadOrCreate() (*KeyPair, error) {
	keyPath := filepath.Join(ks.BasePath, KeyStorePath, "poee_key.pem")

	// Try to load existing
	if data, err := os.ReadFile(keyPath); err == nil {
		return ks.loadFromPEM(data)
	}

	// Create new keypair
	kp, err := NewKeyPair()
	if err != nil {
		return nil, err
	}

	// Save to disk
	if err := ks.saveToPEM(kp, keyPath); err != nil {
		return nil, err
	}

	return kp, nil
}

// LoadPeerKey loads a peer's public key from the trust store
func (ks *KeyStore) LoadPeerKey(nodeID string) (ed25519.PublicKey, error) {
	keyPath := filepath.Join(ks.BasePath, KeyStorePath, "peers", nodeID+".pub")

	data, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("peer key not found: %w", err)
	}

	pubKey, err := hex.DecodeString(string(data))
	if err != nil {
		return nil, fmt.Errorf("invalid peer key format: %w", err)
	}

	return ed25519.PublicKey(pubKey), nil
}

// SavePeerKey saves a peer's public key
func (ks *KeyStore) SavePeerKey(nodeID string, pubKey ed25519.PublicKey) error {
	keyPath := filepath.Join(ks.BasePath, KeyStorePath, "peers", nodeID+".pub")

	if err := os.MkdirAll(filepath.Dir(keyPath), 0o700); err != nil {
		return err
	}

	data := hex.EncodeToString(pubKey)
	return os.WriteFile(keyPath, []byte(data), 0o600)
}

// loadFromPEM loads a keypair from PEM format (simplified for PoEE)
func (ks *KeyStore) loadFromPEM(data []byte) (*KeyPair, error) {
	// Simple JSON encoding for now
	var stored struct {
		PublicKey  string `json:"public_key"`
		PrivateKey string `json:"private_key"`
		NodeID     string `json:"node_id"`
	}

	if err := json.Unmarshal(data, &stored); err != nil {
		return nil, fmt.Errorf("invalid key format: %w", err)
	}

	pubKey, err := hex.DecodeString(stored.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("invalid public key: %w", err)
	}

	privKey, err := hex.DecodeString(stored.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	return &KeyPair{
		PublicKey:  ed25519.PublicKey(pubKey),
		PrivateKey: ed25519.PrivateKey(privKey),
		NodeID:     stored.NodeID,
	}, nil
}

// saveToPEM saves a keypair to PEM format (simplified JSON for PoEE)
func (ks *KeyStore) saveToPEM(kp *KeyPair, path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}

	stored := struct {
		PublicKey  string `json:"public_key"`
		PrivateKey string `json:"private_key"`
		NodeID     string `json:"node_id"`
	}{
		PublicKey:  hex.EncodeToString(kp.PublicKey),
		PrivateKey: hex.EncodeToString(kp.PrivateKey),
		NodeID:     kp.NodeID,
	}

	data, err := json.MarshalIndent(stored, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o600)
}

// CreateDelegationEnvelope creates a new delegation envelope with proper hashing
func CreateDelegationEnvelope(packHash, inputHash, schedulerHash, requestedBy string) *ReachDelegationEnvelope {
	envelope := &ReachDelegationEnvelope{
		DelegationID:  generateDelegationID(),
		PackHash:      packHash,
		InputHash:     inputHash,
		SchedulerHash: schedulerHash,
		RequestedBy:   requestedBy,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
	}

	// Compute envelope hash
	envelope.EnvelopeHash = determinism.Hash(envelope)

	return envelope
}

// CreateExecutionProof creates a new execution proof
func CreateExecutionProof(delegationID, outputHash, executionEnvelopeHash, schedulerHash, journalHash string) *ReachExecutionProof {
	return &ReachExecutionProof{
		DelegationID:          delegationID,
		OutputHash:            outputHash,
		ExecutionEnvelopeHash: executionEnvelopeHash,
		SchedulerHash:         schedulerHash,
		JournalHash:           journalHash,
	}
}

// VerifyProofIntegrity performs full verification of a proof against its envelope
func VerifyProofIntegrity(proof *ReachExecutionProof, envelope *ReachDelegationEnvelope, pubKey ed25519.PublicKey) error {
	// 1. Verify delegation ID matches
	if proof.DelegationID != envelope.DelegationID {
		return fmt.Errorf("delegation ID mismatch: proof has %s, envelope has %s", proof.DelegationID, envelope.DelegationID)
	}

	// 2. Verify envelope hash matches
	if proof.ExecutionEnvelopeHash != envelope.EnvelopeHash {
		return fmt.Errorf("envelope hash mismatch: proof references %s, envelope is %s", proof.ExecutionEnvelopeHash, envelope.EnvelopeHash)
	}

	// 3. Verify signature
	if proof.Signature == "" {
		return fmt.Errorf("proof has no signature")
	}

	sig, err := base64.StdEncoding.DecodeString(proof.Signature)
	if err != nil {
		return fmt.Errorf("invalid signature encoding: %w", err)
	}

	// Compute hash (without signature)
	proofCopy := *proof
	proofCopy.Signature = ""
	hash := determinism.Hash(proofCopy)

	if !ed25519.Verify(pubKey, []byte(hash), sig) {
		return fmt.Errorf("invalid proof signature")
	}

	return nil
}

// generateDelegationID creates a unique delegation ID
func generateDelegationID() string {
	timestamp := time.Now().UTC().UnixNano()
	random := make([]byte, 8)
	for i := range random {
		random[i] = byte(timestamp % 256)
		timestamp /= 256
	}
	return hex.EncodeToString(random)
}

// ExportProofJSON exports a proof to JSON for CLI/file storage
func ExportProofJSON(proof *ReachExecutionProof) ([]byte, error) {
	return json.MarshalIndent(proof, "", "  ")
}

// ImportProofJSON imports a proof from JSON
func ImportProofJSON(data []byte) (*ReachExecutionProof, error) {
	var proof ReachExecutionProof
	if err := json.Unmarshal(data, &proof); err != nil {
		return nil, fmt.Errorf("invalid proof JSON: %w", err)
	}
	return &proof, nil
}

// ExportEnvelopeJSON exports an envelope to JSON
func ExportEnvelopeJSON(envelope *ReachDelegationEnvelope) ([]byte, error) {
	return json.MarshalIndent(envelope, "", "  ")
}

// ImportEnvelopeJSON imports an envelope from JSON
func ImportEnvelopeJSON(data []byte) (*ReachDelegationEnvelope, error) {
	var envelope ReachDelegationEnvelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		return nil, fmt.Errorf("invalid envelope JSON: %w", err)
	}
	return &envelope, nil
}
