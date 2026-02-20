package mesh

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
)

func TestGenerateDeterministicNodeID(t *testing.T) {
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}

	id1 := GenerateDeterministicNodeID(pub, "host-a")
	id2 := GenerateDeterministicNodeID(pub, "host-a")

	if id1 != id2 {
		t.Fatalf("expected deterministic: got %s and %s", id1, id2)
	}

	// Different host = different ID
	id3 := GenerateDeterministicNodeID(pub, "host-b")
	if id1 == id3 {
		t.Fatalf("expected different ID for different host, got same: %s", id1)
	}

	// Different key = different ID
	pub2, _, _ := ed25519.GenerateKey(rand.Reader)
	id4 := GenerateDeterministicNodeID(pub2, "host-a")
	if id1 == id4 {
		t.Fatalf("expected different ID for different key, got same: %s", id1)
	}

	// Verify prefix
	if id1[:6] != "reach-" {
		t.Fatalf("expected reach- prefix, got: %s", id1)
	}
}

func TestPublicKeyFingerprint(t *testing.T) {
	pub, _, _ := ed25519.GenerateKey(rand.Reader)
	fp := PublicKeyFingerprint(pub)
	if len(fp) != 64 { // SHA-256 = 32 bytes = 64 hex chars
		t.Fatalf("expected 64 hex chars, got %d: %s", len(fp), fp)
	}

	// Deterministic
	fp2 := PublicKeyFingerprint(pub)
	if fp != fp2 {
		t.Fatalf("fingerprint not deterministic")
	}
}

func TestNodeIdentityMatchesEnvironment(t *testing.T) {
	info := NodeIdentityInfo{
		NodeID:               "reach-abc123",
		PublicKeyFingerprint: "deadbeef",
		Environment: EnvironmentInfo{
			Hostname: "node-1",
			OS:       "linux",
			Arch:     "amd64",
			Region:   "us-west-2",
			Zone:     "us-west-2a",
			Cluster:  "prod",
		},
	}

	// Match all
	if !info.MatchesEnvironment("us-west-2", "us-west-2a", "prod") {
		t.Fatal("expected match")
	}

	// Empty constraints = match any
	if !info.MatchesEnvironment("", "", "") {
		t.Fatal("empty constraints should match")
	}

	// Partial match
	if !info.MatchesEnvironment("us-west-2", "", "") {
		t.Fatal("partial match should work")
	}

	// Mismatch
	if info.MatchesEnvironment("eu-west-1", "", "") {
		t.Fatal("wrong region should not match")
	}
}

func TestNodeIdentityMatchesLabels(t *testing.T) {
	info := NodeIdentityInfo{
		NodeID: "reach-abc123",
		Environment: EnvironmentInfo{
			Labels: map[string]string{
				"gpu":  "true",
				"tier": "premium",
			},
		},
	}

	if !info.MatchesLabels(map[string]string{"gpu": "true"}) {
		t.Fatal("should match gpu label")
	}

	if info.MatchesLabels(map[string]string{"gpu": "false"}) {
		t.Fatal("should not match wrong value")
	}

	if info.MatchesLabels(map[string]string{"missing": "label"}) {
		t.Fatal("should not match missing label")
	}

	// Empty = match all
	if !info.MatchesLabels(nil) {
		t.Fatal("nil labels should match all")
	}
}

func TestCanonicalString(t *testing.T) {
	info := NodeIdentityInfo{
		NodeID:               "reach-abc",
		PublicKeyFingerprint: "deadbeef",
		Environment: EnvironmentInfo{
			Hostname: "host-1",
			OS:       "linux",
			Arch:     "amd64",
			Region:   "us-west-2",
			Labels: map[string]string{
				"b_key": "b_val",
				"a_key": "a_val",
			},
		},
	}

	s1 := info.CanonicalString()
	s2 := info.CanonicalString()
	if s1 != s2 {
		t.Fatal("canonical string should be deterministic")
	}

	// Labels should be sorted
	if s1 == "" {
		t.Fatal("canonical string should not be empty")
	}
}

func TestParseLabels(t *testing.T) {
	tests := []struct {
		input    string
		expected map[string]string
	}{
		{"gpu=true,tier=premium", map[string]string{"gpu": "true", "tier": "premium"}},
		{"single=val", map[string]string{"single": "val"}},
		{"", map[string]string{}},
		{" gpu = true , tier = premium ", map[string]string{"gpu": "true", "tier": "premium"}},
	}

	for _, tc := range tests {
		result := parseLabels(tc.input)
		if len(result) != len(tc.expected) {
			t.Fatalf("for %q: expected %d labels, got %d", tc.input, len(tc.expected), len(result))
		}
		for k, v := range tc.expected {
			if result[k] != v {
				t.Fatalf("for %q: expected %s=%s, got %s=%s", tc.input, k, v, k, result[k])
			}
		}
	}
}
