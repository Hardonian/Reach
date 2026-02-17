package registry

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func setupRegistry(t *testing.T, withSig bool) (string, map[string]string) {
	t.Helper()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "connectors", "conn.github", "1.0.0"), 0o755); err != nil {
		t.Fatal(err)
	}
	bundle := []byte("bundle")
	h := sha256.Sum256(bundle)
	m := map[string]any{"kind": "connector", "id": "conn.github", "version": "1.0.0", "package_hash": hex.EncodeToString(h[:]), "required_capabilities": []string{"filesystem:read"}, "side_effect_types": []string{"network"}, "risk_level": "low"}
	manifestBytes, _ := json.Marshal(m)
	_ = os.WriteFile(filepath.Join(root, "connectors", "conn.github", "1.0.0", "manifest.json"), manifestBytes, 0o644)
	_ = os.WriteFile(filepath.Join(root, "connectors", "conn.github", "1.0.0", "bundle.tgz"), bundle, 0o644)
	idx := map[string]any{"packages": []map[string]string{{"id": "conn.github", "version": "1.0.0", "manifest": "conn.github/1.0.0/manifest.json", "sig": "conn.github/1.0.0/manifest.sig", "bundle": "conn.github/1.0.0/bundle.tgz", "hash": hex.EncodeToString(h[:])}}}
	idxBytes, _ := json.Marshal(idx)
	_ = os.WriteFile(filepath.Join(root, "connectors", "index.json"), idxBytes, 0o644)

	keys := map[string]string{}
	if withSig {
		pub, priv, _ := ed25519.GenerateKey(rand.Reader)
		signed := ed25519.Sign(priv, manifestBytes)
		sig := map[string]string{"key_id": "dev", "algorithm": "ed25519", "signature": base64.StdEncoding.EncodeToString(signed)}
		sigBytes, _ := json.Marshal(sig)
		_ = os.WriteFile(filepath.Join(root, "connectors", "conn.github", "1.0.0", "manifest.sig"), sigBytes, 0o644)
		keys["dev"] = base64.StdEncoding.EncodeToString(pub)
	}
	return root, keys
}

func TestInstallAndUninstall(t *testing.T) {
	t.Setenv("DEV_ALLOW_UNSIGNED", "0")
	root, keys := setupRegistry(t, true)
	store, err := NewStore(filepath.Join(root, "connectors"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), keys)
	if err != nil {
		t.Fatal(err)
	}
	installed, err := store.Install(InstallRequest{ID: "conn.github", Version: "=1.0.0"})
	if err != nil {
		t.Fatalf("install failed: %v", err)
	}
	if installed.VerifiedBy != "dev" {
		t.Fatalf("unexpected verifier: %s", installed.VerifiedBy)
	}
	if err := store.Uninstall("conn.github"); err != nil {
		t.Fatalf("uninstall failed: %v", err)
	}
}

func TestUnsignedRejectedInProd(t *testing.T) {
	t.Setenv("DEV_ALLOW_UNSIGNED", "0")
	root, _ := setupRegistry(t, false)
	store, err := NewStore(filepath.Join(root, "connectors"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), map[string]string{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Install(InstallRequest{ID: "conn.github", Version: "=1.0.0"}); err == nil {
		t.Fatal("expected signature required error")
	}
}

func TestUnsignedAllowedInDev(t *testing.T) {
	t.Setenv("DEV_ALLOW_UNSIGNED", "1")
	root, _ := setupRegistry(t, false)
	store, err := NewStore(filepath.Join(root, "connectors"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), map[string]string{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Install(InstallRequest{ID: "conn.github", Version: ">=1.0.0"}); err != nil {
		t.Fatalf("expected install success in dev: %v", err)
	}
}
