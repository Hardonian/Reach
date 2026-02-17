package mesh

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
	"time"
)

func TestVerifySignatureAndReplayPrevention(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	h := NewHandshaker(time.Minute)
	challenge, err := h.NewChallenge("2026-01", "abc123")
	if err != nil {
		t.Fatal(err)
	}
	sig := SignChallenge(priv, challenge, "node-1")
	identity := NodeIdentity{NodeID: "node-1", OrgID: "org-1", NodePublicKey: pub, CapabilitiesHash: "abc123"}
	resp := Response{Challenge: challenge, NodeID: "node-1", Signature: sig}
	if _, err := h.Verify(identity, resp); err != nil {
		t.Fatalf("expected verify success: %v", err)
	}
	if _, err := h.Verify(identity, resp); err == nil {
		t.Fatal("expected replay failure")
	}
}
