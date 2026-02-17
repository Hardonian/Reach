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
