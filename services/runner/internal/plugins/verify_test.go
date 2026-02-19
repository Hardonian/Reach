package plugins

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"
)

func TestSignatureMetadata(t *testing.T) {
	sig := SignatureMetadata{
		KeyID:     "key-123",
		Algorithm: "RSA-SHA256",
		Signature: "base64encoded",
	}

	if sig.KeyID != "key-123" {
		t.Errorf("expected KeyID 'key-123', got %s", sig.KeyID)
	}
	if sig.Algorithm != "RSA-SHA256" {
		t.Errorf("expected Algorithm 'RSA-SHA256', got %s", sig.Algorithm)
	}
}

func TestVerifyManifestNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "nonexistent.json")
	sigPath := filepath.Join(tmpDir, "nonexistent.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	_, err := VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err == nil {
		t.Error("expected error for non-existent manifest")
	}
}

func TestVerifyManifestMissingSignature(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	sigPath := filepath.Join(tmpDir, "manifest.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	// Create manifest
	if err := os.WriteFile(manifestPath, []byte(`{}`), 0644); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}

	// Don't create signature file

	// Test without allowing unsigned
	_, err := VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err == nil {
		t.Error("expected error for missing signature")
	}

	// Test with allowing unsigned
	status, err := VerifyManifest(manifestPath, sigPath, keysPath, true)
	if err != nil {
		t.Errorf("unexpected error with allowUnsigned: %v", err)
	}
	if status != "unsigned" {
		t.Errorf("expected status 'unsigned', got %s", status)
	}
}

func TestVerifyManifestInvalidSignatureFormat(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	sigPath := filepath.Join(tmpDir, "manifest.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	// Create manifest
	if err := os.WriteFile(manifestPath, []byte(`{}`), 0644); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}

	// Create invalid signature
	if err := os.WriteFile(sigPath, []byte(`not valid json`), 0644); err != nil {
		t.Fatalf("failed to write signature: %v", err)
	}

	_, err := VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err == nil {
		t.Error("expected error for invalid signature JSON")
	}
}

func TestVerifyManifestMissingKeysFile(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	sigPath := filepath.Join(tmpDir, "manifest.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	// Create manifest
	if err := os.WriteFile(manifestPath, []byte(`{}`), 0644); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}

	// Create valid signature structure
	sig := SignatureMetadata{
		KeyID:     "test-key",
		Algorithm: "RSA-SHA256",
		Signature: "dummy",
	}
	sigData, _ := json.Marshal(sig)
	if err := os.WriteFile(sigPath, sigData, 0644); err != nil {
		t.Fatalf("failed to write signature: %v", err)
	}

	// Don't create keys file
	_, err := VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err == nil {
		t.Error("expected error for missing keys file")
	}
}

func TestVerifyManifestUnknownKey(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	sigPath := filepath.Join(tmpDir, "manifest.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	// Create manifest
	if err := os.WriteFile(manifestPath, []byte(`{}`), 0644); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}

	// Create signature with unknown key
	sig := SignatureMetadata{
		KeyID:     "unknown-key",
		Algorithm: "RSA-SHA256",
		Signature: "dummy",
	}
	sigData, _ := json.Marshal(sig)
	if err := os.WriteFile(sigPath, sigData, 0644); err != nil {
		t.Fatalf("failed to write signature: %v", err)
	}

	// Create keys file with different key
	keys := map[string]string{
		"other-key": "some-pem-data",
	}
	keysData, _ := json.Marshal(keys)
	if err := os.WriteFile(keysPath, keysData, 0644); err != nil {
		t.Fatalf("failed to write keys: %v", err)
	}

	_, err := VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err == nil {
		t.Error("expected error for unknown key")
	}
}

func TestVerifyManifestInvalidPEM(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	sigPath := filepath.Join(tmpDir, "manifest.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	// Create manifest
	if err := os.WriteFile(manifestPath, []byte(`{}`), 0644); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}

	// Create signature
	sig := SignatureMetadata{
		KeyID:     "test-key",
		Algorithm: "RSA-SHA256",
		Signature: "dummy",
	}
	sigData, _ := json.Marshal(sig)
	if err := os.WriteFile(sigPath, sigData, 0644); err != nil {
		t.Fatalf("failed to write signature: %v", err)
	}

	// Create keys file with invalid PEM
	keys := map[string]string{
		"test-key": "not-valid-pem",
	}
	keysData, _ := json.Marshal(keys)
	if err := os.WriteFile(keysPath, keysData, 0644); err != nil {
		t.Fatalf("failed to write keys: %v", err)
	}

	_, err := VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err == nil {
		t.Error("expected error for invalid PEM")
	}
}

func TestVerifyManifestValidSignature(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	sigPath := filepath.Join(tmpDir, "manifest.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	// Generate RSA key pair
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}
	publicKey := &privateKey.PublicKey

	// Create manifest
	manifest := []byte(`{"name":"test-plugin","version":"1.0.0"}`)
	if err := os.WriteFile(manifestPath, manifest, 0644); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}

	// Sign the manifest
	hash := sha256.Sum256(manifest)
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hash[:])
	if err != nil {
		t.Fatalf("failed to sign: %v", err)
	}

	// Create signature file
	sig := SignatureMetadata{
		KeyID:     "test-key",
		Algorithm: "RSA-SHA256",
		Signature: base64.StdEncoding.EncodeToString(signature),
	}
	sigData, _ := json.Marshal(sig)
	if err := os.WriteFile(sigPath, sigData, 0644); err != nil {
		t.Fatalf("failed to write signature: %v", err)
	}

	// Create keys file with public key
	pubKeyBytes, _ := x509.MarshalPKIXPublicKey(publicKey)
	pemBlock := &pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubKeyBytes,
	}
	pemData := pem.EncodeToMemory(pemBlock)

	keys := map[string]string{
		"test-key": string(pemData),
	}
	keysData, _ := json.Marshal(keys)
	if err := os.WriteFile(keysPath, keysData, 0644); err != nil {
		t.Fatalf("failed to write keys: %v", err)
	}

	// Verify
	keyID, err := VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err != nil {
		t.Errorf("unexpected error during verification: %v", err)
	}
	if keyID != "test-key" {
		t.Errorf("expected keyID 'test-key', got %s", keyID)
	}
}

func TestVerifyManifestInvalidSignature(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	sigPath := filepath.Join(tmpDir, "manifest.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	// Generate RSA key pair
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}
	publicKey := &privateKey.PublicKey

	// Create manifest
	manifest := []byte(`{"name":"test-plugin","version":"1.0.0"}`)
	if err := os.WriteFile(manifestPath, manifest, 0644); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}

	// Create invalid signature (wrong data signed)
	wrongData := []byte("wrong data")
	hash := sha256.Sum256(wrongData)
	signature, _ := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hash[:])

	// Create signature file
	sig := SignatureMetadata{
		KeyID:     "test-key",
		Algorithm: "RSA-SHA256",
		Signature: base64.StdEncoding.EncodeToString(signature),
	}
	sigData, _ := json.Marshal(sig)
	if err := os.WriteFile(sigPath, sigData, 0644); err != nil {
		t.Fatalf("failed to write signature: %v", err)
	}

	// Create keys file with public key
	pubKeyBytes, _ := x509.MarshalPKIXPublicKey(publicKey)
	pemBlock := &pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubKeyBytes,
	}
	pemData := pem.EncodeToMemory(pemBlock)

	keys := map[string]string{
		"test-key": string(pemData),
	}
	keysData, _ := json.Marshal(keys)
	if err := os.WriteFile(keysPath, keysData, 0644); err != nil {
		t.Fatalf("failed to write keys: %v", err)
	}

	// Verify should fail
	_, err = VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err == nil {
		t.Error("expected error for invalid signature")
	}
}

func TestVerifyManifestInvalidBase64(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	sigPath := filepath.Join(tmpDir, "manifest.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	// Generate RSA key pair
	privateKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	publicKey := &privateKey.PublicKey

	// Create manifest
	if err := os.WriteFile(manifestPath, []byte(`{}`), 0644); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}

	// Create signature file with invalid base64
	sig := SignatureMetadata{
		KeyID:     "test-key",
		Algorithm: "RSA-SHA256",
		Signature: "not-valid-base64!!!",
	}
	sigData, _ := json.Marshal(sig)
	if err := os.WriteFile(sigPath, sigData, 0644); err != nil {
		t.Fatalf("failed to write signature: %v", err)
	}

	// Create keys file with public key
	pubKeyBytes, _ := x509.MarshalPKIXPublicKey(publicKey)
	pemBlock := &pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubKeyBytes,
	}
	pemData := pem.EncodeToMemory(pemBlock)

	keys := map[string]string{
		"test-key": string(pemData),
	}
	keysData, _ := json.Marshal(keys)
	if err := os.WriteFile(keysPath, keysData, 0644); err != nil {
		t.Fatalf("failed to write keys: %v", err)
	}

	// Verify should fail
	_, err := VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err == nil {
		t.Error("expected error for invalid base64")
	}
}

func TestVerifyManifestUnsupportedKeyType(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	sigPath := filepath.Join(tmpDir, "manifest.sig")
	keysPath := filepath.Join(tmpDir, "keys.json")

	// Create manifest
	if err := os.WriteFile(manifestPath, []byte(`{}`), 0644); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}

	// Create signature
	sig := SignatureMetadata{
		KeyID:     "test-key",
		Algorithm: "RSA-SHA256",
		Signature: "dummy",
	}
	sigData, _ := json.Marshal(sig)
	if err := os.WriteFile(sigPath, sigData, 0644); err != nil {
		t.Fatalf("failed to write signature: %v", err)
	}

	// Create keys file with EC key (not RSA)
	ecKeyData := `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWtEJNQBmV4rNDUVpTvq8JcE4cZ5G
-----END PUBLIC KEY-----`

	keys := map[string]string{
		"test-key": ecKeyData,
	}
	keysData, _ := json.Marshal(keys)
	if err := os.WriteFile(keysPath, keysData, 0644); err != nil {
		t.Fatalf("failed to write keys: %v", err)
	}

	// Verify should fail with unsupported key type
	_, err := VerifyManifest(manifestPath, sigPath, keysPath, false)
	if err == nil {
		t.Error("expected error for unsupported key type")
	}
}
