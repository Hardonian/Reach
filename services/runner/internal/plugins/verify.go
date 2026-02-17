package plugins

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
)

type SignatureMetadata struct {
	KeyID     string `json:"key_id"`
	Algorithm string `json:"algorithm"`
	Signature string `json:"signature"`
}

func VerifyManifest(manifestPath, signaturePath, keysPath string, allowUnsigned bool) (string, error) {
	manifest, err := os.ReadFile(manifestPath)
	if err != nil {
		return "", err
	}
	sigBytes, err := os.ReadFile(signaturePath)
	if err != nil {
		if allowUnsigned {
			return "unsigned", nil
		}
		return "", fmt.Errorf("signature required: %w", err)
	}
	var sig SignatureMetadata
	if err := json.Unmarshal(sigBytes, &sig); err != nil {
		return "", err
	}
	keysRaw, err := os.ReadFile(keysPath)
	if err != nil {
		return "", err
	}
	var keys map[string]string
	if err := json.Unmarshal(keysRaw, &keys); err != nil {
		return "", err
	}
	pemData, ok := keys[sig.KeyID]
	if !ok {
		return "", errors.New("unknown signer key")
	}
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return "", errors.New("invalid key pem")
	}
	pubAny, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return "", err
	}
	pub, ok := pubAny.(*rsa.PublicKey)
	if !ok {
		return "", errors.New("unsupported key type")
	}
	decoded, err := base64.StdEncoding.DecodeString(sig.Signature)
	if err != nil {
		return "", err
	}
	h := sha256.Sum256(manifest)
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, h[:], decoded); err != nil {
		return sig.KeyID, err
	}
	return sig.KeyID, nil
}
