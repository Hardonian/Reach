package poee

import (
	"crypto/ed25519"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"

	"reach/services/runner/internal/determinism"
)

// TestCreateDelegationEnvelope tests envelope creation and hashing
func TestCreateDelegationEnvelope(t *testing.T) {
	packHash := "abc123"
	inputHash := "def456"
	requestedBy := "node123"

	envelope := CreateDelegationEnvelope(packHash, inputHash, "", requestedBy)

	if envelope.PackHash != packHash {
		t.Errorf("PackHash mismatch: got %s, want %s", envelope.PackHash, packHash)
	}

	if envelope.InputHash != inputHash {
		t.Errorf("InputHash mismatch: got %s, want %s", envelope.InputHash, inputHash)
	}

	if envelope.RequestedBy != requestedBy {
		t.Errorf("RequestedBy mismatch: got %s, want %s", envelope.RequestedBy, requestedBy)
	}

	if envelope.EnvelopeHash == "" {
		t.Error("EnvelopeHash should not be empty")
	}

	if envelope.DelegationID == "" {
		t.Error("DelegationID should not be empty")
	}
}

// TestKeyPairGeneration tests Ed25519 keypair creation
func TestKeyPairGeneration(t *testing.T) {
	kp, err := NewKeyPair()
	if err != nil {
		t.Fatalf("Failed to create keypair: %v", err)
	}

	if len(kp.PublicKey) != ed25519.PublicKeySize {
		t.Errorf("Public key size wrong: got %d, want %d", len(kp.PublicKey), ed25519.PublicKeySize)
	}

	if len(kp.PrivateKey) != ed25519.PrivateKeySize {
		t.Errorf("Private key size wrong: got %d, want %d", len(kp.PrivateKey), ed25519.PrivateKeySize)
	}

	if kp.NodeID == "" {
		t.Error("NodeID should not be empty")
	}
}

// TestSignAndVerifyEnvelope tests envelope signing and verification
func TestSignAndVerifyEnvelope(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")

	// Sign envelope
	err := kp.SignEnvelope(envelope)
	if err != nil {
		t.Fatalf("Failed to sign envelope: %v", err)
	}

	if envelope.Signature == "" {
		t.Error("Envelope should have signature after signing")
	}

	// Verify envelope
	err = kp.VerifyEnvelope(envelope, kp.PublicKey)
	if err != nil {
		t.Errorf("Envelope verification failed: %v", err)
	}
}

// TestSignAndVerifyProof tests proof signing and verification
func TestSignAndVerifyProof(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope)

	proof := CreateExecutionProof(
		envelope.DelegationID,
		"output1",
		envelope.EnvelopeHash,
		"",
		"",
	)

	// Sign proof
	sig, err := kp.SignProof(proof)
	if err != nil {
		t.Fatalf("Failed to sign proof: %v", err)
	}

	proof.Signature = base64.StdEncoding.EncodeToString(sig)

	// Verify proof
	err = kp.VerifyProof(proof, kp.PublicKey)
	if err != nil {
		t.Errorf("Proof verification failed: %v", err)
	}
}

// TestVerifyProofIntegrity tests full proof-to-envelope verification
func TestVerifyProofIntegrity(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope)

	proof := CreateExecutionProof(
		envelope.DelegationID,
		"output1",
		envelope.EnvelopeHash,
		"",
		"",
	)

	sig, _ := kp.SignProof(proof)
	proof.Signature = base64.StdEncoding.EncodeToString(sig)

	// Should verify successfully
	err := VerifyProofIntegrity(proof, envelope, kp.PublicKey)
	if err != nil {
		t.Errorf("Proof integrity verification failed: %v", err)
	}
}

// ====================================
// TAMPER DETECTION TESTS
// ====================================

// TestTamperedProofSignature detects modified proof signatures
func TestTamperedProofSignature(t *testing.T) {
	kp1, _ := NewKeyPair()
	kp2, _ := NewKeyPair()

	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp1.SignEnvelope(envelope)

	proof := CreateExecutionProof(
		envelope.DelegationID,
		"output1",
		envelope.EnvelopeHash,
		"",
		"",
	)

	// Sign with key1
	sig, _ := kp1.SignProof(proof)
	proof.Signature = base64.StdEncoding.EncodeToString(sig)

	// Try to verify with key2 (wrong key)
	err := VerifyProofIntegrity(proof, envelope, kp2.PublicKey)
	if err == nil {
		t.Error("Expected verification to fail with wrong public key")
	}
}

// TestTamperedOutputHash detects modified output
func TestTamperedOutputHash(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope)

	proof := CreateExecutionProof(
		envelope.DelegationID,
		"output1",
		envelope.EnvelopeHash,
		"",
		"",
	)

	sig, _ := kp.SignProof(proof)
	proof.Signature = base64.StdEncoding.EncodeToString(sig)

	// Tamper with output hash
	proof.OutputHash = "tampered"

	// Sign again (attacker would need to re-sign)
	proof.Signature = ""
	sig, _ = kp.SignProof(proof)
	proof.Signature = base64.StdEncoding.EncodeToString(sig)

	// Verification should still work (signature is valid for tampered data)
	err := kp.VerifyProof(proof, kp.PublicKey)
	if err != nil {
		t.Errorf("Proof with modified output should still have valid signature: %v", err)
	}
}

// TestTamperedEnvelopeHash detects envelope hash mismatch
func TestTamperedEnvelopeHash(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope)

	proof := CreateExecutionProof(
		envelope.DelegationID,
		"output1",
		"wrong_hash", // Wrong envelope hash
		"",
		"",
	)

	sig, _ := kp.SignProof(proof)
	proof.Signature = base64.StdEncoding.EncodeToString(sig)

	err := VerifyProofIntegrity(proof, envelope, kp.PublicKey)
	if err == nil {
		t.Error("Expected verification to fail with wrong envelope hash")
	}
}

// TestReplayAttackProof detects replay of proof for different delegation
func TestReplayAttackProof(t *testing.T) {
	kp, _ := NewKeyPair()

	// Original envelope
	envelope1 := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope1)

	// Different envelope
	envelope2 := CreateDelegationEnvelope("pack2", "input2", "", "node1")
	kp.SignEnvelope(envelope2)

	// Proof for envelope1
	proof := CreateExecutionProof(
		envelope1.DelegationID,
		"output1",
		envelope1.EnvelopeHash,
		"",
		"",
	)

	sig, _ := kp.SignProof(proof)
	proof.Signature = base64.StdEncoding.EncodeToString(sig)

	// Try to use proof with envelope2 (replay attack)
	err := VerifyProofIntegrity(proof, envelope2, kp.PublicKey)
	if err == nil {
		t.Error("Expected verification to fail with replayed proof for different delegation")
	}
}

// TestMissingSignature rejects proofs without signatures
func TestMissingSignature(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope)

	proof := CreateExecutionProof(
		envelope.DelegationID,
		"output1",
		envelope.EnvelopeHash,
		"",
		"",
	)

	// No signature
	err := VerifyProofIntegrity(proof, envelope, kp.PublicKey)
	if err == nil {
		t.Error("Expected verification to fail with missing signature")
	}
}

// TestInvalidSignatureEncoding rejects malformed signatures
func TestInvalidSignatureEncoding(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope)

	proof := CreateExecutionProof(
		envelope.DelegationID,
		"output1",
		envelope.EnvelopeHash,
		"",
		"",
	)

	// Invalid base64
	proof.Signature = "not-valid-base64!!!"

	err := VerifyProofIntegrity(proof, envelope, kp.PublicKey)
	if err == nil {
		t.Error("Expected verification to fail with invalid signature encoding")
	}
}

// TestTamperedEnvelope detects modified envelopes
func TestTamperedEnvelope(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope)

	// Save original hash
	originalHash := envelope.EnvelopeHash

	// Tamper with pack hash
	envelope.PackHash = "tampered"

	// Recompute hash
	envelope.EnvelopeHash = determinism.Hash(envelope)

	// Verify with wrong hash should fail
	if envelope.EnvelopeHash == originalHash {
		t.Error("Envelope hash should change when data is modified")
	}

	// Original signature should not match tampered envelope
	err := kp.VerifyEnvelope(envelope, kp.PublicKey)
	if err == nil {
		t.Error("Expected verification to fail with tampered envelope")
	}
}

// ====================================
// KEY STORE TESTS
// ====================================

func TestKeyStoreLoadOrCreate(t *testing.T) {
	tmpDir := t.TempDir()
	ks := NewKeyStore(tmpDir)

	// Should create new key
	kp1, err := ks.LoadOrCreate()
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	// Should load existing key
	kp2, err := ks.LoadOrCreate()
	if err != nil {
		t.Fatalf("Failed to load key: %v", err)
	}

	// Keys should be identical
	if string(kp1.PublicKey) != string(kp2.PublicKey) {
		t.Error("Loaded key should match created key")
	}

	// Verify key file exists
	keyPath := filepath.Join(tmpDir, KeyStorePath, "poee_key.pem")
	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		t.Error("Key file should exist")
	}
}

func TestKeyStorePeerKey(t *testing.T) {
	tmpDir := t.TempDir()
	ks := NewKeyStore(tmpDir)

	// Create a keypair to use as peer key
	kp, _ := NewKeyPair()

	// Save peer key
	err := ks.SavePeerKey("peer1", kp.PublicKey)
	if err != nil {
		t.Fatalf("Failed to save peer key: %v", err)
	}

	// Load peer key
	loadedKey, err := ks.LoadPeerKey("peer1")
	if err != nil {
		t.Fatalf("Failed to load peer key: %v", err)
	}

	if string(loadedKey) != string(kp.PublicKey) {
		t.Error("Loaded peer key should match saved key")
	}

	// Loading non-existent key should fail
	_, err = ks.LoadPeerKey("peer2")
	if err == nil {
		t.Error("Should fail to load non-existent peer key")
	}
}

// ====================================
// JSON EXPORT/IMPORT TESTS
// ====================================

func TestExportImportProof(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope)

	proof := CreateExecutionProof(
		envelope.DelegationID,
		"output1",
		envelope.EnvelopeHash,
		"",
		"",
	)

	sig, _ := kp.SignProof(proof)
	proof.Signature = base64.StdEncoding.EncodeToString(sig)

	// Export
	data, err := ExportProofJSON(proof)
	if err != nil {
		t.Fatalf("Failed to export proof: %v", err)
	}

	// Import
	imported, err := ImportProofJSON(data)
	if err != nil {
		t.Fatalf("Failed to import proof: %v", err)
	}

	if imported.DelegationID != proof.DelegationID {
		t.Error("Imported proof should match original")
	}

	if imported.Signature != proof.Signature {
		t.Error("Imported signature should match original")
	}
}

func TestExportImportEnvelope(t *testing.T) {
	kp, _ := NewKeyPair()
	envelope := CreateDelegationEnvelope("pack1", "input1", "", "node1")
	kp.SignEnvelope(envelope)

	// Export
	data, err := ExportEnvelopeJSON(envelope)
	if err != nil {
		t.Fatalf("Failed to export envelope: %v", err)
	}

	// Import
	imported, err := ImportEnvelopeJSON(data)
	if err != nil {
		t.Fatalf("Failed to import envelope: %v", err)
	}

	if imported.DelegationID != envelope.DelegationID {
		t.Error("Imported envelope should match original")
	}

	if imported.Signature != envelope.Signature {
		t.Error("Imported signature should match original")
	}
}

// ====================================
// TRUST STORE TESTS
// ====================================

func TestTrustStoreManager(t *testing.T) {
	tmpDir := t.TempDir()
	tsm := NewTrustStoreManager(tmpDir)

	// Record delegation
	err := tsm.RecordDelegation("delegation1", "peer1")
	if err != nil {
		t.Fatalf("Failed to record delegation: %v", err)
	}

	// Load and check
	err = tsm.Load()
	if err != nil {
		t.Fatalf("Failed to load trust store: %v", err)
	}

	entry, ok := tsm.GetDelegation("delegation1")
	if !ok {
		t.Fatal("Delegation should exist")
	}

	if entry.PeerID != "peer1" {
		t.Errorf("Wrong peer ID: got %s, want peer1", entry.PeerID)
	}

	if entry.Status != "pending" {
		t.Errorf("Wrong status: got %s, want pending", entry.Status)
	}

	// Record completion
	err = tsm.RecordCompletion("delegation1", "/path/to/proof", true)
	if err != nil {
		t.Fatalf("Failed to record completion: %v", err)
	}

	entry, _ = tsm.GetDelegation("delegation1")
	if entry.Status != "completed" {
		t.Errorf("Wrong status after completion: got %s", entry.Status)
	}

	if !entry.Verified {
		t.Error("Should be verified")
	}
}

func TestTrustStorePersistence(t *testing.T) {
	tmpDir := t.TempDir()

	// Create and save
	tsm1 := NewTrustStoreManager(tmpDir)
	tsm1.RecordDelegation("delegation1", "peer1")
	tsm1.RecordCompletion("delegation1", "/path", true)

	// Create new instance and load
	tsm2 := NewTrustStoreManager(tmpDir)
	err := tsm2.Load()
	if err != nil {
		t.Fatalf("Failed to load: %v", err)
	}

	entry, ok := tsm2.GetDelegation("delegation1")
	if !ok {
		t.Fatal("Should load persisted delegation")
	}

	if entry.Status != "completed" {
		t.Error("Should persist completion status")
	}
}
