package registry

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	idx := map[string]any{"packages": []map[string]any{{"id": "conn.github", "versions": []map[string]string{{"version": "1.0.0", "sha256": hex.EncodeToString(h[:]), "manifest_url": "conn.github/1.0.0/manifest.json", "signature_url": "conn.github/1.0.0/manifest.sig", "bundle_url": "conn.github/1.0.0/bundle.tgz", "signature_key_id": "dev", "risk_level": "low", "tier_required": "free"}}}}}
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
	store, err := NewStore(filepath.Join(root, "connectors"), "", filepath.Join(root, "cache"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), keys)
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
	store, err := NewStore(filepath.Join(root, "connectors"), "", filepath.Join(root, "cache"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), map[string]string{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Install(InstallRequest{ID: "conn.github", Version: "=1.0.0"}); err == nil {
		t.Fatal("expected signature required error")
	}
}

func TestRemoteInstallAndPin(t *testing.T) {
	t.Setenv("DEV_ALLOW_UNSIGNED", "0")
	root, keys := setupRegistry(t, true)
	bundlePath := filepath.Join(root, "connectors", "conn.github", "1.0.0", "bundle.tgz")
	bundle, _ := os.ReadFile(bundlePath)
	h := sha256.Sum256(bundle)

	var indexBytes []byte
	ts := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/index.json" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(indexBytes)
			return
		}
		http.FileServer(http.Dir(filepath.Join(root, "connectors"))).ServeHTTP(w, r)
	}))
	defer ts.Close()

	idx := map[string]any{"packages": []map[string]any{{"id": "conn.github", "versions": []map[string]string{{"version": "1.0.0", "sha256": hex.EncodeToString(h[:]), "manifest_url": ts.URL + "/conn.github/1.0.0/manifest.json", "signature_url": ts.URL + "/conn.github/1.0.0/manifest.sig", "bundle_url": ts.URL + "/conn.github/1.0.0/bundle.tgz", "signature_key_id": "dev", "risk_level": "low", "tier_required": "free"}}}}}
	indexBytes, _ = json.Marshal(idx)

	store, err := NewStore(filepath.Join(root, "connectors"), ts.URL+"/index.json", filepath.Join(root, "cache"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), keys)
	if err != nil {
		t.Fatal(err)
	}
	store.httpClient = ts.Client()
	installed, err := store.Install(InstallRequest{ID: "conn.github"})
	if err != nil {
		t.Fatalf("remote install failed: %v", err)
	}
	if installed.PinnedVersion != "1.0.0" {
		t.Fatalf("unexpected pin %s", installed.PinnedVersion)
	}
	if _, err := store.Install(InstallRequest{ID: "conn.github", Version: ">=2.0.0"}); err == nil {
		t.Fatal("expected pin enforcement error")
	}
}

func TestSHAMismatchRejected(t *testing.T) {
	t.Setenv("DEV_ALLOW_UNSIGNED", "1")
	root, _ := setupRegistry(t, false)
	idx := map[string]any{"packages": []map[string]any{{"id": "conn.github", "versions": []map[string]string{{"version": "1.0.0", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "manifest_url": "conn.github/1.0.0/manifest.json", "bundle_url": "conn.github/1.0.0/bundle.tgz", "signature_key_id": "dev", "risk_level": "low", "tier_required": "free"}}}}}
	idxBytes, _ := json.Marshal(idx)
	_ = os.WriteFile(filepath.Join(root, "connectors", "index.json"), idxBytes, 0o644)

	store, err := NewStore(filepath.Join(root, "connectors"), "", filepath.Join(root, "cache"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), map[string]string{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Install(InstallRequest{ID: "conn.github", Version: "=1.0.0"}); err == nil {
		t.Fatal("expected sha mismatch")
	}
}
