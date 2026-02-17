package registry

import (
	"context"
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

func setupMarketplaceRegistry(t *testing.T) (string, map[string]string) {
	t.Helper()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "connectors", "conn.github", "1.0.0"), 0o755); err != nil {
		t.Fatal(err)
	}
	bundle := []byte("bundle")
	h := sha256.Sum256(bundle)
	m := map[string]any{"kind": "connector", "id": "conn.github", "version": "1.0.0", "package_hash": hex.EncodeToString(h[:]), "required_capabilities": []string{"filesystem:read"}, "side_effect_types": []string{"network"}, "risk_level": "medium"}
	manifestBytes, _ := json.Marshal(m)
	_ = os.WriteFile(filepath.Join(root, "connectors", "conn.github", "1.0.0", "manifest.json"), manifestBytes, 0o644)
	_ = os.WriteFile(filepath.Join(root, "connectors", "conn.github", "1.0.0", "bundle.tgz"), bundle, 0o644)

	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	signed := ed25519.Sign(priv, manifestBytes)
	sig := map[string]string{"key_id": "dev", "algorithm": "ed25519", "signature": base64.StdEncoding.EncodeToString(signed)}
	sigBytes, _ := json.Marshal(sig)
	_ = os.WriteFile(filepath.Join(root, "connectors", "conn.github", "1.0.0", "manifest.sig"), sigBytes, 0o644)

	idx := map[string]any{"packages": []map[string]any{{"id": "conn.github", "versions": []map[string]string{{"version": "1.0.0", "sha256": hex.EncodeToString(h[:]), "manifest_url": "conn.github/1.0.0/manifest.json", "signature_url": "conn.github/1.0.0/manifest.sig", "bundle_url": "conn.github/1.0.0/bundle.tgz", "signature_key_id": "dev", "risk_level": "medium", "tier_required": "pro"}}}}}
	idxBytes, _ := json.Marshal(idx)
	_ = os.WriteFile(filepath.Join(root, "connectors", "index.json"), idxBytes, 0o644)
	return root, map[string]string{"dev": base64.StdEncoding.EncodeToString(pub)}
}

func TestMarketplaceCatalogFilterAndPagination(t *testing.T) {
	t.Setenv("DEV_ALLOW_UNSIGNED", "0")
	root, keys := setupMarketplaceRegistry(t)
	store, err := NewStore(filepath.Join(root, "connectors"), "", filepath.Join(root, "cache"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), keys)
	if err != nil {
		t.Fatal(err)
	}
	page, err := store.ListMarketplaceCatalog(context.Background(), CatalogFilter{Query: "github", Page: 1, PageSize: 1})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 1 || len(page.Items) != 1 {
		t.Fatalf("unexpected page: %+v", page)
	}
}

func TestInstallIntentAndConsentEnforcement(t *testing.T) {
	t.Setenv("DEV_ALLOW_UNSIGNED", "0")
	root, keys := setupMarketplaceRegistry(t)
	store, err := NewStore(filepath.Join(root, "connectors"), "", filepath.Join(root, "cache"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), keys)
	if err != nil {
		t.Fatal(err)
	}
	store.SetCurrentTier("pro")
	intent, err := store.InstallIntent(context.Background(), InstallIntentRequest{Kind: "connector", ID: "conn.github"})
	if err != nil {
		t.Fatal(err)
	}
	if !intent.Signature.Verified {
		t.Fatalf("expected verified signature: %+v", intent.Signature)
	}
	if _, err := store.InstallMarketplace(context.Background(), InstallRequestV1{Kind: "connector", ID: "conn.github", Version: "1.0.0", IdempotencyKey: intent.IdempotencyKey, AcceptedRisk: false, AcceptedCapabilities: []string{"filesystem:read"}}); err == nil {
		t.Fatal("expected accepted risk requirement")
	}
	intent2, err := store.InstallIntent(context.Background(), InstallIntentRequest{Kind: "connector", ID: "conn.github"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.InstallMarketplace(context.Background(), InstallRequestV1{Kind: "connector", ID: "conn.github", Version: "1.0.0", IdempotencyKey: intent2.IdempotencyKey, AcceptedRisk: true, AcceptedCapabilities: nil}); err == nil {
		t.Fatal("expected capability acceptance requirement")
	}
}

func TestTierAndNoAutoUpgrade(t *testing.T) {
	t.Setenv("DEV_ALLOW_UNSIGNED", "0")
	root, keys := setupMarketplaceRegistry(t)
	store, err := NewStore(filepath.Join(root, "connectors"), "", filepath.Join(root, "cache"), filepath.Join(root, "installed", "connectors"), filepath.Join(root, "reach.lock.json"), keys)
	if err != nil {
		t.Fatal(err)
	}
	store.SetCurrentTier("free")
	intent, err := store.InstallIntent(context.Background(), InstallIntentRequest{Kind: "connector", ID: "conn.github"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.InstallMarketplace(context.Background(), InstallRequestV1{Kind: "connector", ID: "conn.github", Version: "1.0.0", IdempotencyKey: intent.IdempotencyKey, AcceptedRisk: true, AcceptedCapabilities: []string{"filesystem:read"}}); err == nil {
		t.Fatal("expected tier gate")
	}
	store.SetCurrentTier("pro")
	intent2, err := store.InstallIntent(context.Background(), InstallIntentRequest{Kind: "connector", ID: "conn.github"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.InstallMarketplace(context.Background(), InstallRequestV1{Kind: "connector", ID: "conn.github", Version: "1.0.0", IdempotencyKey: intent2.IdempotencyKey, AcceptedRisk: true, AcceptedCapabilities: []string{"filesystem:read"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Install(InstallRequest{ID: "conn.github", Version: ">=0.0.0", AllowUpgrade: false}); err != nil {
		t.Fatalf("expected pinned install to be stable: %v", err)
	}
}
