package signing

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"testing"
)

func TestVerifyManifestSignature(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	manifest := []byte(`{"id":"x"}`)
	signed := ed25519.Sign(priv, manifest)
	ok, keyID, err := VerifyManifestSignature(manifest, Signature{KeyID: "dev", Signature: base64.StdEncoding.EncodeToString(signed)}, map[string]string{"dev": base64.StdEncoding.EncodeToString(pub)})
	if err != nil || !ok || keyID != "dev" {
		t.Fatalf("unexpected verify result ok=%v key=%s err=%v", ok, keyID, err)
	}
}

func TestNormalizePrivateKeyFromSeed(t *testing.T) {
	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	seed := priv.Seed()
	n, err := NormalizeEd25519PrivateKey(seed)
	if err != nil {
		t.Fatal(err)
	}
	if len(n) != ed25519.PrivateKeySize {
		t.Fatalf("unexpected key size %d", len(n))
	}
}
