package federation

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"fmt"
	"io"
)

// ZeroKnowledgeEnvelope represents an encrypted payload that can only be opened by a specific node.
type ZeroKnowledgeEnvelope struct {
	NodeID     string `json:"node_id"`
	Ciphertext []byte `json:"ciphertext"`
	EPK        []byte `json:"epk"` // Encrypted Per-node Key (wrapped for node's RSA pubkey)
	IV         []byte `json:"iv"`
	Hash       string `json:"hash"` // Deterministic hash of the UNENCRYPTED content for verification
}

// Seal wraps a payload for a specific node.
func Seal(payload []byte, nodePubKey *rsa.PublicKey, nodeID string) (*ZeroKnowledgeEnvelope, error) {
	// 1. Generate a random session key
	sessionKey := make([]byte, 32) // AES-256
	if _, err := io.ReadFull(rand.Reader, sessionKey); err != nil {
		return nil, err
	}

	// 2. Encrypt the payload using AES-GCM
	block, err := aes.NewCipher(sessionKey)
	if err != nil {
		return nil, err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	iv := make([]byte, aesgcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}
	ciphertext := aesgcm.Seal(nil, iv, payload, nil)

	// 3. Wrap the session key with the node's RSA Public Key
	epk, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, nodePubKey, sessionKey, nil)
	if err != nil {
		return nil, err
	}

	// 4. Calculate deterministic hash (for ZK verification)
	h := sha256.Sum256(payload)

	return &ZeroKnowledgeEnvelope{
		NodeID:     nodeID,
		Ciphertext: ciphertext,
		EPK:        epk,
		IV:         iv,
		Hash:       fmt.Sprintf("%x", h),
	}, nil
}

// In a real scenario, Open would be called inside the secure enclave of the NODE.
// Here we provide it for testing/simulation.
func Open(envelope *ZeroKnowledgeEnvelope, nodePrivKey *rsa.PrivateKey) ([]byte, error) {
	// 1. Unwrapping the session key
	sessionKey, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, nodePrivKey, envelope.EPK, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt session key: %w", err)
	}

	// 2. Decrypting the payload
	block, err := aes.NewCipher(sessionKey)
	if err != nil {
		return nil, err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return aesgcm.Open(nil, envelope.IV, envelope.Ciphertext, nil)
}
