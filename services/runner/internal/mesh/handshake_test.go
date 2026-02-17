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

	caps := CapabilityAdvertisement{
		CapabilitiesHash:     "hash-1",
		RegistrySnapshotHash: "abc123",
		PolicyVersion:        "2026-01",
	}

	sig := SignHandshake(priv, challenge, caps, "node-1")
	identity := NodeIdentity{NodeID: "node-1", OrgID: "org-1", NodePublicKey: pub, CapabilitiesHash: "hash-1"}
	resp := Response{
		Challenge:    challenge,
		Capabilities: caps,
		NodeID:       "node-1",
		Signature:    sig,
	}

	if _, err := h.Verify(identity, resp); err != nil {
		t.Fatalf("expected verify success: %v", err)
	}
	if _, err := h.Verify(identity, resp); err == nil {
		t.Fatal("expected replay failure")
	}
}
