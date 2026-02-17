package registry

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"testing"
)

func signedManifest(t *testing.T, pkg []byte) ConnectorManifest {
	t.Helper()
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	h := sha256.Sum256(pkg)
	m := ConnectorManifest{ID: "conn-1", Provider: "github", Version: "1.0.0", Scopes: []string{"repo:read"}, Capabilities: []string{"filesystem:read"}, PackageHash: hex.EncodeToString(h[:]), SigningPublicKey: base64.StdEncoding.EncodeToString(pub)}
	payload, _ := json.Marshal(struct {
		ID           string   `json:"id"`
		Provider     string   `json:"provider"`
		Version      string   `json:"version"`
		Scopes       []string `json:"scopes"`
		Capabilities []string `json:"capabilities"`
		PackageHash  string   `json:"package_hash"`
	}{ID: m.ID, Provider: m.Provider, Version: m.Version, Scopes: m.Scopes, Capabilities: m.Capabilities, PackageHash: m.PackageHash})
	m.Signature = base64.StdEncoding.EncodeToString(ed25519.Sign(priv, payload))
	m.Verified = true
	return m
}

func TestInstallValidatesSignatureAndPinning(t *testing.T) {
	store := NewStore()
	pkg := []byte("hello-package")
	m := signedManifest(t, pkg)
	_, err := store.Install(InstallRequest{Manifest: m, PackageB64: base64.StdEncoding.EncodeToString(pkg)})
	if err != nil {
		t.Fatalf("expected install success: %v", err)
	}
	if _, err = store.Install(InstallRequest{Manifest: ConnectorManifest{ID: m.ID, Provider: m.Provider, Version: "2.0.0", PackageHash: m.PackageHash, Signature: m.Signature, SigningPublicKey: m.SigningPublicKey}, PackageB64: base64.StdEncoding.EncodeToString(pkg)}); err == nil {
		t.Fatal("expected version pinning error")
	}
}

func TestUnsignedRejectedUnlessDevMode(t *testing.T) {
	pkg := []byte("hello")
	h := sha256.Sum256(pkg)
	m := ConnectorManifest{ID: "x", Provider: "github", Version: "1", PackageHash: hex.EncodeToString(h[:])}
	if err := ValidateManifest(m, base64.StdEncoding.EncodeToString(pkg), false); err == nil {
		t.Fatal("expected unsigned connector rejection")
	}
	if err := ValidateManifest(m, base64.StdEncoding.EncodeToString(pkg), true); err != nil {
		t.Fatalf("expected dev mode acceptance: %v", err)
	}
}
