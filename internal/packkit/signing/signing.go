package signing

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"fmt"
)

type Signature struct {
	KeyID     string `json:"key_id"`
	Algorithm string `json:"algorithm"`
	Signature string `json:"signature"`
}

func NormalizeEd25519PrivateKey(raw []byte) (ed25519.PrivateKey, error) {
	switch len(raw) {
	case ed25519.PrivateKeySize:
		return ed25519.PrivateKey(raw), nil
	case ed25519.SeedSize:
		return ed25519.NewKeyFromSeed(raw), nil
	default:
		return nil, fmt.Errorf("invalid ed25519 private key length: %d", len(raw))
	}
}

func VerifyManifestSignature(manifest []byte, sig Signature, trustedKeys map[string]string) (bool, string, error) {
	if sig.KeyID == "" || sig.Signature == "" {
		return false, "", fmt.Errorf("signature fields required")
	}
	if sig.Algorithm != "" && sig.Algorithm != "ed25519" {
		return false, sig.KeyID, fmt.Errorf("unsupported algorithm: %s", sig.Algorithm)
	}
	key, ok := trustedKeys[sig.KeyID]
	if !ok {
		return false, sig.KeyID, fmt.Errorf("unknown key id: %s", sig.KeyID)
	}
	pk, err := base64.StdEncoding.DecodeString(key)
	if err != nil {
		return false, sig.KeyID, fmt.Errorf("invalid public key encoding: %w", err)
	}
	sigBytes, err := base64.StdEncoding.DecodeString(sig.Signature)
	if err != nil {
		return false, sig.KeyID, fmt.Errorf("invalid signature encoding: %w", err)
	}
	return ed25519.Verify(ed25519.PublicKey(pk), manifest, sigBytes), sig.KeyID, nil
}

func ParseSignature(data []byte) (Signature, error) {
	var sig Signature
	if err := json.Unmarshal(data, &sig); err != nil {
		return Signature{}, err
	}
	if sig.Algorithm == "" {
		sig.Algorithm = "ed25519"
	}
	return sig, nil
}
