// Package signing provides cryptographic signing interfaces for Reach.
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
	"sort"
	"strings"
)

// FileKeySignerConfig contains configuration for the FileKeySigner.
type FileKeySignerConfig struct {
	// KeyDir is the directory containing key files.
	KeyDir string `json:"keyDir"`
	// KeyID is the specific key to use (defaults to "default").
	KeyID string `json:"keyId"`
}

// FileKeySigner is a signer that reads keys from files.
// It supports Ed25519 keys stored in files for development purposes.
//
// Key file format:
//   - <keyDir>/<keyID>.key: hex-encoded private key seed (32 bytes)
//   - <keyDir>/<keyID>.pub: hex-encoded public key
//
// If the private key file doesn't exist, it will be generated.
type FileKeySigner struct {
	config     FileKeySignerConfig
	publicKey  ed25519.PublicKey
	privateKey ed25519.PrivateKey
}

// NewFileKeySigner creates a new FileKeySigner from configuration.
func NewFileKeySigner(config map[string]string) (SignerPlugin, error) {
	var cfg FileKeySignerConfig
	if config != nil {
		if j, ok := config["json"]; ok {
			if err := json.Unmarshal([]byte(j), &cfg); err != nil {
				return nil, fmt.Errorf("signing: invalid file key signer config: %w", err)
			}
		} else {
			if dir, ok := config["keyDir"]; ok {
				cfg.KeyDir = dir
			}
			if id, ok := config["keyId"]; ok {
				cfg.KeyID = id
			}
		}
	}

	// Apply defaults
	if cfg.KeyDir == "" {
		cfg.KeyDir = ".keys"
	}
	if cfg.KeyID == "" {
		cfg.KeyID = "default"
	}

	signer := &FileKeySigner{
		config: cfg,
	}

	// Try to load existing key
	if err := signer.loadKey(); err != nil {
		// If key doesn't exist, generate one
		if errors.Is(err, os.ErrNotExist) {
			if err := signer.generateKey(); err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	return signer, nil
}

// Name returns the name of the signer.
func (s *FileKeySigner) Name() string {
	return "file"
}

// SupportedAlgorithms returns the list of supported algorithms.
func (s *FileKeySigner) SupportedAlgorithms() []Algorithm {
	return []Algorithm{AlgorithmEd25519}
}

// Sign signs the given data with Ed25519.
func (s *FileKeySigner) Sign(data []byte, algorithm string) ([]byte, error) {
	if len(s.privateKey) == 0 {
		return nil, errors.New("signing: file key signer has no private key (read-only mode)")
	}

	alg := Algorithm(algorithm)
	if alg == "" {
		alg = AlgorithmEd25519
	}

	switch alg {
	case AlgorithmEd25519:
		return ed25519.Sign(s.privateKey, data), nil
	default:
		return nil, fmt.Errorf("signing: unsupported algorithm: %s", algorithm)
	}
}

// Verify verifies the signature over the given data.
func (s *FileKeySigner) Verify(data []byte, signature []byte, algorithm string) (bool, error) {
	alg := Algorithm(algorithm)
	if alg == "" {
		alg = AlgorithmEd25519
	}

	switch alg {
	case AlgorithmEd25519:
		if len(s.publicKey) == 0 {
			return false, errors.New("signing: file key signer has no public key")
		}
		return ed25519.Verify(s.publicKey, data, signature), nil
	default:
		return false, fmt.Errorf("signing: unsupported algorithm: %s", algorithm)
	}
}

// PublicKeyHex returns the hex-encoded public key.
func (s *FileKeySigner) PublicKeyHex() string {
	if len(s.publicKey) == 0 {
		return ""
	}
	return hex.EncodeToString(s.publicKey)
}

// KeyID returns the key ID used by this signer.
func (s *FileKeySigner) KeyID() string {
	return s.config.KeyID
}

// loadKey loads the key from files.
func (s *FileKeySigner) loadKey() error {
	keyPath := filepath.Join(s.config.KeyDir, s.config.KeyID+".key")
	pubPath := filepath.Join(s.config.KeyDir, s.config.KeyID+".pub")

	// Read private key
	privData, err := os.ReadFile(keyPath)
	if err != nil {
		return err
	}

	seed, err := hex.DecodeString(strings.TrimSpace(string(privData)))
	if err != nil {
		return fmt.Errorf("signing: invalid private key hex: %w", err)
	}

	if len(seed) != ed25519.SeedSize {
		return fmt.Errorf("signing: invalid seed length: expected %d, got %d", ed25519.SeedSize, len(seed))
	}

	s.privateKey = ed25519.NewKeyFromSeed(seed)
	s.publicKey = s.privateKey.Public().(ed25519.PublicKey)

	// Verify public key matches if .pub file exists
	if pubData, err := os.ReadFile(pubPath); err == nil {
		expectedPub := strings.TrimSpace(string(pubData))
		actualPub := hex.EncodeToString(s.publicKey)
		if expectedPub != actualPub {
			return errors.New("signing: public key mismatch")
		}
	}

	return nil
}

// generateKey generates a new key and saves it to files.
func (s *FileKeySigner) generateKey() error {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return fmt.Errorf("signing: failed to generate key: %w", err)
	}

	s.privateKey = priv
	s.publicKey = pub

	// Create directory if it doesn't exist
	if err := os.MkdirAll(s.config.KeyDir, 0o755); err != nil {
		return fmt.Errorf("signing: failed to create key directory: %w", err)
	}

	keyPath := filepath.Join(s.config.KeyDir, s.config.KeyID+".key")
	pubPath := filepath.Join(s.config.KeyDir, s.config.KeyID+".pub")

	// Write private key (owner only)
	seedHex := hex.EncodeToString(priv.Seed())
	if err := os.WriteFile(keyPath, []byte(seedHex+"\n"), 0o600); err != nil {
		return fmt.Errorf("signing: failed to write private key: %w", err)
	}

	// Write public key (readable)
	pubHex := hex.EncodeToString(pub)
	if err := os.WriteFile(pubPath, []byte(pubHex+"\n"), 0o644); err != nil {
		return fmt.Errorf("signing: failed to write public key: %w", err)
	}

	return nil
}

// Ensure FileKeySigner implements SignerPlugin
var _ SignerPlugin = (*FileKeySigner)(nil)

// FileKeySignerFromDir creates a FileKeySigner from a key directory.
func FileKeySignerFromDir(keyDir string) (SignerPlugin, error) {
	return NewFileKeySigner(map[string]string{
		"keyDir": keyDir,
	})
}

// ListAvailableKeys lists all available key IDs in a directory.
func ListAvailableKeys(keyDir string) ([]string, error) {
	entries, err := os.ReadDir(keyDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}

	keyIDs := make(map[string]bool)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".key") {
			keyID := strings.TrimSuffix(name, ".key")
			keyIDs[keyID] = true
		}
	}

	// Sort for deterministic order
	result := make([]string, 0, len(keyIDs))
	for k := range keyIDs {
		result = append(result, k)
	}
	sort.Strings(result)

	return result, nil
}

// TrustedKeys represents a collection of trusted public keys.
type TrustedKeys map[string]string

// LoadTrustedKeys loads trusted keys from a directory.
// Each file <keyID>.pub in the directory is loaded as a trusted key.
func LoadTrustedKeys(keyDir string) (TrustedKeys, error) {
	entries, err := os.ReadDir(keyDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return TrustedKeys{}, nil
		}
		return nil, err
	}

	keys := make(TrustedKeys)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".pub") {
			keyID := strings.TrimSuffix(name, ".pub")
			data, err := os.ReadFile(filepath.Join(keyDir, name))
			if err != nil {
				return nil, err
			}
			keys[keyID] = strings.TrimSpace(string(data))
		}
	}

	return keys, nil
}

// HashData computes SHA-256 hash of data (for deterministic signing).
func HashData(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}
