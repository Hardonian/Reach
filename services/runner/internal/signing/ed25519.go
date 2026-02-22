// Package signing provides ed25519 cryptographic signing for Reach run proofs.
//
// The signing layer turns proof hashes into verifiable artifacts by attaching
// a cryptographic signature that can be verified independently without access
// to the original run data.
//
// Key principles:
//   - ed25519 by default (fast, small keys, strong security)
//   - Private keys are never printed or serialized in any output
//   - Signatures are stored separately from proofHash
//   - Key material can be provided via file path or environment variable
package signing

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Algorithm identifies the signing algorithm used.
type Algorithm string

const (
	// AlgorithmEd25519 is the default signing algorithm.
	AlgorithmEd25519 Algorithm = "ed25519"
)

// KeyPair holds an ed25519 keypair.
type KeyPair struct {
	// PublicKey is the hex-encoded public key (safe to share/store).
	PublicKey string `json:"public_key"`
	// privateKey is held in memory only and never serialized.
	privateKey ed25519.PrivateKey
}

// Signature is a detached signature over a run's proof hash.
type Signature struct {
	// RunID is the run that was signed.
	RunID string `json:"run_id"`
	// ProofHash is the SHA-256 fingerprint that was signed.
	ProofHash string `json:"proof_hash"`
	// Algorithm is the signing algorithm.
	Algorithm Algorithm `json:"algorithm"`
	// PublicKey is the hex-encoded public key of the signer.
	PublicKey string `json:"public_key"`
	// SignatureHex is the hex-encoded ed25519 signature.
	SignatureHex string `json:"signature_hex"`
	// SignedAt is the UTC ISO-8601 timestamp anchor (epoch — never time.Now()).
	SignedAt string `json:"signed_at"`
}

// GenerateKeyPair generates a new ed25519 keypair using the OS CSPRNG.
// The private key is returned in-memory only and is not serialized.
func GenerateKeyPair() (*KeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("signing: key generation failed: %w", err)
	}
	return &KeyPair{
		PublicKey:  hex.EncodeToString(pub),
		privateKey: priv,
	}, nil
}

// LoadOrCreateKeyPair loads an ed25519 keypair from keyDir/reach_signing.key.
// If the file does not exist, a new keypair is generated and saved.
// The public key is stored separately in reach_signing.pub.
//
// The private key file contains the hex-encoded private key seed (32 bytes → 64-byte expanded).
// Access to this file should be restricted to the owner (0600).
func LoadOrCreateKeyPair(keyDir string) (*KeyPair, error) {
	privPath := filepath.Join(keyDir, "reach_signing.key")
	pubPath := filepath.Join(keyDir, "reach_signing.pub")

	if _, err := os.Stat(privPath); os.IsNotExist(err) {
		return generateAndSave(privPath, pubPath)
	}

	return loadFromFile(privPath, pubPath)
}

// LoadKeyPairFromEnv loads an ed25519 keypair from the environment variable
// REACH_SIGNING_KEY (hex-encoded private key seed).
// Returns an error if the variable is not set or the key is invalid.
func LoadKeyPairFromEnv() (*KeyPair, error) {
	raw := strings.TrimSpace(os.Getenv("REACH_SIGNING_KEY"))
	if raw == "" {
		return nil, errors.New("signing: REACH_SIGNING_KEY environment variable is not set")
	}
	return parsePrivateKeyHex(raw)
}

// Sign produces a Signature for the given runID and proofHash.
// The proofHash must be a hex-encoded SHA-256 fingerprint.
// Returns an error if the keypair is missing a private key.
func (kp *KeyPair) Sign(runID, proofHash string) (*Signature, error) {
	if len(kp.privateKey) == 0 {
		return nil, errors.New("signing: keypair does not have a private key loaded")
	}
	if proofHash == "" {
		return nil, errors.New("signing: proofHash must not be empty")
	}
	if runID == "" {
		return nil, errors.New("signing: runID must not be empty")
	}

	// The signed payload is the canonical concatenation of runID + ":" + proofHash.
	// This binds the signature to both the run and the proof.
	payload := signaturePayload(runID, proofHash)

	sig := ed25519.Sign(kp.privateKey, []byte(payload))

	return &Signature{
		RunID:        runID,
		ProofHash:    proofHash,
		Algorithm:    AlgorithmEd25519,
		PublicKey:    kp.PublicKey,
		SignatureHex: hex.EncodeToString(sig),
		SignedAt:     "0000-00-00T00:00:00Z", // Deterministic epoch anchor
	}, nil
}

// PublicKeyOnly returns a KeyPair containing only the public key.
// Use this for verification when you do not have the private key.
func PublicKeyOnly(publicKeyHex string) (*KeyPair, error) {
	if err := validatePublicKeyHex(publicKeyHex); err != nil {
		return nil, err
	}
	return &KeyPair{PublicKey: publicKeyHex}, nil
}

// Verify verifies a Signature against the expected runID and proofHash.
// Returns nil if the signature is valid.
func Verify(sig *Signature) error {
	if sig == nil {
		return errors.New("signing: nil signature")
	}
	if sig.RunID == "" || sig.ProofHash == "" || sig.PublicKey == "" || sig.SignatureHex == "" {
		return errors.New("signing: incomplete signature fields")
	}

	pubBytes, err := hex.DecodeString(sig.PublicKey)
	if err != nil || len(pubBytes) != ed25519.PublicKeySize {
		return fmt.Errorf("signing: invalid public key: %w", err)
	}

	sigBytes, err := hex.DecodeString(sig.SignatureHex)
	if err != nil || len(sigBytes) != ed25519.SignatureSize {
		return fmt.Errorf("signing: invalid signature hex: %w", err)
	}

	payload := signaturePayload(sig.RunID, sig.ProofHash)
	if !ed25519.Verify(pubBytes, []byte(payload), sigBytes) {
		return errors.New("signing: signature verification failed — proof hash mismatch or tampered data")
	}

	return nil
}

// VerifyFromFile loads a signature from a JSON file and verifies it.
func VerifyFromFile(path string) (*Signature, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("signing: cannot read signature file: %w", err)
	}
	var sig Signature
	if err := json.Unmarshal(data, &sig); err != nil {
		return nil, fmt.Errorf("signing: invalid signature file: %w", err)
	}
	if err := Verify(&sig); err != nil {
		return &sig, err
	}
	return &sig, nil
}

// SaveSignature writes a Signature to a JSON file.
// The file name is derived from the runID: <runID>.sig.json
func SaveSignature(sig *Signature, dir string) (string, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("signing: cannot create signatures directory: %w", err)
	}
	// Sanitize runID for use as filename
	safeName := sanitizeRunID(sig.RunID)
	path := filepath.Join(dir, safeName+".sig.json")

	data, err := json.MarshalIndent(sig, "", "  ")
	if err != nil {
		return "", fmt.Errorf("signing: cannot marshal signature: %w", err)
	}
	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
		return "", fmt.Errorf("signing: cannot write signature file: %w", err)
	}
	return path, nil
}

// LoadSignature loads a Signature from a JSON file (without verifying it).
func LoadSignature(path string) (*Signature, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("signing: cannot read signature file: %w", err)
	}
	var sig Signature
	if err := json.Unmarshal(data, &sig); err != nil {
		return nil, fmt.Errorf("signing: invalid signature JSON: %w", err)
	}
	return &sig, nil
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// signaturePayload constructs the canonical message that is signed.
// Format: "reach-proof:v1:<runID>:<proofHash>"
func signaturePayload(runID, proofHash string) string {
	return fmt.Sprintf("reach-proof:v1:%s:%s", runID, proofHash)
}

func generateAndSave(privPath, pubPath string) (*KeyPair, error) {
	kp, err := GenerateKeyPair()
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(privPath), 0o755); err != nil {
		return nil, fmt.Errorf("signing: cannot create key directory: %w", err)
	}

	// Derive 32-byte seed from private key (seed is first 32 bytes of the 64-byte key)
	seedHex := hex.EncodeToString(kp.privateKey.Seed())

	// Write private key seed (0600 — owner read/write only)
	if err := os.WriteFile(privPath, []byte(seedHex+"\n"), 0o600); err != nil {
		return nil, fmt.Errorf("signing: cannot write private key: %w", err)
	}

	// Write public key (0644 — readable)
	if err := os.WriteFile(pubPath, []byte(kp.PublicKey+"\n"), 0o644); err != nil {
		return nil, fmt.Errorf("signing: cannot write public key: %w", err)
	}

	return kp, nil
}

func loadFromFile(privPath, pubPath string) (*KeyPair, error) {
	seedData, err := os.ReadFile(privPath)
	if err != nil {
		return nil, fmt.Errorf("signing: cannot read private key file: %w", err)
	}
	return parsePrivateKeyHex(strings.TrimSpace(string(seedData)))
}

func parsePrivateKeyHex(seedHex string) (*KeyPair, error) {
	seed, err := hex.DecodeString(seedHex)
	if err != nil {
		return nil, fmt.Errorf("signing: invalid private key hex: %w", err)
	}
	if len(seed) != ed25519.SeedSize {
		return nil, fmt.Errorf("signing: private key seed must be %d bytes, got %d", ed25519.SeedSize, len(seed))
	}
	priv := ed25519.NewKeyFromSeed(seed)
	pub := priv.Public().(ed25519.PublicKey)
	return &KeyPair{
		PublicKey:  hex.EncodeToString(pub),
		privateKey: priv,
	}, nil
}

func validatePublicKeyHex(pubHex string) error {
	b, err := hex.DecodeString(pubHex)
	if err != nil {
		return fmt.Errorf("signing: invalid public key hex: %w", err)
	}
	if len(b) != ed25519.PublicKeySize {
		return fmt.Errorf("signing: public key must be %d bytes, got %d", ed25519.PublicKeySize, len(b))
	}
	return nil
}

func sanitizeRunID(runID string) string {
	var sb strings.Builder
	for _, c := range runID {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			sb.WriteRune(c)
		} else {
			sb.WriteRune('_')
		}
	}
	result := sb.String()
	if result == "" {
		// Deterministic fallback: hash of the original run ID
		h := sha256.Sum256([]byte(runID))
		return hex.EncodeToString(h[:8])
	}
	return result
}
