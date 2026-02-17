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

func TestMarketplaceIdempotencyFlow(t *testing.T) {
	// Setup registry with a valid package
	root := t.TempDir()
	bundle := []byte("bundle content")
	hash := sha256.Sum256(bundle)
	hashStr := hex.EncodeToString(hash[:])

	// Create manifest
	manifest := map[string]interface{}{
		"kind":                  "connector",
		"id":                    "conn.test",
		"version":               "1.0.0",
		"package_hash":          hashStr,
		"required_capabilities": []string{"network"},
		"risk_level":            "low",
	}
	manifestBytes, _ := json.Marshal(manifest)

	// Sign it
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	signature := ed25519.Sign(priv, manifestBytes)
	sigParams := map[string]string{
		"key_id":    "test-key",
		"algorithm": "ed25519",
		"signature": base64.StdEncoding.EncodeToString(signature),
	}
	sigBytes, _ := json.Marshal(sigParams)

	// Create file structure
	pkgDir := filepath.Join(root, "connectors", "conn.test", "1.0.0")
	os.MkdirAll(pkgDir, 0755)
	os.WriteFile(filepath.Join(pkgDir, "manifest.json"), manifestBytes, 0644)
	os.WriteFile(filepath.Join(pkgDir, "manifest.sig"), sigBytes, 0644)
	os.WriteFile(filepath.Join(pkgDir, "bundle.tgz"), bundle, 0644)

	// Create index
	index := map[string]interface{}{
		"packages": []map[string]interface{}{
			{
				"id": "conn.test",
				"versions": []map[string]interface{}{
					{
						"version":          "1.0.0",
						"sha256":           hashStr,
						"manifest_url":     "connectors/conn.test/1.0.0/manifest.json",
						"bundle_url":       "connectors/conn.test/1.0.0/bundle.tgz",
						"signature_url":    "connectors/conn.test/1.0.0/manifest.sig",
						"signature_key_id": "test-key",
						"risk_level":       "low",
						"tier_required":    "free",
					},
				},
			},
		},
	}
	indexBytes, _ := json.Marshal(index)
	os.WriteFile(filepath.Join(root, "index.json"), indexBytes, 0644)

	testKeys := map[string]string{
		"test-key": base64.StdEncoding.EncodeToString(pub),
	}

	// Initialize store
	store, err := NewStore(root, "", filepath.Join(root, "cache"), filepath.Join(root, "installed"), filepath.Join(root, "lock.json"), testKeys)
	if err != nil {
		t.Fatalf("NewStore failed: %v", err)
	}

	ctx := context.Background()

	// 1. Generate Intent
	intentReq := InstallIntentRequest{
		Kind: "connector",
		ID:   "conn.test",
	}
	intentResp, err := store.InstallIntent(ctx, intentReq)
	if err != nil {
		t.Fatalf("InstallIntent failed: %v", err)
	}

	if intentResp.IdempotencyKey == "" {
		t.Fatal("Expected idempotency key in response")
	}
	if intentResp.ResolvedVersion != "1.0.0" {
		t.Fatalf("Expected version 1.0.0, got %s", intentResp.ResolvedVersion)
	}

	// 2. Try install without key (should fail)
	installReq := InstallRequestV1{
		Kind:                 "connector",
		ID:                   "conn.test",
		Version:              "1.0.0",
		AcceptedRisk:         true,
		AcceptedCapabilities: []string{"network"},
	}
	_, err = store.InstallMarketplace(ctx, installReq)
	if err == nil {
		t.Fatal("Expected failure when missing idempotency key")
	}

	// 3. Try install with invalid key (should fail)
	installReq.IdempotencyKey = "invalid-key"
	_, err = store.InstallMarketplace(ctx, installReq)
	if err == nil {
		t.Fatal("Expected failure with invalid idempotency key")
	}

	// 4. Try install with valid key
	installReq.IdempotencyKey = intentResp.IdempotencyKey
	installed, err := store.InstallMarketplace(ctx, installReq)
	if err != nil {
		t.Fatalf("InstallMarketplace failed with valid key: %v", err)
	}

	if installed.ID != "conn.test" || installed.PinnedVersion != "1.0.0" {
		t.Errorf("Unexpected installed result: %+v", installed)
	}

	// 5. Try replay with same key (should fail as key is consumed)
	_, err = store.InstallMarketplace(ctx, installReq)
	if err == nil {
		t.Fatal("Expected failure on replay of consumed key")
	}
}
